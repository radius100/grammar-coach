# ADR-004: Хранение типов ошибок и повторение по SM-2

- **Статус:** Принято
- **Контекст:** Расширение обучает письму, поэтому типы ошибок пользователя нужно сохранять и возвращать ему
  на повторение с интервалами (spaced repetition). Исправленный текст при этом пользователю не показывается:
  он вспоминает и вводит его сам (см. Product Invariants в `CLAUDE.md`).
- **Решение:**
  - Ключ записи — `${language}:${ruleCode}` (`SavedMistakeRecord.id`); «тип ошибки» = `ruleCode` + язык.
  - Единственный писатель `mistakes` в `chrome.storage.local` — background. Сохранение происходит в `handleCheckText`
    сразу после `filterIssues`, поэтому гонок между content и popup нет.
  - Чистая логика живёт в `src/shared/mistakes.ts` (`upsertMistakes`, `selectDueMistakes`, `countDue`) и
    `src/shared/sm2.ts` (`applySm2Review`) и тестируется без chrome API. Работа со storage — в
    `src/background/mistake-store.ts`.
  - `upsertMistakes` повторно прогоняет `filterIssues`: в базу не попадает issue без цитаты в тексте или с подсказкой,
    содержащей ответ. Несколько issues с одним id в одной проверке считаются один раз.
  - Дедупликация по `lastQuote`: повтор той же проверки не накручивает `errorCount` и не сбрасывает SM-2.
    Если `quote !== lastQuote`, то `errorCount++`, `repetitions = 0`, `intervalDays = 0`, `nextReviewAt = now`;
    `easeFactor` существующей записи не меняется, у новой равен `2.5`.
  - В запись сохраняется `lastHint` (уже отфильтрованная подсказка) для карточки повторения.
  - Popup отправляет оценку сообщением `REVIEW_MISTAKE` (`PopupToBackgroundMessage`); список читает напрямую из
    `chrome.storage.local` (только чтение).
  - Карточка повторения в popup показывает `ruleCode`, объяснение, исходную цитату пользователя и подсказку, а также
    собственное поле для ручного ввода. Самооценка тремя кнопками: «Не вспомнил» → quality 1, «С трудом» → 3,
    «Легко» → 5.
  - SM-2 стандартный: `q < 3` → `repetitions = 0`, `intervalDays = 1`; иначе `repetitions + 1`, интервал 1 (n=1),
    6 (n=2), `round(prev * EF)`, где `EF` — старый. Затем
    `EF = max(1.3, EF + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))`.
    `nextReviewAt = now + intervalDays * 86_400_000`, `lastReviewedAt = now`.
  - Напоминание: `chrome.alarms` `sm2-due-check` каждые 60 минут; после каждого upsert/review и по alarm обновляется
    бейдж `chrome.action.setBadgeText` числом записей с `nextReviewAt <= now`. Требует permission `alarms`.
- **Запрещено:**
  - Писать `mistakes` из content script или popup.
  - Показывать в карточке исправленную форму, а также автоматически проверять или заполнять поле ввода пользователя.
  - Сохранять issues, не прошедшие `filterIssues`.
  - Использовать таймеры (`setTimeout` / `setInterval`) вместо `chrome.alarms`.
