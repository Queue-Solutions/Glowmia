'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Bot, CheckCircle2, Loader2, RotateCcw, Sparkles, Wand2 } from 'lucide-react';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';
import {
  createAgentSession,
  requestAgentEdit,
  requestAgentRecommendations,
  type AgentDress,
  type AgentEditResponse,
} from '@/src/services/glowmiaAgent';

type AgentMode = 'recommend' | 'edit';

type AgentTextMessage = {
  id: string;
  role: 'assistant' | 'user';
  type: 'text';
  text: string;
};

type AgentRecommendationMessage = {
  id: string;
  role: 'assistant';
  type: 'recommend';
  data: AgentDress[];
};

type AgentEditMessage = {
  id: string;
  role: 'assistant';
  type: 'edit';
  data: AgentEditResponse & { dressName: string };
};

type AgentMessage = AgentTextMessage | AgentRecommendationMessage | AgentEditMessage;

const agentPageCopy = {
  en: {
    eyebrow: 'Glowmia Stylist',
    title: 'Describe the dress mood you want, then refine it inside the same conversation.',
    description:
      'Glowmia Stylist helps with recommendations in English or Arabic, then keeps the selected look open for follow-up edits without leaving the page.',
    liveBadge: 'Live styling flow',
    liveTitle: 'One conversation from discovery to visual edit.',
    liveDescription:
      'Ask for an occasion, silhouette, or color story. When a look feels close, open it for edits like sleeve changes, color updates, or finish adjustments.',
    promptTitle: 'Try a starting prompt',
    promptDescription: 'Use a ready-made direction or write your own request below.',
    sessionTitle: 'Glowmia Website Session',
    greeting:
      "Hello, I'm your Glowmia stylist. Ask for a dress recommendation in English or Arabic, then choose a look to refine it here.",
    connecting: 'Connecting stylist',
    connected: 'Stylist ready',
    recommendationMode: 'Recommendation mode',
    editMode: 'Edit mode',
    howItWorksTitle: 'How it works',
    howItWorksSteps: [
      'Share the event, color, shape, or mood.',
      'Review suggested dresses from the collection.',
      'Select one look and request visual changes in the same thread.',
    ],
    selectedDressTitle: 'Selected for editing',
    selectedDressDescription: 'Further edits will be applied to this look until you clear it.',
    clearSelection: 'Cancel edit',
    resetSession: 'Start new session',
    composerPlaceholder: 'Ask for a dress recommendation...',
    composerEditPlaceholder: 'Describe the edit you want to make...',
    send: 'Send',
    sending: 'Sending...',
    applyEdit: 'Apply edit',
    recommendationsHeading: 'Recommended looks',
    recommendationsDescription: 'Select a look to continue with refinements inside the conversation.',
    noResults:
      "I couldn't find a close match for that request. Try adjusting the occasion, color, silhouette, or fabric.",
    editThisDress: 'Edit this look',
    editingPickedDress: 'Ready for refinements',
    editNoImageReturned: 'The edit request finished, but no edited image was returned.',
    selectDressMessage: (dressName: string) =>
      `Selected "${dressName}" for editing. You can now ask for changes like "make it burgundy" or "add long sleeves".`,
    editResultHeading: (dressName: string) => `Edited result for ${dressName}`,
    originalImage: 'Current look',
    editedImage: 'Updated look',
    appliedEdits: 'Applied edits',
    loadingMessage: 'Glowmia Stylist is working on it...',
    retryConnection: 'Retry connection',
    connectionError: 'Unable to reach the stylist service right now.',
    emptyEditStateTitle: 'Pick a look to edit',
    emptyEditStateDescription: 'Recommendations you select will stay here while you keep refining them.',
    resultMetaFallback: 'Signature dress',
    suggestions: [
      'I need an elegant evening dress in black for a formal dinner.',
      'Show me a soft gold dress for an engagement celebration.',
      'I want a modest silhouette with long sleeves for an evening event.',
    ],
    editSuggestions: ['Make it deep burgundy.', 'Add long sleeves.', 'Give it a more fitted silhouette.'],
  },
  ar: {
    eyebrow: 'Glowmia Stylist',
    title: 'صفي الإطلالة التي تريدينها ثم كمّلي التعديل داخل نفس المحادثة.',
    description:
      'يساعدك Glowmia Stylist في ترشيح الفساتين بالعربية أو الإنجليزية، ثم يترك التصميم المختار جاهزاً للتعديلات اللاحقة داخل الصفحة نفسها.',
    liveBadge: 'تجربة تنسيق مباشرة',
    liveTitle: 'محادثة واحدة من الاكتشاف إلى التعديل البصري.',
    liveDescription:
      'اطلبي المناسبة أو القصة اللونية أو القصة العامة للفستان. وعندما يقترب الترشيح من ذوقك، افتحيه للتعديل مثل تغيير اللون أو الأكمام أو اللمسة النهائية.',
    promptTitle: 'ابدئي من اقتراح جاهز',
    promptDescription: 'اختاري اتجاهاً سريعاً أو اكتبي طلبك الخاص في الأسفل.',
    sessionTitle: 'جلسة Glowmia في الموقع',
    greeting:
      'مرحباً، أنا منسقة Glowmia. اطلبي ترشيح فستان بالعربية أو الإنجليزية، ثم اختاري التصميم الذي تريدين تعديله داخل هذه المحادثة.',
    connecting: 'جارٍ تجهيز المنسقة',
    connected: 'المنسقة جاهزة',
    recommendationMode: 'وضع الترشيح',
    editMode: 'وضع التعديل',
    howItWorksTitle: 'كيف تعمل التجربة',
    howItWorksSteps: [
      'اذكري المناسبة أو اللون أو القصة أو المزاج العام.',
      'استعرضي الفساتين المقترحة من المجموعة.',
      'اختاري فستاناً واحداً واطلبي تعديلات بصرية داخل نفس المحادثة.',
    ],
    selectedDressTitle: 'الفستان المختار للتعديل',
    selectedDressDescription: 'ستُطبَّق التعديلات التالية على هذا التصميم حتى تقومي بإلغاء الاختيار.',
    clearSelection: 'إلغاء التعديل',
    resetSession: 'بدء جلسة جديدة',
    composerPlaceholder: 'اطلبي ترشيح فستان...',
    composerEditPlaceholder: 'صفي التعديل الذي تريدينه...',
    send: 'إرسال',
    sending: 'جارٍ الإرسال...',
    applyEdit: 'تنفيذ التعديل',
    recommendationsHeading: 'الترشيحات المقترحة',
    recommendationsDescription: 'اختاري التصميم الأنسب ثم تابعي التعديلات داخل نفس المحادثة.',
    noResults: 'لم أجد فستاناً قريباً من هذا الطلب. جربي تعديل المناسبة أو اللون أو القصة أو الخامة.',
    editThisDress: 'تعديل هذا التصميم',
    editingPickedDress: 'جاهز للتعديلات',
    editNoImageReturned: 'اكتمل طلب التعديل لكن لم يتم إرجاع صورة جديدة.',
    selectDressMessage: (dressName: string) =>
      `تم اختيار "${dressName}" للتعديل. يمكنك الآن طلب تغييرات مثل "اجعليه خمرياً" أو "أضيفي أكماماً طويلة".`,
    editResultHeading: (dressName: string) => `النتيجة المعدلة لـ ${dressName}`,
    originalImage: 'الإطلالة الحالية',
    editedImage: 'الإطلالة بعد التعديل',
    appliedEdits: 'التعديلات المطبقة',
    loadingMessage: 'Glowmia Stylist يعمل الآن...',
    retryConnection: 'إعادة المحاولة',
    connectionError: 'تعذر الوصول إلى خدمة المنسقة الآن.',
    emptyEditStateTitle: 'اختاري تصميماً للتعديل',
    emptyEditStateDescription: 'أي تصميم تختارينه من الترشيحات سيبقى هنا لتكملي عليه التعديلات.',
    resultMetaFallback: 'فستان مميز',
    suggestions: [
      'أريد فستاناً أسود أنيقاً لعشاء رسمي.',
      'اعرضي لي فستاناً ذهبياً ناعماً لحفل خطوبة.',
      'أريد قصة محتشمة بأكمام طويلة لمناسبة مسائية.',
    ],
    editSuggestions: ['اجعليه خمرياً.', 'أضيفي أكماماً طويلة.', 'اجعلي القصة أكثر تحديداً.'],
  },
} as const;

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(value: string | string[] | null | undefined, fallback = '') {
  if (Array.isArray(value)) {
    const joined = value
      .map((entry) => entry.trim())
      .filter(Boolean)
      .join(', ');
    return joined || fallback;
  }

  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function localizeDressName(dress: AgentDress, language: 'en' | 'ar') {
  return language === 'ar'
    ? normalizeText(dress.name_ar, normalizeText(dress.name, 'Glowmia Dress'))
    : normalizeText(dress.name, normalizeText(dress.name_ar, 'Glowmia Dress'));
}

function localizeDressDescription(dress: AgentDress, language: 'en' | 'ar') {
  return language === 'ar'
    ? normalizeText(dress.description_ar, normalizeText(dress.description))
    : normalizeText(dress.description, normalizeText(dress.description_ar));
}

function localizeDressCategory(dress: AgentDress, fallback: string) {
  return normalizeText(dress.category, fallback);
}

function buildDressMeta(dress: AgentDress, language: 'en' | 'ar') {
  const items =
    language === 'ar'
      ? [
          normalizeText(dress.color_ar, normalizeText(dress.color)),
          normalizeText(dress.occasion_ar, normalizeText(dress.occasion)),
          normalizeText(dress.style_ar, normalizeText(dress.style)),
        ]
      : [
          normalizeText(dress.color, normalizeText(dress.color_ar)),
          normalizeText(dress.occasion, normalizeText(dress.occasion_ar)),
          normalizeText(dress.style, normalizeText(dress.style_ar)),
        ];

  return items.filter(Boolean).slice(0, 3);
}

function formatParsedEditValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).join(', ');
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}

