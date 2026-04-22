import type { MessageBubble } from "../types";

interface ChatMessageProps {
  message: MessageBubble;
  onSelectDress: (dressId: string, imageUrl?: string | null) => void;
  selectedDressId: string | null;
  language: "en" | "ar";
}

const TOOL_LABELS = {
  llm: "LLM",
  recommend: "Recommend",
  edit: "Edit",
  styling: "Styling",
} as const;

export function ChatMessage({ message, onSelectDress, selectedDressId, language }: ChatMessageProps) {
  return (
    <article className={`message-card ${message.role === "assistant" ? "assistant-card" : "user-card"}`}>
      <div className="message-meta">
        <span className="message-role">{message.role === "assistant" ? "Glowmia" : language === "ar" ? "أنتِ" : "You"}</span>
        {message.tool ? <span className="tool-badge">{TOOL_LABELS[message.tool]}</span> : null}
      </div>
      <p className="message-content" dir={language === "ar" ? "rtl" : "ltr"}>
        {message.content}
      </p>

      {message.dresses?.length ? (
        <div className="dress-grid">
          {message.dresses.map((dress) => {
            const isSelected = selectedDressId === dress.id;
            const previewImage = dress.front_view_url ?? dress.image_url ?? dress.cover_image_url;
            return (
              <button
                key={dress.id}
                type="button"
                className={`dress-card ${isSelected ? "dress-card-selected" : ""}`}
                onClick={() => onSelectDress(dress.id, previewImage)}
              >
                {previewImage ? <img src={previewImage} alt={dress.name} className="dress-image" /> : <div className="dress-image placeholder-block" />}
                <div className="dress-details">
                  <div className="dress-title-row">
                    <h3>{dress.name}</h3>
                    {isSelected ? <span className="selected-pill">{language === "ar" ? "مختار" : "Selected"}</span> : null}
                  </div>
                  <p>{dress.description || (language === "ar" ? "فستان من المجموعة الحالية." : "Dress from the current catalog.")}</p>
                  <div className="dress-tags">
                    {dress.color ? <span>{dress.color}</span> : null}
                    {dress.occasion ? <span>{dress.occasion}</span> : null}
                    {dress.style ? <span>{dress.style}</span> : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {message.editedImageUrl ? (
        <div className="edited-result">
          <span className="section-label">{language === "ar" ? "نتيجة التعديل" : "Edited result"}</span>
          <img src={message.editedImageUrl} alt="Edited dress result" className="edited-image" />
        </div>
      ) : null}
    </article>
  );
}
