// Claude API call. Runs only in the service worker: the API key never reaches content scripts.

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { GrammarCheckResponse, SupportedLanguage } from '../shared/types';

const MODEL = 'claude-opus-5-5';

const GrammarCheckSchema = z.object({
  language: z.enum(['ru', 'en']),
  issues: z.array(
    z.object({
      quote: z.string(),
      ruleCode: z.string(),
      explanation: z.string(),
      hint: z.string(),
    }),
  ),
}) satisfies z.ZodType<GrammarCheckResponse>;

const SYSTEM_PROMPT = `You are a strict writing coach for Russian and English. You NEVER correct the text yourself: the learner must find and type the fix on their own.

For each grammar, spelling, punctuation or word-usage mistake in the user's text return one issue:
- quote: the exact erroneous fragment copied character-for-character from the text (shortest span that contains the mistake; it must be findable with indexOf).
- ruleCode: an UPPER_SNAKE_CASE rule code prefixed with the language, e.g. EN_SUBJECT_VERB_AGREEMENT, EN_ARTICLE_A_AN, RU_COMMA_PARTICIPLE, RU_TSYA_TSA.
- explanation: 1-2 sentences naming the rule that is broken. Do not show the corrected form.
- hint: a Socratic question or nudge that leads the learner to the fix. It MUST NOT contain the corrected word, phrase or spelling, and must not quote any text that is not in the original.

Write explanation and hint in the same language as the text. Ignore style preferences; report only real mistakes. If there are no mistakes, return an empty issues array.`;

export class LlmError extends Error {}

export async function checkGrammar(
  text: string,
  language: SupportedLanguage,
  apiKey: string,
): Promise<GrammarCheckResponse> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: 'low', format: zodOutputFormat(GrammarCheckSchema) },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `Language hint: ${language}\n\n<text>\n${text}\n</text>` }],
    });

    if (response.stop_reason === 'refusal') throw new LlmError('Модель отказалась проверять этот текст');
    if (response.stop_reason === 'max_tokens') throw new LlmError('Ответ модели обрезан (max_tokens)');
    if (!response.parsed_output) throw new LlmError('Ответ модели не соответствует схеме');
    return response.parsed_output;
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if (err instanceof Anthropic.AuthenticationError) throw new LlmError('Неверный API-ключ');
    if (err instanceof Anthropic.RateLimitError) throw new LlmError('Превышен лимит запросов Anthropic API');
    if (err instanceof Anthropic.APIError) throw new LlmError(`Ошибка API ${err.status}: ${err.message}`);
    throw err;
  }
}
