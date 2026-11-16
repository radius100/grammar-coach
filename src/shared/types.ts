export type SupportedLanguage = 'ru' | 'en';

export interface GrammarIssue {
  /** Точная цитата с ошибкой из текста (надежнее, чем индексы символов от LLM) */
  quote: string;
  /** Стандартизированный код правила для группировки, например: EN_ARTICLE_THE, RU_COMMA_PARTICIPLE */
  ruleCode: string;
  /** Краткое объяснение сути ошибки (1-2 предложения) */
  explanation: string;
  /** Наводящая подсказка без готового ответа */
  hint: string;
}

export interface GrammarCheckResponse {
  language: SupportedLanguage;
  issues: GrammarIssue[];
}

/** Запись в базе ошибок для алгоритма интервальных повторений (SM-2) */
export interface SavedMistakeRecord {
  ruleCode: string;
  language: SupportedLanguage;
  lastQuote: string;
  explanation: string;
  errorCount: number;
  /** Интервал до следующего повторения в днях */
  intervalDays: number;
  /** Timestamp (ms) следующей проверки памяти */
  nextReviewAt: number;
}