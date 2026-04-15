import { useEffect, useMemo, useState } from 'react';
import { listDesignFeedback, submitDesignFeedback, type DesignFeedbackEntry } from '@/src/services/engagement';

export function useFeedback(designId: string) {
  const [feedbackMap, setFeedbackMap] = useState<Record<string, DesignFeedbackEntry[]>>({});
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    setHydrated(false);

    void listDesignFeedback(designId)
      .then((comments) => {
        if (!active) {
          return;
        }

        setFeedbackMap((current) => ({
          ...current,
          [designId]: comments,
        }));
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setFeedbackMap((current) => ({
          ...current,
          [designId]: [],
        }));
      })
      .finally(() => {
        if (active) {
          setHydrated(true);
        }
      });

    return () => {
      active = false;
    };
  }, [designId]);

  const comments = useMemo(() => feedbackMap[designId] ?? [], [designId, feedbackMap]);

  const addFeedback = async (entry: { author: string; message: string; rating: number }) => {
    setSubmitting(true);

    try {
      const nextEntry = await submitDesignFeedback({
        designId,
        author: entry.author,
        message: entry.message,
        rating: entry.rating,
      });

      setFeedbackMap((current) => ({
        ...current,
        [designId]: [nextEntry, ...(current[designId] ?? [])],
      }));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    comments,
    commentsCount: comments.length,
    hydrated,
    submitting,
    addFeedback,
  };
}
