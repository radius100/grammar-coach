# ADR-005: Отключение проверки на отдельных сайтах

- **Статус:** Принято
- **Контекст:** Пользователь хочет отключать проверку на отдельных сайтах (рабочие чаты, редакторы кода, банки).
  Настройка должна переживать перезапуск браузера и применяться без перезагрузки страницы. Текст с отключённого
  сайта не должен уходить в LLM.
- **Решение:**
  - Хранение: `StorageSchema.disabledSites?: string[]` в `chrome.storage.local` — список нормализованных hostname.
  - Нормализация: `normalizeHost(url)` принимает только `http:` / `https:`, возвращает `hostname` в нижнем регистре
    без ведущего `www.`, иначе `null`. `www.site.com` и `site.com` — один сайт.
  - Совпадение: сайт отключён, если host равен записи или оканчивается на `'.' + запись`. Popup всегда сохраняет точный
    host текущей вкладки (отключение `mail.google.com` не затрагивает `docs.google.com`).
  - Единственный писатель `disabledSites` — popup (как `apiKey`); content script и background только читают.
  - Content script кэширует флаг `siteDisabled` в модульной переменной (это не service worker), читает его при старте
    и обновляет через `chrome.storage.onChanged`. При отключении: `clearHighlights()`, `onInput` и `sendText`
    сразу выходят.
  - Защита в background: `handleCheckText` проверяет `isSiteDisabled(payload.url, disabledSites)` до `takeRateLimitSlot`
    и до вызова LLM, возвращает `{ ok: false, error }` и ничего не сохраняет.
  - Popup узнаёт URL текущей вкладки через `chrome.tabs.query({ active: true, currentWindow: true })` с permission
    `activeTab`: оно даёт `tab.url` при открытии popup без широкого доступа к вкладкам.
  - Чистая логика (`normalizeHost`, `isSiteDisabled`, `setSiteDisabled`) живёт в `src/shared/site-filter.ts` и
    тестируется без chrome API.
- **Запрещено:**
  - Писать `disabledSites` из content script или background.
  - Отправлять `CHECK_TEXT` или вызывать LLM для отключённого сайта.
  - Добавлять permission `tabs` или расширять `host_permissions` ради этой фичи.
  - Хранить список в `chrome.storage.session` или `localStorage`.
