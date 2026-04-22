import type { Language } from "../types";

interface SessionHeaderProps {
  language: Language;
  sessionId: string | null;
  selectedDressLabel: string;
  onLanguageChange: (language: Language) => void;
  onNewSession: () => void;
}

export function SessionHeader({
  language,
  sessionId,
  selectedDressLabel,
  onLanguageChange,
  onNewSession,
}: SessionHeaderProps) {
  return (
    <header className="hero-panel">
      <div className="hero-copy">
        <span className="eyebrow">Glowmia AI Agent</span>
        <h1>{language === "ar" ? "مساعدة أزياء ذكية بلمسة أنيقة" : "An elegant AI fashion assistant for dress discovery and styling"}</h1>
        <p dir={language === "ar" ? "rtl" : "ltr"}>
          {language === "ar"
            ? "واجهة تجريبية مستقلة لاختبار المحادثة، والترشيحات من Supabase، وتعديل نفس صورة الفستان المختار."
            : "A standalone demo to test chat, Supabase-powered recommendations, and editing the same selected dress image."}
        </p>
      </div>

      <div className="hero-controls">
        <div className="language-switcher">
          <button type="button" className={language === "en" ? "lang-button active" : "lang-button"} onClick={() => onLanguageChange("en")}>
            EN
          </button>
          <button type="button" className={language === "ar" ? "lang-button active" : "lang-button"} onClick={() => onLanguageChange("ar")}>
            AR
          </button>
        </div>

        <div className="session-card">
          <span className="section-label">{language === "ar" ? "الجلسة الحالية" : "Current session"}</span>
          <strong>{sessionId ?? "..."}</strong>
          <span className="selected-summary">{selectedDressLabel}</span>
          <button type="button" className="secondary-button" onClick={onNewSession}>
            {language === "ar" ? "جلسة جديدة" : "New session"}
          </button>
        </div>
      </div>
    </header>
  );
}
