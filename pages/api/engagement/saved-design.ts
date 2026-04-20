import type { NextApiRequest, NextApiResponse } from 'next';
import { getSavedDesignById } from '@/src/lib/glowmiaOrders';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const savedDesignId = typeof request.query?.id === 'string' ? request.query.id.trim() : '';

  if (!savedDesignId) {
    response.status(400).json({ error: 'Saved design id is required.' });
    return;
  }

  try {
    const savedDesign = await getSavedDesignById(savedDesignId);

    if (!savedDesign) {
      response.status(404).json({ error: 'Saved design not found.' });
      return;
    }

    response.status(200).json({ savedDesign });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to load the saved design.',
    });
  }
}
