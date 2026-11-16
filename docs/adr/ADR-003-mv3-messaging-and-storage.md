# ADR-003: Обмен сообщениями MV3 и хранение состояния в chrome.storage

- **Статус:** Принято
- **Контекст:** В MV3 service worker выгружается при простое, и модульные переменные теряются. Content script
  работает на чужих страницах, поэтому ему нельзя доверять секреты, а после перезагрузки расширения он теряет runtime.
- **Решение:**
  - Content (`src/content/content-script.ts`) шлёт в background `chrome.runtime.sendMessage` с дискриминатором `type`,
    тип ответа задаёт `ResponseFor<M>` (`{ ok: true, result } | { ok: false, error }`).
  - Popup тоже шлёт сообщения в background (`PopupToBackgroundMessage`); все сообщения, которые принимает background,
    объединены в `BackgroundMessage` (`ContentToBackgroundMessage | PopupToBackgroundMessage`).
  - Background (`src/background/service-worker.ts`) обрабатывает сообщения в exhaustive `switch` с проверкой `never`.
    На асинхронный ответ отвечает `return true` + `sendResponse` после `await`.
  - API-ключ и вызовы LLM (`src/background/llm.ts`) живут только в background.
  - Постоянное состояние хранится в `chrome.storage.local` (`apiKey`, `mistakes`; `mistakes` пишет только background, см. ADR-004), сессионное — в `chrome.storage.session`
    (`lastRequestAt` для rate limit). Перечитывается при каждом событии.
  - Дебаунс 1500 мс выполняется в content script (`WeakMap` таймеров). `isExtensionAlive()` и `detach()` снимают
    слушатели после «Extension context invalidated».
- **Запрещено:**
  - Хранить состояние в модульных переменных service worker; `setTimeout` / `setInterval` в worker вместо `chrome.alarms`.
  - Передавать API-ключ в content script или popup-логику запросов.
  - Давать entry-файлам манифеста одинаковые имена (`index.ts`): только `service-worker.ts`, `content-script.ts`.
