import type { NextApiRequest, NextApiResponse } from 'next';
import { editImage } from '@/src/server/replicate';

type AgentLanguage = 'en' | 'ar';

type EditImageResponse = {
  session_id: string;
  intent: 'edit';
  tool: 'edit';
  language: AgentLanguage;
  message: string;
  dresses: unknown[];
  edited_image_url: string;
  selected_dress_id: string;
};

type ApiError = {
  detail: string;
};

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readLanguage(value: unknown): AgentLanguage {
  return value === 'ar' ? 'ar' : 'en';
}

function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EditImageResponse | ApiError>
) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ detail: 'Method not allowed' });
  }

  const sessionId = readString(req.body?.sessionId);
  const message = readString(req.body?.message);
  const language = readLanguage(req.body?.language);
  const selectedDressId = readString(req.body?.selectedDressId);
  const selectedDressImageUrl = readString(req.body?.selectedDressImageUrl);

  if (!sessionId || !message) {
    return res.status(400).json({
      detail: 'Missing required fields: sessionId and message',
    });
  }

  if (!selectedDressId || !selectedDressImageUrl) {
    return res.status(400).json({
      detail: 'Missing required fields for image editing: selectedDressId and selectedDressImageUrl',
    });
  }

  try {
    const editedImageUrl = await editImage({
      imageUrl: selectedDressImageUrl,
      instruction: message,
      language,
    });

    const responseMessage =
      language === 'ar'
        ? 'تم تعديل صورة الفستان المختار مع الحفاظ على نفس الفستان الأساسي.'
        : 'I updated the selected dress image while keeping the same base dress.';

    console.info('[api/agent/edit] Successfully edited image via Replicate.', {
      dressId: selectedDressId,
      language,
    });

    return res.status(200).json({
      session_id: sessionId,
      intent: 'edit',
      tool: 'edit',
      language,
      message: responseMessage,
      dresses: [],
      edited_image_url: editedImageUrl,
      selected_dress_id: selectedDressId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unable to edit dress image.';

    console.error('[api/agent/edit] Image editing failed', {
      error: errorMessage,
      dressId: selectedDressId,
    });

    if (isDevelopment()) {
      return res.status(500).json({
        detail: `Image editing failed: ${errorMessage}`,
      });
    }

    return res.status(500).json({
      detail: 'Unable to edit dress image. Please try again.',
    });
  }
}
