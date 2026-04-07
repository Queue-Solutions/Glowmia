import { useEffect, useMemo, useState } from 'react';

export type DesignFeedback = {
  id: string;
  designId: string;
  author: string;
  message: string;
  rating: number;
  createdAt: string;
};

const STORAGE_KEY = 'glowmia:design-feedback';

function readFeedbackMap() {
  if (typeof window === 'undefined') {
    return {} as Record<string, DesignFeedback[]>;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, DesignFeedback[]>) : {};
  } catch {
    return {};
  }
}

export function useFeedback(designId: string) {
  const [feedbackMap, setFeedbackMap] = useState<Record<string, DesignFeedback[]>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFeedbackMap(readFeedbackMap());
    setHydrated(true);
  }, []);

  const comments = useMemo(() => feedbackMap[designId] ?? [], [designId, feedbackMap]);

  const addFeedback = (entry: { author: string; message: string; rating: number }) => {
    const nextEntry: DesignFeedback = {
      id: `${designId}-${Date.now()}`,
      designId,
      author: entry.author.trim() || 'Anonymous',
      message: entry.message.trim(),
      rating: Math.max(1, Math.min(5, Math.round(entry.rating || 0))),
      createdAt: new Date().toISOString(),
    };

    const nextMap = {
      ...feedbackMap,
      [designId]: [nextEntry, ...(feedbackMap[designId] ?? [])],
    };

    setFeedbackMap(nextMap);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMap));
    }
  };

  return {
    comments,
    commentsCount: comments.length,
    hydrated,
    addFeedback,
  };
}
