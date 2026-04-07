import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { glowmiaCopy, copyFor } from '@/src/content/glowmia';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';
import { useFeedback } from '@/src/hooks/useFeedback';

type FeedbackSectionProps = {
  designId: string;
};

export function FeedbackSection({ designId }: FeedbackSectionProps) {
  const { language } = useSitePreferencesContext();
  const { comments, addFeedback } = useFeedback(designId);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);

  const activeRating = hoveredRating || rating;
  const ratingLabel = language === 'ar' ? 'التقييم' : 'Rating';
  const ratingHint = language === 'ar' ? 'مرري على النجوم ثم اختاري تقييمك.' : 'Hover and choose up to five stars.';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!message.trim() || rating < 1) {
      return;
    }

    addFeedback({ author: name, message, rating });
    setName('');
    setMessage('');
    setRating(0);
    setHoveredRating(0);
  };

  return (
    <section className="space-y-6 rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] px-6 py-6 md:px-8">
      <div className="space-y-2">
        <h2 className="font-display text-4xl text-[color:var(--text-primary)]">
          {copyFor(language, glowmiaCopy.feedback.title)}
        </h2>
        <p className="text-base leading-8 text-[color:var(--text-muted)]">
          {copyFor(language, glowmiaCopy.feedback.description)}
        </p>
      </div>

      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="rounded-[1.4rem] border border-dashed border-[color:var(--line)] px-4 py-5 text-sm text-[color:var(--text-muted)]">
            {copyFor(language, glowmiaCopy.feedback.empty)}
          </p>
        ) : (
          comments.map((comment) => (
            <article key={comment.id} className="rounded-[1.4rem] border border-[color:var(--line)] px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <p className="font-medium text-[color:var(--text-primary)]">{comment.author}</p>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }, (_, index) => {
                      const filled = index < comment.rating;
                      return (
                        <Star
                          key={`${comment.id}-star-${index + 1}`}
                          className={`h-4 w-4 ${filled ? 'fill-current text-[color:var(--accent)]' : 'text-[color:var(--line)]'}`}
                        />
                      );
                    })}
                  </div>
                </div>

                <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
                  {new Date(comment.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <p className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]">{comment.message}</p>
            </article>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4">
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-muted)]">{copyFor(language, glowmiaCopy.feedback.nameLabel)}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={copyFor(language, glowmiaCopy.feedback.namePlaceholder)}
              className="field-input"
            />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-[color:var(--text-muted)]">{ratingLabel}</span>
              <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">{ratingHint}</span>
            </div>

            <div
              className="feedback-stars"
              onMouseLeave={() => setHoveredRating(0)}
              role="radiogroup"
              aria-label={ratingLabel}
            >
              {Array.from({ length: 5 }, (_, index) => {
                const value = index + 1;
                const filled = value <= activeRating;
                const isPerfect = activeRating === 5 && value === 5;

                return (
                  <motion.button
                    key={`rating-${value}`}
                    type="button"
                    onMouseEnter={() => setHoveredRating(value)}
                    onFocus={() => setHoveredRating(value)}
                    onClick={() => setRating(value)}
                    whileHover={{ y: -1.5, scale: 1.04 }}
                    whileTap={{ scale: 0.95 }}
                    animate={isPerfect ? { scale: [1, 1.08, 1], filter: ['brightness(1)', 'brightness(1.18)', 'brightness(1)'] } : { scale: 1, filter: 'brightness(1)' }}
                    transition={isPerfect ? { duration: 0.32, ease: 'easeOut' } : { duration: 0.12 }}
                    className={`feedback-star-button ${filled ? 'feedback-star-button--active' : ''} ${isPerfect ? 'feedback-star-button--perfect' : ''}`}
                    role="radio"
                    aria-checked={rating === value}
                    aria-label={`${value} ${language === 'ar' ? 'نجوم' : 'stars'}`}
                  >
                    <Star className={`h-6 w-6 ${filled ? 'fill-current' : ''}`} />
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="md:self-end">
            <button type="submit" className="primary-button" disabled={rating < 1 || !message.trim()}>
              {copyFor(language, glowmiaCopy.feedback.submit)}
            </button>
          </div>
        </div>

        <label className="space-y-2 md:row-span-3">
          <span className="text-sm text-[color:var(--text-muted)]">{copyFor(language, glowmiaCopy.feedback.messageLabel)}</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={copyFor(language, glowmiaCopy.feedback.messagePlaceholder)}
            rows={5}
            className="field-input min-h-[10rem] resize-y"
          />
        </label>
      </form>
    </section>
  );
}
