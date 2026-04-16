'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Menu,
  RotateCcw,
  Sparkles,
  Star,
  Wand2,
  X,
} from 'lucide-react';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';
import {
  createAgentSession,
  requestAgentEdit,
  requestAgentRecommendations,
  type AgentDress,
  type AgentEditResponse,
} from '@/src/services/glowmiaAgent';
import { submitAgentFeedback } from '@/src/services/engagement';

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

const suggestionsFooterByLanguage = {
  en: {
    title: 'Try me.',
    text: 'Pick one suggestion or send a short note and I will start styling from there.',
  },
  ar: {
    title: 'جرّبيني.',
    text: 'اختاري أحد الاقتراحات أو ابدئي برسالة قصيرة وسأرتب لك الإطلالة من هنا.',
  },
} as const;

const copyByLanguage = {
  en: {
    eyebrow: 'Glowmia Stylist',
    sessionTitle: 'Glowmia Website Session',
    greeting: "Try me. Let's create a dress that feels made for you.",
    connecting: 'Connecting stylist',
    connected: 'Stylist ready',
    recommendationMode: 'Recommendations',
    editMode: 'Editing',
    railTitle: 'Stylist workspace',
    railDescription: 'Start with a mood, pin a look, then keep refining it in one thread.',
    promptTitle: 'Start with a prompt',
    promptDescription: 'Pick a suggestion or write your own request.',
    historyTitle: 'Recent looks',
    historyEmpty: 'Recommended looks from this session will appear here.',
    selectedDressTitle: 'Pinned look',
    selectedDressDescription: 'Your selected dress stays here while the chat continues.',
    clearSelection: 'Clear selection',
    newChat: 'New chat',
    collapseSidebar: 'Collapse sidebar',
    expandSidebar: 'Expand sidebar',
    composerPlaceholder: 'Ask for a dress recommendation...',
    composerEditPlaceholder: 'Describe the change you want...',
    send: 'Send',
    sending: 'Sending...',
    applyEdit: 'Apply edit',
    recommendationsHeading: 'Recommended looks',
    recommendationsDescription: 'Choose a cover look, then continue refining the full dress inside the same chat.',
    noResults:
      "I couldn't find a close match for that request. Try adjusting the occasion, color, silhouette, or fabric.",
    editThisDress: 'Edit this look',
    editingPickedDress: 'Selected for edits',
    editNoImageReturned: 'The edit request finished, but no edited image was returned.',
    selectDressMessage: (dressName: string) =>
      `Perfect. "${dressName}" is pinned now. Tell me what you want to change and I'll keep working on the full dress.`,
    editResultHeading: (dressName: string) => `Edited result for ${dressName}`,
    originalImage: 'Current look',
    editedImage: 'Updated look',
    appliedEdits: 'Applied edits',
    loadingMessage: 'Glowmia Stylist is working on it...',
    retryConnection: 'Retry connection',
    connectionError: 'Unable to reach the stylist service right now.',
    emptyEditStateTitle: 'Pick a look to shape',
    emptyEditStateDescription:
      'Once you choose a recommendation, the full dress appears here for edits and follow-up changes.',
    resultMetaFallback: 'Signature dress',
    openRail: 'Open stylist sidebar',
    closeRail: 'Close stylist sidebar',
    introTitle: 'Create a look with Glowmia',
    introDescription:
      'Describe the event, the silhouette, or the mood you want. I will suggest cover looks from the collection and keep the selected dress ready for edits.',
    suggestions: [
      'I need an elegant evening dress in black for a formal dinner.',
      'Show me a soft gold dress for an engagement celebration.',
      'I want a modest silhouette with long sleeves for an evening event.',
    ],
    editSuggestions: ['Make it deep burgundy.', 'Add long sleeves.', 'Give it a more fitted silhouette.'],
    howItWorksTitle: 'How it works',
    howItWorksSteps: [
      'Describe the occasion, color, fit, or feeling you want.',
      'Review the recommended cover looks from the collection.',
      'Choose one look and continue editing the full dress in the same thread.',
    ],
    feedbackTitle: 'How was Glowmia Stylist?',
    feedbackDescription: 'Rate this session and leave a quick note for the team.',
    feedbackPlaceholder: 'Anything you want us to improve?',
    feedbackSubmit: 'Send feedback',
    feedbackLater: 'Rate later',
    feedbackThanks: 'Thank you. Your feedback is saved.',
    feedbackHint: 'Choose up to five stars.',
    feedbackError: 'Unable to save your feedback right now.',
  },
  ar: {
    eyebrow: 'Glowmia Stylist',
    sessionTitle: 'جلسة Glowmia داخل الموقع',
    greeting: 'جرّبيني. لنصمم معًا فستانًا مميزًا يليق بك.',
    connecting: 'جارٍ تجهيز المنسقة',
    connected: 'المنسقة جاهزة',
    recommendationMode: 'الترشيحات',
    editMode: 'التعديل',
    railTitle: 'مساحة المنسقة',
    railDescription: 'ابدئي بالمزاج أو المناسبة، ثبتي الإطلالة التي تعجبك، ثم كمّلي التعديل داخل نفس المحادثة.',
    promptTitle: 'ابدئي من هنا',
    promptDescription: 'اختاري اقتراحًا سريعًا أو اكتبي طلبك بطريقتك.',
    historyTitle: 'آخر الإطلالات',
    historyEmpty: 'ستظهر هنا الإطلالات المقترحة من هذه الجلسة.',
    selectedDressTitle: 'الإطلالة المثبتة',
    selectedDressDescription: 'يبقى الفستان المختار هنا بينما تتابعين المحادثة على الجهة الأخرى.',
    clearSelection: 'إلغاء التثبيت',
    newChat: 'محادثة جديدة',
    collapseSidebar: 'تصغير الشريط الجانبي',
    expandSidebar: 'توسيع الشريط الجانبي',
    composerPlaceholder: 'اطلبي ترشيح فستان...',
    composerEditPlaceholder: 'صفي التعديل الذي تريدينه...',
    send: 'إرسال',
    sending: 'جارٍ الإرسال...',
    applyEdit: 'تنفيذ التعديل',
    recommendationsHeading: 'الترشيحات المقترحة',
    recommendationsDescription: 'اختاري صورة الغلاف أولًا، ثم واصلي تعديل الفستان الكامل داخل نفس المحادثة.',
    noResults: 'لم أجد فستانًا قريبًا من هذا الطلب. جرّبي تعديل المناسبة أو اللون أو القصة أو الخامة.',
    editThisDress: 'تعديل هذه الإطلالة',
    editingPickedDress: 'مختار للتعديلات',
    editNoImageReturned: 'اكتمل طلب التعديل لكن لم يتم إرجاع صورة معدلة.',
    selectDressMessage: (dressName: string) =>
      `ممتاز. تم تثبيت "${dressName}" الآن. اذكري التعديلات التي تريدينها وسأكمل العمل على الفستان الكامل.`,
    editResultHeading: (dressName: string) => `النتيجة المعدلة لـ ${dressName}`,
    originalImage: 'الإطلالة الحالية',
    editedImage: 'الإطلالة بعد التعديل',
    appliedEdits: 'التعديلات المطبقة',
    loadingMessage: 'Glowmia Stylist يعمل الآن...',
    retryConnection: 'إعادة المحاولة',
    connectionError: 'تعذر الوصول إلى خدمة المنسقة الآن.',
    emptyEditStateTitle: 'اختاري إطلالة لنبدأ بها',
    emptyEditStateDescription: 'بعد اختيار أحد الترشيحات سيظهر الفستان الكامل هنا لتكملي عليه التعديلات والمتابعة.',
    resultMetaFallback: 'فستان مميز',
    openRail: 'فتح الشريط الجانبي',
    closeRail: 'إغلاق الشريط الجانبي',
    introTitle: 'اصنعي إطلالتك مع Glowmia',
    introDescription:
      'صفي المناسبة أو القصة أو الإحساس الذي تريدينه. سأقترح عليك صور غلاف من المجموعة وأبقي الفستان المختار جاهزًا للتعديل.',
    suggestions: [
      'أريد فستانًا أسود أنيقًا لعشاء رسمي.',
      'اعرضي لي فستانًا ذهبيًا ناعمًا لحفل خطوبة.',
      'أريد قصة محتشمة بأكمام طويلة لمناسبة مسائية.',
    ],
    editSuggestions: ['اجعليه خمريًا.', 'أضيفي أكمامًا طويلة.', 'اجعلي القصة أكثر تحديدًا.'],
    howItWorksTitle: 'كيف تعمل التجربة',
    howItWorksSteps: [
      'اذكري المناسبة أو اللون أو القصة أو الإحساس الذي تريدينه.',
      'استعرضي صور الغلاف المقترحة من المجموعة.',
      'اختاري تصميمًا واحدًا ثم واصلي تعديل الفستان الكامل داخل نفس المحادثة.',
    ],
    feedbackTitle: 'كيف كانت تجربة Glowmia Stylist؟',
    feedbackDescription: 'قيّمي الجلسة واتركي ملاحظة سريعة للفريق.',
    feedbackPlaceholder: 'هل هناك شيء تريدين تحسينه؟',
    feedbackSubmit: 'إرسال التقييم',
    feedbackLater: 'أقيّم لاحقًا',
    feedbackThanks: 'شكرًا لك. تم حفظ رأيك.',
    feedbackHint: 'اختاري حتى خمس نجوم.',
    feedbackError: 'تعذر حفظ رأيك الآن.',
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

function getRecommendationImageUrl(dress: AgentDress) {
  return dress.cover_image_url || dress.image_url;
}

function getEditingImageUrl(dress: AgentDress) {
  return dress.detail_image_url || dress.image_url;
}

export function AgentExperience() {
  const { language } = useSitePreferencesContext();
  const copy = copyByLanguage[language];

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [selectedDress, setSelectedDress] = useState<AgentDress | null>(null);
  const [mode, setMode] = useState<AgentMode>('recommend');
  const [error, setError] = useState('');
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
  const [agentRating, setAgentRating] = useState(0);
  const [hoveredAgentRating, setHoveredAgentRating] = useState(0);
  const [agentFeedback, setAgentFeedback] = useState('');
  const [feedbackState, setFeedbackState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const previousLanguageRef = useRef(language);
  const suggestionsFooter = suggestionsFooterByLanguage[language];

  const activeSuggestions = useMemo(
    () => (mode === 'edit' && selectedDress ? copy.editSuggestions : copy.suggestions),
    [copy.editSuggestions, copy.suggestions, mode, selectedDress],
  );

  const historyItems = useMemo(
    () =>
      Array.from(
        new Map(
          messages
            .filter((message) => message.type === 'recommend' && message.role === 'assistant')
            .flatMap((message) => (message.type === 'recommend' ? message.data : []))
            .map((dress) => [dress.id, dress]),
        ).values(),
      ).slice(0, 8),
    [messages],
  );
  const hasEditResult = useMemo(() => messages.some((message) => message.type === 'edit'), [messages]);
  const shouldShowFeedbackPrompt = hasEditResult && !feedbackDismissed && feedbackState !== 'saved';
  const activeAgentRating = hoveredAgentRating || agentRating;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading, error]);

  useEffect(() => {
    const element = composerRef.current;

    if (!element) {
      return;
    }

    element.style.height = '0px';
    element.style.height = `${Math.min(element.scrollHeight, 176)}px`;
  }, [input, language, mode, selectedDress]);

  useEffect(() => {
    void initializeSession();
  }, []);

  useEffect(() => {
    if (previousLanguageRef.current === language) {
      return;
    }

    previousLanguageRef.current = language;
    void initializeSession();
  }, [language]);

  async function initializeSession() {
    setBootstrapping(true);
    setError('');
    setSelectedDress(null);
    setMode('recommend');
    setInput('');
    setMobileRailOpen(false);
    setAgentRating(0);
    setHoveredAgentRating(0);
    setAgentFeedback('');
    setFeedbackState('idle');
    setFeedbackDismissed(false);

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
    setMobileRailOpen(false);

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
    setMobileRailOpen(false);
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
          imageUrl: getEditingImageUrl(selectedDress),
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
          setFeedbackDismissed(false);
          setFeedbackState('idle');
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

  function handlePromptClick(prompt: string) {
    setInput(prompt);
    setMobileRailOpen(false);
  }

  async function handleSubmitSessionFeedback() {
    if (!hasEditResult || agentRating < 1 || feedbackState === 'saving') {
      return;
    }

    setFeedbackState('saving');

    try {
      await submitAgentFeedback({
        sessionId,
        language,
        rating: agentRating,
        message: agentFeedback,
      });
      setFeedbackState('saved');
      setFeedbackDismissed(true);
    } catch {
      setFeedbackState('error');
    }
  }

  const showEmptyIntro = messages.length <= 1 && !loading;

  return (
    <section className="mx-auto w-full max-w-7xl px-5 pb-10 md:px-10">
      <div className="agent-shell">
        <motion.header
          className="agent-shell__hero text-center"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="eyebrow-chip">
            <Sparkles className="h-4 w-4" />
            {copy.eyebrow}
          </span>
        </motion.header>

        <motion.div
          className="agent-console"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
        >
          <button
            type="button"
            className={`agent-mobile-rail-backdrop ${mobileRailOpen ? 'is-open' : ''}`}
            onClick={() => setMobileRailOpen(false)}
            aria-hidden={!mobileRailOpen}
            tabIndex={mobileRailOpen ? 0 : -1}
          />

          <aside className={`agent-console__rail ${mobileRailOpen ? 'is-open' : ''}`}>
            <div className="agent-console__rail-head">
              <div className="agent-console__brand">
                <span className="agent-console__brand-mark" aria-hidden="true">
                  <Sparkles className="h-4 w-4" />
                </span>

                <div className="agent-console__brand-copy">
                  <span className="agent-console__brand-text font-display">Glowmia</span>
                  <span className="agent-console__brand-subtitle">{copy.railTitle}</span>
                </div>
              </div>

              <div className="agent-console__rail-actions">
                <button
                  type="button"
                  className="agent-console__icon-button agent-console__icon-button--mobile"
                  onClick={() => setMobileRailOpen(false)}
                  aria-label={copy.closeRail}
                  title={copy.closeRail}
                >
                  {language === 'ar'
                    ? <ChevronRight className="h-4 w-4" />
                    : <ChevronLeft className="h-4 w-4" />}
                </button>

                <button
                  type="button"
                  className="agent-console__icon-button"
                  onClick={() => void initializeSession()}
                  disabled={loading || bootstrapping}
                  aria-label={copy.newChat}
                  title={copy.newChat}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>

              <>
                <section className="agent-console__section agent-console__section--intro">
                  <div className="agent-console__status-row">
                    <span className={`agent-console__badge ${sessionId && !bootstrapping ? 'agent-console__badge--ready' : ''}`}>
                      {bootstrapping ? copy.connecting : copy.connected}
                    </span>
                    <span className="agent-console__badge">{mode === 'edit' ? copy.editMode : copy.recommendationMode}</span>
                  </div>

                  <div className="agent-console__headline">
                    <h2>{copy.introTitle}</h2>
                    <p>{copy.introDescription}</p>
                  </div>
                </section>

                <section className="agent-console__section">
                  <div className="agent-console__section-head">
                    <h2>{copy.promptTitle}</h2>
                  </div>
                  <p className="agent-console__section-copy">{copy.promptDescription}</p>

                  <div className="agent-prompt-list">
                    {activeSuggestions.map((prompt) => (
                      <button key={prompt} type="button" className="agent-prompt" onClick={() => handlePromptClick(prompt)}>
                        <ArrowUpRight className="h-4 w-4 shrink-0" />
                        <span>{prompt}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="agent-console__section">
                  <div className="agent-console__section-head">
                    <h2>{copy.historyTitle}</h2>
                  </div>

                  {historyItems.length > 0 ? (
                    <ul className="agent-chat-history__list">
                      {historyItems.map((dress) => (
                        <li key={dress.id}>
                          <button
                            type="button"
                            className={`agent-chat-history__item ${selectedDress?.id === dress.id ? 'agent-chat-history__item--active' : ''}`}
                            onClick={() => handleSelectDressForEdit(dress)}
                            title={localizeDressName(dress, language)}
                          >
                            <span className="agent-chat-history__item-text">{localizeDressName(dress, language)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="agent-console__mini-empty">
                      <p>{copy.historyEmpty}</p>
                    </div>
                  )}
                </section>

                <section className="agent-console__section">
                  <div className="agent-console__section-head">
                    <h2>{copy.selectedDressTitle}</h2>
                    {selectedDress ? (
                      <button type="button" className="agent-console__ghost" onClick={handleClearSelection}>
                        {copy.clearSelection}
                      </button>
                    ) : null}
                  </div>

                  {selectedDress ? (
                    <div className="agent-current-look">
                      <img
                        src={getEditingImageUrl(selectedDress)}
                        alt={localizeDressName(selectedDress, language)}
                        className="agent-current-look__image"
                      />

                      <div className="space-y-3">
                        <div>
                          <p className="agent-current-look__label">{copy.editingPickedDress}</p>
                          <h3 className="agent-current-look__title">{localizeDressName(selectedDress, language)}</h3>
                          <p className="agent-current-look__description">{copy.selectedDressDescription}</p>
                        </div>

                        <div className="agent-tag-list">
                          {buildDressMeta(selectedDress, language).map((item) => (
                            <span key={item} className="agent-tag">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="agent-empty-state">
                      <Wand2 className="h-5 w-5" />
                      <div className="space-y-2">
                        <h3>{copy.emptyEditStateTitle}</h3>
                        <p>{copy.emptyEditStateDescription}</p>
                      </div>
                    </div>
                  )}
                </section>

                <section className="agent-console__section">
                  <div className="agent-console__section-head">
                    <h2>{copy.howItWorksTitle}</h2>
                  </div>

                  <ol className="agent-step-list">
                    {copy.howItWorksSteps.map((step) => (
                      <li key={step} className="agent-step-item">
                        <span className="agent-step-item__icon">
                          <CheckCircle2 className="h-4 w-4" />
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              </>
          </aside>

          <div className="agent-console__chat">
            <header className="agent-chat-head">
              <div className="agent-chat-head__identity">
                <button
                  type="button"
                  className="agent-chat-head__rail-toggle"
                  onClick={() => setMobileRailOpen((current) => !current)}
                  aria-label={mobileRailOpen ? copy.closeRail : copy.openRail}
                >
                  {mobileRailOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </button>

                <span className="agent-chat-head__avatar">
                  <Bot className="h-5 w-5" />
                </span>

                <div className="agent-chat-head__copy">
                  <h2 className="font-display">Glowmia Stylist</h2>
                  <p>{mode === 'edit' && selectedDress ? copy.selectedDressDescription : copy.recommendationsDescription}</p>
                </div>
              </div>

              <div className="agent-chat-head__actions">
                <span className="agent-chat-head__mode-pill">{mode === 'edit' ? copy.editMode : copy.recommendationMode}</span>
                <button
                  type="button"
                  className="agent-chat-head__new-chat"
                  onClick={() => void initializeSession()}
                  disabled={loading || bootstrapping}
                  title={copy.newChat}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="agent-chat-log no-scrollbar">
              {showEmptyIntro ? (
                <div className="agent-chat-suggestions">
                  <div className="agent-chat-suggestions__content">
                    <div className="agent-chat-suggestions__intro">
                      <span className="agent-chat-suggestions__intro-badge">
                        <Sparkles className="h-4 w-4" />
                        {copy.eyebrow}
                      </span>
                      <h3>{copy.introTitle}</h3>
                      <p>{copy.introDescription}</p>
                    </div>

                    <div className="agent-chat-suggestions__grid">
                      {activeSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          className="agent-chat-suggestion-item"
                          onClick={() => setInput(suggestion)}
                        >
                          <Sparkles className="h-4 w-4" />
                          <span>{suggestion}</span>
                        </button>
                      ))}
                    </div>

                    <div className="agent-chat-suggestions__footer">
                      <strong>{suggestionsFooter.title}</strong>
                      <p>{suggestionsFooter.text}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {messages.map((message) => {
                const isUser = message.role === 'user';
                const hideInEmptyState =
                  showEmptyIntro &&
                  message.role === 'assistant' &&
                  message.type === 'text' &&
                  message.text === copy.greeting;

                if (hideInEmptyState) {
                  return null;
                }

                return (
                  <div key={message.id} className={`agent-message-row ${isUser ? 'agent-message-row--user' : ''}`}>
                    {message.type === 'text' ? (
                      <div className={`agent-message-bubble ${isUser ? 'agent-message-bubble--user' : 'agent-message-bubble--assistant'}`}>
                        {message.text}
                      </div>
                    ) : null}

                    {message.type === 'recommend' ? (
                      <div className="agent-message-panel">
                        <div className="agent-message-panel__header">
                          <span className="agent-message-panel__kicker">{copy.recommendationsHeading}</span>
                          <p>{copy.recommendationsDescription}</p>
                        </div>

                        <div className="agent-card-grid">
                          {message.data.map((dress) => {
                            const dressName = localizeDressName(dress, language);
                            const description = localizeDressDescription(dress, language);
                            const meta = buildDressMeta(dress, language);
                            const isSelected = selectedDress?.id === dress.id;

                            return (
                              <article key={dress.id} className={`agent-card ${isSelected ? 'agent-card--selected' : ''}`}>
                                <img src={getRecommendationImageUrl(dress)} alt={dressName} className="agent-card__image" />

                                <div className="agent-card__body">
                                  <div className="space-y-3">
                                    <div className="space-y-2">
                                      <div className="agent-card__topline">
                                        <h3>{dressName}</h3>
                                        <span className="agent-card__pill">{localizeDressCategory(dress, copy.resultMetaFallback)}</span>
                                      </div>

                                      {description ? <p className="agent-card__copy">{description}</p> : null}
                                    </div>

                                    {meta.length > 0 ? (
                                      <div className="agent-tag-list">
                                        {meta.map((item) => (
                                          <span key={item} className="agent-tag">
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
                      <div className="agent-message-panel">
                        <div className="agent-message-panel__header">
                          <span className="agent-message-panel__kicker">{copy.editResultHeading(message.data.dressName)}</span>
                          <p>{message.data.message}</p>
                        </div>

                        <div className="agent-edit-grid">
                          <div className="agent-edit-card">
                            <p className="agent-edit-card__label">{copy.originalImage}</p>
                            <img src={message.data.original_image_url} alt={copy.originalImage} className="agent-edit-card__image" />
                          </div>

                          <div className="agent-edit-card">
                            <p className="agent-edit-card__label">{copy.editedImage}</p>
                            <img
                              src={message.data.edited_image_url || message.data.original_image_url}
                              alt={copy.editedImage}
                              className="agent-edit-card__image"
                            />
                          </div>
                        </div>

                        {Object.keys(message.data.parsed_edits ?? {}).length > 0 ? (
                          <div className="space-y-3">
                            <p className="agent-edit-card__label">{copy.appliedEdits}</p>
                            <div className="agent-tag-list">
                              {Object.entries(message.data.parsed_edits).map(([key, value]) => (
                                <span key={key} className="agent-tag">
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
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="agent-loading"
                  >
                    <div className="agent-loading__pill">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{copy.loadingMessage}</span>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div ref={chatEndRef} />
            </div>

            {error ? (
              <div className="agent-error">
                <span>{error}</span>
                <button type="button" className="secondary-button" onClick={() => void initializeSession()}>
                  {copy.retryConnection}
                </button>
              </div>
            ) : null}

            {shouldShowFeedbackPrompt ? (
              <div className="agent-feedback-panel">
                <div className="agent-feedback-panel__head">
                  <div>
                    <h3>{copy.feedbackTitle}</h3>
                    <p>{copy.feedbackDescription}</p>
                  </div>
                </div>

                <div className="agent-feedback-panel__body">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-[color:var(--text-muted)]">{language === 'ar' ? 'التقييم' : 'Rating'}</span>
                      <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">{copy.feedbackHint}</span>
                    </div>

                    <div className="feedback-stars" onMouseLeave={() => setHoveredAgentRating(0)}>
                      {Array.from({ length: 5 }, (_, index) => {
                        const value = index + 1;
                        const filled = value <= activeAgentRating;
                        const isPerfect = activeAgentRating === 5 && value === 5;

                        return (
                          <button
                            key={`agent-feedback-star-${value}`}
                            type="button"
                            onMouseEnter={() => setHoveredAgentRating(value)}
                            onFocus={() => setHoveredAgentRating(value)}
                            onClick={() => {
                              setAgentRating(value);
                              setFeedbackState('idle');
                            }}
                            className={`feedback-star-button ${filled ? 'feedback-star-button--active' : ''} ${isPerfect ? 'feedback-star-button--perfect' : ''}`}
                            aria-label={`${value} ${language === 'ar' ? 'نجوم' : 'stars'}`}
                          >
                            <Star className={`h-6 w-6 ${filled ? 'fill-current' : ''}`} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="agent-feedback-panel__form">
                    <input
                      value={agentFeedback}
                      onChange={(event) => {
                        setAgentFeedback(event.target.value);
                        setFeedbackState('idle');
                      }}
                      placeholder={copy.feedbackPlaceholder}
                      className="field-input"
                    />

                    <div className="agent-feedback-panel__actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setFeedbackDismissed(true);
                          setFeedbackState('idle');
                        }}
                        disabled={feedbackState === 'saving'}
                      >
                        {copy.feedbackLater}
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void handleSubmitSessionFeedback()}
                        disabled={agentRating < 1 || feedbackState === 'saving'}
                      >
                        {feedbackState === 'saving'
                          ? language === 'ar'
                            ? 'جارٍ الحفظ...'
                            : 'Saving...'
                          : copy.feedbackSubmit}
                      </button>
                    </div>
                  </div>

                  {feedbackState === 'error' ? <p className="agent-feedback-panel__error">{copy.feedbackError}</p> : null}
                </div>
              </div>
            ) : null}

            <div className="agent-composer">
              {selectedDress ? (
                <div className="agent-composer__context">
                  <span className="agent-composer__context-pill">{copy.editMode}</span>
                  <span className="agent-composer__context-name">{localizeDressName(selectedDress, language)}</span>
                </div>
              ) : null}

              <label htmlFor="agent-composer-input" className="sr-only">
                Glowmia Stylist input
              </label>
              <textarea
                id="agent-composer-input"
                ref={composerRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={mode === 'edit' && selectedDress ? copy.composerEditPlaceholder : copy.composerPlaceholder}
                className="agent-composer__input no-scrollbar"
                rows={1}
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
