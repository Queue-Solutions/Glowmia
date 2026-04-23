import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Ruler, X } from 'lucide-react';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';

const sizeChartRows = [
  { alpha: 'S', bust: '86 - 90', hips: '91 - 95', waist: '66 - 70' },
  { alpha: 'M', bust: '90 - 94', hips: '95 - 99', waist: '70 - 74' },
  { alpha: 'L', bust: '94 - 100', hips: '99 - 105', waist: '74 - 80' },
  { alpha: 'XL', bust: '100 - 106', hips: '105 - 111', waist: '80 - 86' },
] as const;

const copyByLanguage = {
  en: {
    trigger: 'Size chart',
    title: 'Size chart',
    subtitle: 'Measurements are in centimeters.',
    alpha: 'ALPHA',
    bust: 'Bust',
    hips: 'Hips',
    waist: 'Waist',
    close: 'Close',
  },
  ar: {
    trigger: 'جدول المقاسات',
    title: 'جدول المقاسات',
    subtitle: 'جميع القياسات بالسنتيمتر.',
    alpha: 'ALPHA',
    bust: 'الصدر',
    hips: 'الورك',
    waist: 'الخصر',
    close: 'إغلاق',
  },
} as const;

type SizeChartButtonProps = {
  compact?: boolean;
};

export function SizeChartButton({ compact = false }: SizeChartButtonProps) {
  const { language } = useSitePreferencesContext();
  const [open, setOpen] = useState(false);
  const copy = copyByLanguage[language];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--text-primary)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] ${
          compact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'
        }`}
      >
        <Ruler className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        <span>{copy.trigger}</span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90]"
          >
            <button
              type="button"
              className="absolute inset-0 bg-[rgba(16,10,9,0.55)] backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
              aria-label={copy.close}
            />

            <div className="absolute inset-3 flex items-center justify-center md:inset-8">
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="relative w-full max-w-2xl overflow-hidden rounded-[1.8rem] border border-[color:var(--line)] bg-[color:var(--surface-base)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.24)] md:p-6"
                role="dialog"
                aria-modal="true"
                aria-label={copy.title}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-display text-3xl text-[color:var(--text-primary)]">{copy.title}</h3>
                    <p className="text-sm text-[color:var(--text-muted)]">{copy.subtitle}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--text-primary)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                    aria-label={copy.close}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="overflow-hidden rounded-[1.4rem] border border-[color:var(--line)]">
                  <table className="w-full border-collapse text-center text-sm text-[color:var(--text-primary)]">
                    <thead className="bg-[color:var(--surface-elevated)]">
                      <tr>
                        <th className="px-4 py-4 font-semibold">{copy.alpha}</th>
                        <th className="px-4 py-4 font-semibold">{copy.bust}</th>
                        <th className="px-4 py-4 font-semibold">{copy.hips}</th>
                        <th className="px-4 py-4 font-semibold">{copy.waist}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sizeChartRows.map((row, index) => (
                        <tr
                          key={row.alpha}
                          className={index % 2 === 0 ? 'bg-[color:var(--surface)]' : 'bg-[color:var(--surface-elevated)]/55'}
                        >
                          <td className="px-4 py-4 font-semibold">{row.alpha}</td>
                          <td className="px-4 py-4">{row.bust}</td>
                          <td className="px-4 py-4">{row.hips}</td>
                          <td className="px-4 py-4">{row.waist}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
