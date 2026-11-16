# ADR-002: Contract First и привязка ошибок по точной цитате

- **Статус:** Принято
- **Контекст:** Ответ LLM, сообщения content ↔ background и модели storage используются в нескольких частях
  расширения, и их расхождение ломает всё молча. LLM плохо считает смещения символов, а текст в поле меняется,
  пока идёт проверка.
- **Решение:**
  - `src/shared/types.ts` — единственный источник типов: `GrammarIssue`, `GrammarCheckResponse`,
    `ContentToBackgroundMessage`, `MessageResponseMap` / `ResponseFor`, `StorageSchema`, `SessionStorageSchema`.
  - Порядок изменений: сначала контракт в `types.ts`, затем код. В `types.ts` только типы, runtime-хелперы
    лежат в соседних файлах `src/shared/*`.
  - Zod-схема ответа в `src/background/llm.ts` сверяется с контрактом через `satisfies z.ZodType<GrammarCheckResponse>`.
  - Ошибка привязывается к тексту через `text.indexOf(issue.quote)`. `filterIssues` в `src/shared/issue-filter.ts`
    отбрасывает issue без найденной цитаты и с подсказкой, раскрывающей ответ (`hintLeaksAnswer`).
  - Перед показом content script заново привязывает issues к текущему тексту поля (он мог измениться за время запроса):
    `anchorIssues` в `src/shared/anchor.ts` возвращает `AnchoredIssue[]`. Смещения `start` / `end` в нём вычислены
    локально через `indexOf(quote)`; одинаковые цитаты занимают последовательные вхождения, пересечения отбрасываются.
- **Запрещено:**
  - Переобъявлять эти интерфейсы в других файлах или писать ad-hoc типы сообщений.
  - Принимать от LLM индексы и смещения символов и привязываться по ним.
  - Помещать функции и константы в `types.ts`.
  - Показывать issue, если `hint` содержит исправленную форму, или просить LLM вернуть исправление.
