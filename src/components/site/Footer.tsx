import Image from 'next/image';
import Link from 'next/link';
import { glowmiaCopy, copyFor } from '@/src/content/glowmia';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="5" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="16.7" cy="7.3" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SnapchatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3.75c-2.25 0-3.9 1.66-3.9 4.18v2.28c0 .72-.42 1.18-1.16 1.42l-1.05.34c.62 1.22 1.7 1.8 2.82 2.05-.24.56-.72 1.02-1.42 1.34 1.26.33 2.3.35 3.12.08.5.62.98.82 1.59.82s1.09-.2 1.59-.82c.82.27 1.86.25 3.12-.08-.7-.32-1.18-.78-1.42-1.34 1.12-.25 2.2-.83 2.82-2.05l-1.05-.34c-.74-.24-1.16-.7-1.16-1.42V7.93c0-2.52-1.65-4.18-3.9-4.18Z" />
      <path d="M9.8 8.5h.02" />
      <path d="M14.18 8.5h.02" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M13.2 4v11.1a3.8 3.8 0 1 1-3.8-3.8c.42 0 .82.07 1.2.19" />
      <path d="M13.2 4c.56 2.8 2.2 4.46 4.9 4.95" />
      <path d="M18.1 8.95v2.55c-1.98-.1-3.6-.8-4.9-2.1" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M14.2 8.2h2.2V4.7h-2.6c-2.8 0-4.4 1.67-4.4 4.45v2.05H7.1v3.65h2.3V20h4.05v-5.15h2.68l.47-3.65h-3.15V9.62c0-.92.28-1.42.75-1.42Z" />
    </svg>
  );
}

const socialLinks = [
  { label: 'Instagram', href: '#', Icon: InstagramIcon },
  { label: 'Snapchat', href: '#', Icon: SnapchatIcon },
  { label: 'TikTok', href: '#', Icon: TikTokIcon },
  { label: 'Facebook', href: '#', Icon: FacebookIcon },
];

export function SiteFooter() {
  const { language } = useSitePreferencesContext();

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <span className="site-footer__mark">
            G
          </span>
          <div className="site-footer__brand-copy">
            <p className="site-footer__logo">Glowmia</p>
            <p className="site-footer__strapline">{copyFor(language, glowmiaCopy.footer.strapline)}</p>
          </div>
        </div>

        <div className="site-footer__meta">
          <div className="site-footer__socials">
            {socialLinks.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                title={label}
                className="site-footer__social-link"
              >
                <Icon className="site-footer__social-icon" />
              </a>
            ))}
          </div>
          <p className="site-footer__copyright">{copyFor(language, glowmiaCopy.footer.copyright)}</p>
          <Link
            href="https://queuesolutions.org/"
            target="_blank"
            rel="noreferrer"
            className="site-footer__credit"
          >
            <Image
              src="/dresses/covers/queue-logo.jpeg"
              alt="Queue Solutions"
              width={22}
              height={22}
              className="site-footer__credit-logo"
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
