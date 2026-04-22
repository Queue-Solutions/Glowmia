import { useEffect, useState, useTransition } from "react";

import { createSession, sendMessage } from "./api/client";
import { ChatComposer } from "./components/ChatComposer";
import { ChatMessage } from "./components/ChatMessage";
import { SessionHeader } from "./components/SessionHeader";
import type { Dress, Language, MessageBubble } from "./types";

const WELCOME_MESSAGES: Record<Language, string> = {
  en: "Tell me the occasion, preferred colors, or ask me to edit a selected dress image.",
  ar: "أخبريني بالمناسبة أو الألوان المفضلة، أو اطلبي تعديل صورة الفستان المختار.",
};

function App() {
  const [language, setLanguage] = useState<Language>("en");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<MessageBubble[]>([]);
  const [selectedDress, setSelectedDress] = useState<Dress | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void initializeSession(language);
  }, []);

  async function initializeSession(nextLanguage: Language) {
    try {
      setError(null);
      const session = await createSession(nextLanguage);
      setLanguage(session.language);
      setSessionId(session.session_id);
      setSelectedDress(null);
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: WELCOME_MESSAGES[nextLanguage],
          tool: "llm",
          intent: "chat",
        },
      ]);
    } catch (sessionError) {
      setLanguage(nextLanguage);
      setSessionId(null);
      setSelectedDress(null);
      setMessages([]);
      setError(
        sessionError instanceof Error
          ? sessionError.message
          : nextLanguage === "ar"
            ? "تعذر إنشاء الجلسة. تأكدي من تشغيل الخادم الخلفي."
            : "Unable to create a session. Make sure the backend is running.",
      );
    }
  }

  function handleLanguageChange(nextLanguage: Language) {
    startTransition(() => {
      void initializeSession(nextLanguage);
    });
  }

  function handleSelectDress(dressId: string, imageUrl?: string | null) {
    const candidate = messages
      .flatMap((message) => message.dresses ?? [])
      .find((dress) => dress.id === dressId);

    setSelectedDress(candidate ? { ...candidate, image_url: imageUrl ?? candidate.image_url } : { id: dressId, name: dressId, image_url: imageUrl });
  }

  function appendUserMessage(content: string) {
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "user",
        content,
      },
    ]);
  }

  async function handleSubmit() {
    if (!draft.trim() || !sessionId) {
      return;
    }

    const message = draft.trim();
    setDraft("");
    setError(null);
    appendUserMessage(message);

    startTransition(() => {
      void (async () => {
        try {
          const response = await sendMessage({
            sessionId,
            message,
            language,
            selectedDressId: selectedDress?.id ?? null,
            selectedDressImageUrl: selectedDress?.front_view_url ?? selectedDress?.image_url ?? null,
          });

          setMessages((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: response.message,
              tool: response.tool,
              intent: response.intent,
              dresses: response.dresses,
              editedImageUrl: response.edited_image_url,
            },
          ]);

          if (response.edited_image_url && selectedDress) {
            setSelectedDress({
              ...selectedDress,
              image_url: response.edited_image_url,
              front_view_url: response.edited_image_url,
            });
          }

          if (response.selected_dress_id && selectedDress && response.selected_dress_id !== selectedDress.id) {
            setSelectedDress({ ...selectedDress, id: response.selected_dress_id });
          }
        } catch (requestError) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : language === "ar"
                ? "حدث خطأ أثناء التواصل مع الخادم."
                : "Something went wrong while contacting the backend.",
          );
        }
      })();
    });
  }

  const selectedDressLabel = selectedDress
    ? language === "ar"
      ? `الفستان المختار: ${selectedDress.name}`
      : `Selected dress: ${selectedDress.name}`
    : language === "ar"
      ? "لم يتم اختيار فستان بعد"
      : "No dress selected yet";

  return (
    <div className="page-shell" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <main className="app-frame">
        <SessionHeader
          language={language}
          sessionId={sessionId}
          selectedDressLabel={selectedDressLabel}
          onLanguageChange={handleLanguageChange}
          onNewSession={() => startTransition(() => void initializeSession(language))}
        />

        <section className="workspace-grid">
          <div className="chat-panel">
            <div className="panel-header">
              <div>
                <span className="section-label">{language === "ar" ? "المحادثة" : "Conversation"}</span>
                <h2>{language === "ar" ? "اختبري الوكيل الذكي" : "Test the AI agent"}</h2>
              </div>
              <span className="status-dot">{isPending ? (language === "ar" ? "جارٍ المعالجة" : "Processing") : language === "ar" ? "جاهز" : "Ready"}</span>
            </div>

            <div className="messages-list">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onSelectDress={handleSelectDress}
                  selectedDressId={selectedDress?.id ?? null}
                  language={language}
                />
              ))}
            </div>

            <ChatComposer language={language} value={draft} isLoading={isPending} onChange={setDraft} onSubmit={handleSubmit} />
            {error ? <p className="error-banner">{error}</p> : null}
          </div>

          <aside className="insight-panel">
            <div className="insight-card">
              <span className="section-label">{language === "ar" ? "حدود النظام" : "System rules"}</span>
              <ul>
                <li>{language === "ar" ? "الترشيحات تأتي فقط من Supabase." : "Recommendations come only from Supabase."}</li>
                <li>{language === "ar" ? "التعديل يغيّر نفس صورة الفستان المختار فقط." : "Edits modify the same selected dress image only."}</li>
                <li>{language === "ar" ? "كل رسالة تُظهر الأداة المستخدمة." : "Each reply exposes the handling tool."}</li>
              </ul>
            </div>

            <div className="insight-card selected-card">
              <span className="section-label">{language === "ar" ? "الفستان المختار" : "Selected dress"}</span>
              {selectedDress?.image_url ? <img src={selectedDress.image_url} alt={selectedDress.name} className="selected-preview" /> : <div className="selected-preview placeholder-block" />}
              <h3>{selectedDress?.name ?? (language === "ar" ? "لا يوجد اختيار" : "Nothing selected")}</h3>
              <p dir={language === "ar" ? "rtl" : "ltr"}>
                {language === "ar"
                  ? "اختاري بطاقة من الترشيحات ثم اطلبي تغيير اللون أو القماش أو اللمسة البصرية."
                  : "Pick a recommendation card, then ask to change the color, fabric, or visual finish."}
              </p>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

export default App;
