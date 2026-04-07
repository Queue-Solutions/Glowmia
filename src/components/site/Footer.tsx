import Image from 'next/image';
import Link from 'next/link';
import { glowmiaCopy, copyFor } from '@/src/content/glowmia';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';

export function SiteFooter() {
  const { language } = useSitePreferencesContext();

  return (
    <footer className="border-t border-[color:var(--line)]/90">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-[color:var(--text-muted)] md:flex-row md:items-center md:justify-between md:px-10">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--line)] bg-[color:var(--surface-elevated)] font-display text-xl text-[color:var(--text-primary)]">
            G
          </span>
          <div>
            <p className="font-display text-2xl text-[color:var(--text-primary)]">Glowmia</p>
            <p className="mt-1 max-w-md">{copyFor(language, glowmiaCopy.footer.strapline)}</p>
          </div>
        </div>
        <div className="space-y-2 md:text-end">
          <p>{copyFor(language, glowmiaCopy.footer.copyright)}</p>
          <Link
            href="https://queuesolutions.org/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-[color:var(--text-muted)] transition-colors duration-200 hover:text-[color:var(--text-primary)]"
          >
            <Image
              src="/dresses/covers/queue-logo.jpeg"
              alt="Queue Solutions"
              width={22}
              height={22}
              className="h-[1.15rem] w-[1.15rem] rounded-full object-cover opacity-90"
            />
            <span className="font-medium">
              {language === 'ar' ? 'تم الإنشاء بواسطة Queue Solutions' : 'Created by Queue Solutions'}
            </span>
          </Link>
        </div>
      </div>
    </footer>
  );
}
