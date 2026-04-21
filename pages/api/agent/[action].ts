// import type { NextApiRequest, NextApiResponse } from 'next';

// const AGENT_API_BASE_URL = (process.env.GLOWMIA_AGENT_API_URL || process.env.NEXT_PUBLIC_GLOWMIA_AGENT_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

// type JsonResponse = Record<string, unknown> | { detail: string };

// function readString(value: unknown) {
//   return typeof value === 'string' ? value.trim() : '';
// }

// async function readBackendJson(path: string, payload: Record<string, unknown>) {
//   const response = await fetch(`${AGENT_API_BASE_URL}${path}`, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify(payload),
//   });

//   const text = await response.text();
//   const data = text ? (JSON.parse(text) as JsonResponse) : {};

//   return {
//     status: response.status,
//     data,
//   };
// }

// export default async function handler(req: NextApiRequest, res: NextApiResponse<JsonResponse>) {
//   if (req.method !== 'POST') {
//     res.setHeader('Allow', 'POST');
//     return res.status(405).json({ detail: 'Method not allowed' });
//   }

//   const action = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;

//   try {
//     if (action === 'session') {
//       const title = readString(req.body?.title) || 'Glowmia Stylist Session';
//       const { status, data } = await readBackendJson('/chat/sessions', { title });
//       return res.status(status).json(data);
//     }

//     if (action === 'recommend') {
//       const sessionId = readString(req.body?.sessionId);
//       const query = readString(req.body?.query);

//       if (!sessionId || !query) {
//         return res.status(400).json({ detail: 'Missing sessionId or query' });
//       }

//       const { status, data } = await readBackendJson(`/chat/sessions/${encodeURIComponent(sessionId)}/recommend`, { query });
//       return res.status(status).json(data);
//     }

//     if (action === 'edit') {
//       const sessionId = readString(req.body?.sessionId);
//       const dressId = readString(req.body?.dressId);
//       const imageUrl = readString(req.body?.imageUrl);
//       const instruction = readString(req.body?.instruction);

//       if (!sessionId || !dressId || !imageUrl || !instruction) {
//         return res.status(400).json({ detail: 'Missing edit request fields' });
//       }

//       const { status, data } = await readBackendJson(`/chat/sessions/${encodeURIComponent(sessionId)}/edit`, {
//         dress_id: dressId,
//         image_url: imageUrl,
//         instruction,
//       });

//       return res.status(status).json(data);
//     }

//     return res.status(404).json({ detail: 'Unknown agent action' });
//   } catch (error) {
//     console.error('Glowmia agent proxy failed', error);

//     return res.status(502).json({
//       detail: 'Glowmia stylist is unavailable right now. Make sure the agent backend is running.',
//     });
//   }
// }

import type { NextApiRequest, NextApiResponse } from 'next';

const AGENT_API_BASE_URL = (
  process.env.AGENT_BACKEND_URL ||
  process.env.GLOWMIA_AGENT_API_URL ||
  process.env.NEXT_PUBLIC_GLOWMIA_AGENT_API_URL ||
  'http://127.0.0.1:8000'
).replace(/\/$/, '');

type JsonResponse = Record<string, unknown> | { detail: string };

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function readBackendJson(path: string, payload: Record<string, unknown>) {
  const url = `${AGENT_API_BASE_URL}${path}`;
  console.log('[Agent Proxy] Forwarding to:', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  let data: JsonResponse = {};
  try {
    data = text ? (JSON.parse(text) as JsonResponse) : {};
  } catch {
    data = { detail: text || 'Invalid JSON response from backend' };
  }

  return {
    status: response.status,
    data,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<JsonResponse>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ detail: 'Method not allowed' });
  }

  const action = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;

  try {
    if (action === 'session') {
      const title = readString(req.body?.title) || 'Glowmia Stylist Session';
      const { status, data } = await readBackendJson('/chat/sessions', { title });
      return res.status(status).json(data);
    }

    if (action === 'recommend') {
      const sessionId = readString(req.body?.sessionId);
      const query = readString(req.body?.query);

      if (!sessionId || !query) {
        return res.status(400).json({ detail: 'Missing sessionId or query' });
      }

      const { status, data } = await readBackendJson(
        `/chat/sessions/${encodeURIComponent(sessionId)}/recommend`,
        { query }
      );

      return res.status(status).json(data);
    }

    if (action === 'edit') {
      const sessionId = readString(req.body?.sessionId);
      const dressId = readString(req.body?.dressId);
      const imageUrl = readString(req.body?.imageUrl);
      const instruction = readString(req.body?.instruction);

      if (!sessionId || !dressId || !imageUrl || !instruction) {
        return res.status(400).json({ detail: 'Missing edit request fields' });
      }

      const { status, data } = await readBackendJson(
        `/chat/sessions/${encodeURIComponent(sessionId)}/edit`,
        {
          dress_id: dressId,
          image_url: imageUrl,
          instruction,
        }
      );

      return res.status(status).json(data);
    }

    return res.status(404).json({ detail: 'Unknown agent action' });
  } catch (error) {
    console.error('Glowmia agent proxy failed', error);

    return res.status(502).json({
      detail: 'Glowmia stylist is unavailable right now. Make sure the agent backend is running.',
    });
  }
}