import { FormEvent } from "react";

import type { Language } from "../types";

interface ChatComposerProps {
  language: Language;
  value: string;
  isLoading: boolean;
  onChange: (nextValue: string) => void;
  onSubmit: () => void;
}

export function ChatComposer({
  language,
  value,
  isLoading,
  onChange,
  onSubmit,
}: ChatComposerProps) {
  const placeholder =
    language === "ar"
      ? "اكتبي طلبك هنا: ترشيح، تنسيق، أو تعديل للفستان المختار..."
      : "Ask for recommendations, styling advice, or edit the selected dress...";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="chat-composer" onSubmit={handleSubmit}>
      <textarea
        className="chat-input"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        dir={language === "ar" ? "rtl" : "ltr"}
      />
      <button className="primary-button" type="submit" disabled={isLoading || !value.trim()}>
        {isLoading ? (language === "ar" ? "جارٍ الإرسال..." : "Sending...") : language === "ar" ? "إرسال" : "Send"}
      </button>
    </form>
  );
}
