import type { SupportedLanguage } from './types';

const CYRILLIC = /[а-яё]/i;

/** 'ru', если в тексте есть кириллица, иначе 'en'. */
export function detectLanguage(text: string): SupportedLanguage {
  return CYRILLIC.test(text) ? 'ru' : 'en';
}
