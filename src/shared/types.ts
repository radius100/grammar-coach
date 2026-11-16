// Single source of truth: LLM contract, extension messages, storage models.
// Types only: put runtime helpers in other src/shared/* files.

export type SupportedLanguage = 'ru' | 'en';

// ---------------------------------------------------------------------------
// LLM contract
// ---------------------------------------------------------------------------

export interface GrammarIssue {
  /**
   * Точная цитата с ошибкой из текста (надежнее, чем индексы символов от LLM).
   * Привязка к тексту: `text.indexOf(quote)`; если цитата не найдена, ошибка отбрасывается.
   */
  quote: string;
  /** Стандартизированный код правила для группировки, например: EN_ARTICLE_THE, RU_COMMA_PARTICIPLE */
  ruleCode: string;
  /** Краткое объяснение сути ошибки (1-2 предложения) */
  explanation: string;
  /** Наводящая подсказка без готового ответа */
  hint: string;
}

/**
 * Issue, привязанный к текущему тексту поля для подсветки.
 * Смещения вычислены локально через `text.indexOf(issue.quote)`, никогда не берутся от LLM.
 */
export interface AnchoredIssue {
  issue: GrammarIssue;
  /** Индекс начала quote в тексте поля (UTF-16 code units) */
  start: number;
  /** Индекс конца (не включительно): start + quote.length */
  end: number;
}

export interface GrammarCheckResponse {
  language: SupportedLanguage;
  issues: GrammarIssue[];
}

// ---------------------------------------------------------------------------
// Messages: Content Script -> Background Service Worker
// ---------------------------------------------------------------------------

export interface CheckTextMessage {
  type: 'CHECK_TEXT';
  payload: {
    text: string;
    language: SupportedLanguage;
    /** URL страницы, на которой набран текст */
    url: string;
  };
}

/** Все сообщения от content script к background (дискриминатор: `type`). */
export type ContentToBackgroundMessage = CheckTextMessage;

export type MessageResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; result: T })
  | { ok: false; error: string };

/** Тип ответа background для каждого типа сообщения. */
export interface MessageResponseMap {
  CHECK_TEXT: MessageResult<GrammarCheckResponse>;
}

export type ResponseFor<M extends ContentToBackgroundMessage> = MessageResponseMap[M['type']];

// ---------------------------------------------------------------------------
// Storage: spaced repetition (SM-2)
// ---------------------------------------------------------------------------

/** Оценка качества ответа в SM-2: 0 (полный провал) ... 5 (идеально). */
export type Sm2Quality = 0 | 1 | 2 | 3 | 4 | 5;

/** Запись в базе ошибок для алгоритма интервальных повторений (SM-2) */
export interface SavedMistakeRecord {
  /** Ключ записи: `${language}:${ruleCode}` */
  id: string;
  ruleCode: string;
  language: SupportedLanguage;
  /** Последняя цитата пользователя с этой ошибкой */
  lastQuote: string;
  explanation: string;
  /** Сколько раз ошибка встретилась в тексте */
  errorCount: number;
  /** Число успешных повторений подряд (n в SM-2), сбрасывается при quality < 3 */
  repetitions: number;
  /** Ease factor (EF в SM-2): старт 2.5, минимум 1.3 */
  easeFactor: number;
  /** Интервал до следующего повторения в днях */
  intervalDays: number;
  /** Timestamp (ms) следующей проверки памяти */
  nextReviewAt: number;
  /** Timestamp (ms) последнего повторения, null если повторений не было */
  lastReviewedAt: number | null;
  /** Timestamp (ms) первой фиксации ошибки */
  createdAt: number;
}

/** Схема chrome.storage.local */
export interface StorageSchema {
  mistakes: Record<string, SavedMistakeRecord>;
  /** Ключ Anthropic API; читается только в background. */
  apiKey?: string;
}

/** Схема chrome.storage.session (очищается при перезапуске браузера). */
export interface SessionStorageSchema {
  /** Timestamp (ms) последнего запроса к LLM по tabId — для rate limit. */
  lastRequestAt: Record<string, number>;
}
