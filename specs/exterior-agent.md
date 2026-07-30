# Exterior Agent

**Version:** 0.5.0
**Status:** Draft
**Last Updated:** 2026-07-18

> Спецификация агента, отвечающего за анализ/генерацию экстерьера здания.

---

## Назначение документа

Описывает роль Exterior Agent в AI-пайплайне: какие данные он принимает на вход, что возвращает, и какая модель используется.

## Реализация (MVP)

Первая рабочая версия реализована как серверный Route Handler `POST /api/concepts/generate` (`src/app/api/concepts/generate/route.ts`), а не как отдельный оркестрируемый агент — оркестрация и Multi-Agent System из `02-PLATFORM-ARCHITECTURE.md` появятся позже.

### Входные данные

Multipart FormData:

- `images` — 1–3 растровых изображения (JPEG/PNG/WebP; PDF отклоняется с понятным сообщением, см. `specs/image-upload.md`);
- `goal`, `explicitChanges` — цель и явные требуемые изменения;
- `mustKeep`, `mayChange` — JSON-массивы строк (см. [Constraint Categories](../docs/01-PRODUCT.md#5-constraint-categories));
- `mode` — один из продуктовых режимов: `auto` | `fast` | `balanced` | `maximum-quality`;
- `variantCount` — 1–3.

Всё валидируется повторно на сервере (`src/lib/ai/request-validation.ts`), независимо от клиентской валидации в мастере.

Помимо лимита на количество и размер каждого файла, сервер проверяет **суммарный** размер всех изображений одного запроса (`MAX_TOTAL_INLINE_IMAGE_BYTES` = 12 МБ) — консервативный запас ниже фактического inline-лимита Gemini (~20 МБ на весь запрос), учитывающий расширение base64 (~×4/3) и накладные расходы промпта. Мастер (`src/components/projects/new-project-wizard.tsx`) проверяет то же самое на клиенте до отправки и не даёт пользователю молча потерять файлы: если загружено больше 3 растровых фотографий, явно показывает лимит и позволяет выбрать, какие именно 3 участвуют в генерации — остальные остаются в проекте как материалы.

### Используемая модель

Провайдер-независимый реестр (`src/lib/ai/model-registry.ts`) сопоставляет продуктовый режим с провайдером и моделью — эта информация не покидает сервер:

| Режим | Провайдер | Модель |
|---|---|---|
| Auto | Gemini | сейчас совпадает с Balanced |
| Fast | Gemini | `gemini-3.1-flash-lite-image` |
| Balanced | OLNOO AI Router | `gemini-3.1-flash-image` (`AI_IMAGE_MODEL`) |
| Maximum Quality | Gemini | `gemini-3-pro-image` |

Транспортный адаптер — `src/lib/ai/router-provider.ts`. Architect не содержит
provider SDK и не вызывает Gemini напрямую; запрос идёт через OLNOO AI Router.
Добавление OpenAI или FLUX выполняется в Router без изменений API-контракта,
мастера или Concepts UI.

### Промпт

`src/lib/ai/prompt-builder.ts` собирает структурированный промпт с явным разделением: цель пользователя → явные изменения → изменяемые элементы → неизменяемые элементы, и инструктирует модель редактировать переданный дом (не придумывать другое здание), сохранять ракурс, композицию, этажность, объёмы, форму крыши и расположение проёмов, кроме явно разрешённого.

### Выходные данные

Нормализованный ответ на каждый вариант (без сырого ответа провайдера):

```json
{
  "status": "succeeded" | "failed",
  "mode": "balanced",
  "mimeType": "image/png",
  "imageBase64": "...",
  "warnings": [],
  "geometryVerification": {
    "status": "no-obvious-deviations | possible-deviations | inconclusive | not-run",
    "confidence": 0.82,
    "summary": "...",
    "checks": [],
    "advisory": "..."
  },
  "error": { "code": "...", "message": "..." }
}
```

Интерфейс никогда не утверждает, что геометрические ограничения проверены — генерация и проверка геометрии остаются разными процессами (см. [Human Control](../docs/01-PRODUCT.md#human-control)).

### Обработка ошибок

`src/lib/ai/errors.ts` определяет коды с понятными русскоязычными сообщениями: `missing-api-key`, `unsupported-file`, `provider-timeout`, `safety-rejection`, `rate-limit`, `quota-exhausted`, `malformed-response`, `provider-failure`, `validation`. Конкурентность вызовов провайдера ограничена процессом (`src/lib/ai/concurrency.ts`).

`rate-limit` и `quota-exhausted` приходят от OLNOO AI Router как разные
безопасные коды, хотя оба используют HTTP 429. `rate-limit` означает временный
всплеск нагрузки; `quota-exhausted` — недоступную квоту модели. Router
классифицирует сырой provider-ответ и никогда не передаёт его Architect или
браузеру.

### Исправленная версия (Phase 6)

`POST /api/concepts/correct` использует тот же provider adapter и model registry, но отдельный контракт и отдельный correction-промпт. Первым изображением служит готовая концепция для редактирования, вторым — исходный Primary View как геометрический эталон, третьим при наличии — один исходный reference view. Запрос создаёт ровно одну новую связанную версию и затем передаёт её Reviewer; он никогда не вызывается автоматически из обычного Quality Gate.

### Известные ограничения

- Аутентификации и серверного rate limiting на уровне пользователя пока нет — см. `docs/09-TODO.md`.
- Phase 4 добавляет отдельную предварительную AI-проверку геометрии после успешной генерации; она описана в `specs/reviewer-agent.md`, не является профессиональным заключением и не блокирует сохранение результата при собственной ошибке.
- Изображения передаются в Gemini только как inline base64 — Files API (для больших/множественных файлов, обходящих лимит суммарного размера) пока не реализован, см. `docs/09-TODO.md`.
