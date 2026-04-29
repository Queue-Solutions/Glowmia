import Image from 'next/image';
import Link from 'next/link';
import { glowmiaCopy, copyFor } from '@/src/content/glowmia';
import { NewsletterSignup } from '@/src/components/site/NewsletterSignup';
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

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M13.2 4v11.1a3.8 3.8 0 1 1-3.8-3.8c.42 0 .82.07 1.2.19" />
      <path d="M13.2 4c.56 2.8 2.2 4.46 4.9 4.95" />
      <path d="M18.1 8.95v2.55c-1.98-.1-3.6-.8-4.9-2.1" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M4.5 7l7.5 6 7.5-6" />
    </svg>
  );
}

const socialLinks = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/glowmia.sa?igsh=NXB1eG1nODVmYXd4',
    Icon: InstagramIcon,
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@glowmia.sa?_r=1&_t=ZS-95lFRnH2fDe',
    Icon: TikTokIcon,
  },
  {
    label: 'Email',
    href: 'mailto:glowmia.sa@hotmail.com',
    Icon: MailIcon,
  },
];

export function SiteFooter() {
  const { language } = useSitePreferencesContext();

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <Link href="/" aria-label="Glowmia" className="site-footer__mark">
            <Image src="/glowmia-logo.svg" alt="Glowmia" width={164} height={44} className="site-footer__brand-logo" />
          </Link>
          <div className="site-footer__brand-copy">
            <p className="site-footer__strapline">{copyFor(language, glowmiaCopy.footer.strapline)}</p>
          </div>
        </div>

        <NewsletterSignup />

        <div className="site-footer__meta">
          <div className="site-footer__socials">
            {socialLinks.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                title={label}
                className="site-footer__social-link"
                target={href.startsWith('http') ? '_blank' : undefined}
                rel={href.startsWith('http') ? 'noreferrer' : undefined}
              >
                <Icon className="site-footer__social-icon" />
              </a>
            ))}
          </div>
          <a href="mailto:glowmia.sa@hotmail.com" className="site-footer__contact">
            glowmia.sa@hotmail.com
          </a>
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