export function AgentExperience() {
  const { language } = useSitePreferencesContext();
  const copy = agentPageCopy[language];

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [selectedDress, setSelectedDress] = useState<AgentDress | null>(null);
  const [mode, setMode] = useState<AgentMode>('recommend');
  const [error, setError] = useState('');

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const activeSuggestions = useMemo(
    () => (mode === 'edit' && selectedDress ? copy.editSuggestions : copy.suggestions),
    [copy.editSuggestions, copy.suggestions, mode, selectedDress],
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading, selectedDress, error]);

  useEffect(() => {
    void initializeSession();
  }, []);

  async function initializeSession() {
    setBootstrapping(true);
    setError('');
    setSelectedDress(null);
    setMode('recommend');
    setInput('');

    try {
      const session = await createAgentSession(copy.sessionTitle);
      setSessionId(session.id);
      setMessages([
        {
          id: createMessageId(),
          role: 'assistant',
          type: 'text',
          text: copy.greeting,
        },
      ]);
    } catch (sessionError) {
      const detail = sessionError instanceof Error ? sessionError.message : copy.connectionError;
      setSessionId(null);
      setMessages([]);
      setError(detail);
    } finally {
      setBootstrapping(false);
    }
  }

  function appendMessage(message: AgentMessage) {
    setMessages((current) => [...current, message]);
  }

  function handleSelectDressForEdit(dress: AgentDress) {
    const dressName = localizeDressName(dress, language);
    setSelectedDress(dress);
    setMode('edit');
    setError('');

    appendMessage({
      id: createMessageId(),
      role: 'assistant',
      type: 'text',
      text: copy.selectDressMessage(dressName),
    });
  }

  function handleClearSelection() {
    setSelectedDress(null);
    setMode('recommend');
  }

  async function handleSend() {
    const trimmed = input.trim();

    if (!trimmed || !sessionId || loading) {
      return;
    }

    appendMessage({
      id: createMessageId(),
      role: 'user',
      type: 'text',
      text: trimmed,
    });

    setInput('');
    setLoading(true);
    setError('');

    try {
      if (mode === 'edit' && selectedDress) {
        const response = await requestAgentEdit(sessionId, {
          dressId: selectedDress.id,
          imageUrl: selectedDress.image_url,
          instruction: trimmed,
        });

        if (!response.edited_image_url) {
          appendMessage({
            id: createMessageId(),
            role: 'assistant',
            type: 'text',
            text: response.message || copy.editNoImageReturned,
          });
        } else {
          appendMessage({
            id: createMessageId(),
            role: 'assistant',
            type: 'edit',
            data: {
              ...response,
              dressName: localizeDressName(selectedDress, language),
            },
          });
        }

        return;
      }

      const response = await requestAgentRecommendations(sessionId, trimmed);
      const results = response.results ?? [];

      if (results.length === 0) {
        appendMessage({
          id: createMessageId(),
          role: 'assistant',
          type: 'text',
          text: copy.noResults,
        });
      } else {
        appendMessage({
          id: createMessageId(),
          role: 'assistant',
          type: 'recommend',
          data: results,
        });
      }
    } catch (requestError) {
      const detail = requestError instanceof Error ? requestError.message : copy.connectionError;
      setError(detail);

      appendMessage({
        id: createMessageId(),
        role: 'assistant',
        type: 'text',
        text: detail,
      });
    } finally {
      setLoading(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-6 pb-10 md:px-10">
      <div className="agent-page-shell">
        <motion.div
          className="agent-page-intro"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="space-y-5">
            <span className="eyebrow-chip">
              <Sparkles className="h-4 w-4" />
              {copy.eyebrow}
            </span>

            <div className="space-y-4">
              <h1 className="max-w-3xl font-display text-5xl leading-[0.94] tracking-[-0.04em] text-[color:var(--text-primary)] md:text-6xl">
                {copy.title}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[color:var(--text-muted)]">{copy.description}</p>
            </div>
          </div>

          <div className="agent-intro-note">
            <span className="agent-intro-note__badge">{copy.liveBadge}</span>
            <h2 className="font-display text-3xl leading-tight text-[color:var(--text-primary)]">{copy.liveTitle}</h2>
            <p className="text-base leading-7 text-[color:var(--text-muted)]">{copy.liveDescription}</p>
          </div>
        </motion.div>

        <motion.div
          className="agent-workspace"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
        >
          <aside className="agent-sidebar">
            <section className="agent-sidebar-block">
              <div className="agent-sidebar-block__header">
                <h2>{copy.promptTitle}</h2>
                <p>{copy.promptDescription}</p>
              </div>

              <div className="agent-prompt-list">
                {activeSuggestions.map((prompt) => (
                  <button key={prompt} type="button" className="agent-prompt-chip" onClick={() => setInput(prompt)}>
                    <ArrowUpRight className="h-4 w-4 shrink-0" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="agent-sidebar-block">
              <div className="agent-sidebar-block__header">
                <h2>{copy.howItWorksTitle}</h2>
              </div>

              <ol className="agent-steps">
                {copy.howItWorksSteps.map((step) => (
                  <li key={step} className="agent-step">
                    <span className="agent-step__icon">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="agent-sidebar-block">
              {selectedDress ? (
                <div className="agent-selected-dress">
                  <div className="agent-sidebar-block__header">
                    <h2>{copy.selectedDressTitle}</h2>
                    <p>{copy.selectedDressDescription}</p>
                  </div>

                  <div className="agent-selected-dress__card">
                    <img
                      src={selectedDress.image_url}
                      alt={localizeDressName(selectedDress, language)}
                      className="agent-selected-dress__image"
                    />

                    <div className="space-y-3">
                      <div>
                        <p className="agent-selected-dress__label">{copy.editingPickedDress}</p>
                        <h3 className="agent-selected-dress__name">{localizeDressName(selectedDress, language)}</h3>
                      </div>

                      <div className="agent-inline-tags">
                        {buildDressMeta(selectedDress, language).map((item) => (
                          <span key={item} className="agent-inline-tag">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button type="button" className="secondary-button w-full" onClick={handleClearSelection}>
                    {copy.clearSelection}
                  </button>
                </div>
              ) : (
                <div className="agent-empty-edit-state">
                  <Wand2 className="h-5 w-5" />
                  <div className="space-y-2">
                    <h3>{copy.emptyEditStateTitle}</h3>
                    <p>{copy.emptyEditStateDescription}</p>
                  </div>
                </div>
              )}
            </section>
          </aside>

          <div className="agent-chat-panel">
            <div className="agent-chat-panel__header">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="agent-avatar">
                    <Bot className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-display text-3xl leading-none text-[color:var(--text-primary)]">Glowmia Stylist</h2>
                  </div>
                </div>
              </div>

              <div className="agent-status-list">
                <span className={`agent-status-pill ${sessionId && !bootstrapping ? 'agent-status-pill--ready' : ''}`}>
                  {bootstrapping ? copy.connecting : copy.connected}
                </span>
                <span className="agent-status-pill">{mode === 'edit' ? copy.editMode : copy.recommendationMode}</span>
                <button type="button" className="agent-reset-button" onClick={() => void initializeSession()} disabled={loading || bootstrapping}>
                  <RotateCcw className="h-4 w-4" />
                  <span>{copy.resetSession}</span>
                </button>
              </div>
            </div>

            <div className="agent-chat-log no-scrollbar">
              {messages.map((message) => {
                const isUser = message.role === 'user';

                return (
                  <div key={message.id} className={`agent-message-row ${isUser ? 'agent-message-row--user' : ''}`}>
                    {message.type === 'text' ? (
                      <div className={`agent-message-bubble ${isUser ? 'agent-message-bubble--user' : 'agent-message-bubble--assistant'}`}>{message.text}</div>
                    ) : null}

                    {message.type === 'recommend' ? (
                      <div className="agent-rich-bubble">
                        <div className="agent-rich-bubble__header">
                          <span className="agent-rich-bubble__kicker">{copy.recommendationsHeading}</span>
                          <p>{copy.recommendationsDescription}</p>
                        </div>

                        <div className="agent-results-grid">
                          {message.data.map((dress) => {
                            const dressName = localizeDressName(dress, language);
                            const meta = buildDressMeta(dress, language);
                            const description = localizeDressDescription(dress, language);

                            return (
                              <article key={dress.id} className="agent-result-card">
                                <div className="agent-result-card__image-frame">
                                  <img src={dress.image_url} alt={dressName} className="agent-result-card__image" />
                                </div>

                                <div className="agent-result-card__body">
                                  <div className="space-y-3">
                                    <div className="space-y-2">
                                      <div className="agent-result-card__topline">
                                        <h3>{dressName}</h3>
                                        <span className="agent-result-card__category">{localizeDressCategory(dress, copy.resultMetaFallback)}</span>
                                      </div>

                                      {description ? <p className="agent-result-card__description">{description}</p> : null}
                                    </div>

                                    {meta.length > 0 ? (
                                      <div className="agent-inline-tags">
                                        {meta.map((item) => (
                                          <span key={item} className="agent-inline-tag">
                                            {item}
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>

                                  <button type="button" className="primary-button w-full" onClick={() => handleSelectDressForEdit(dress)}>
                                    {copy.editThisDress}
                                  </button>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {message.type === 'edit' ? (
                      <div className="agent-rich-bubble">
                        <div className="agent-rich-bubble__header">
                          <span className="agent-rich-bubble__kicker">{copy.editResultHeading(message.data.dressName)}</span>
                          <p>{message.data.message}</p>
                        </div>

                        <div className="agent-edit-grid">
                          <div className="agent-edit-image-card">
                            <p className="agent-edit-image-card__label">{copy.originalImage}</p>
                            <img src={message.data.original_image_url} alt={copy.originalImage} className="agent-edit-image-card__image" />
                          </div>

                          <div className="agent-edit-image-card">
                            <p className="agent-edit-image-card__label">{copy.editedImage}</p>
                            <img
                              src={message.data.edited_image_url || message.data.original_image_url}
                              alt={copy.editedImage}
                              className="agent-edit-image-card__image"
                            />
                          </div>
                        </div>

                        {Object.keys(message.data.parsed_edits ?? {}).length > 0 ? (
                          <div className="space-y-3">
                            <p className="agent-edit-image-card__label">{copy.appliedEdits}</p>
                            <div className="agent-inline-tags">
                              {Object.entries(message.data.parsed_edits).map(([key, value]) => (
                                <span key={key} className="agent-inline-tag">
                                  {key}: {formatParsedEditValue(value)}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              <AnimatePresence>
                {loading ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="agent-loading-row"
                  >
                    <div className="agent-loading-pill">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{copy.loadingMessage}</span>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div ref={chatEndRef} />
            </div>

            {error ? (
              <div className="agent-error-banner">
                <span>{error}</span>
                <button type="button" className="secondary-button" onClick={() => void initializeSession()}>
                  {copy.retryConnection}
                </button>
              </div>
            ) : null}

            <div className="agent-composer">
              <label htmlFor="agent-composer-input" className="sr-only">
                Glowmia Stylist input
              </label>
              <textarea
                id="agent-composer-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={mode === 'edit' && selectedDress ? copy.composerEditPlaceholder : copy.composerPlaceholder}
                className="agent-composer__input no-scrollbar"
                rows={3}
              />

              <button
                type="button"
                className="primary-button agent-composer__submit"
                onClick={() => void handleSend()}
                disabled={!input.trim() || loading || !sessionId || bootstrapping}
              >
                {loading ? copy.sending : mode === 'edit' ? copy.applyEdit : copy.send}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
