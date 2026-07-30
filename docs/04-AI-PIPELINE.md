# AI Pipeline

**Version:** 0.2.0
**Status:** Draft
**Last Updated:** 2026-07-18

> Описывает архитектуру AI-конвейера: агентов, их роли, порядок обработки и модели, используемые в проекте.

---

## Назначение документа

Этот документ фиксирует, как устроен AI pipeline проекта — от приёма входных данных (например, изображений) до генерации результата через цепочку агентов.

## Первая реализация: генерация изображений экстерьера

Первый работающий кусок пайплайна — синхронный Route Handler `POST /api/concepts/generate` (не полноценный Agent Orchestrator из [02-PLATFORM-ARCHITECTURE.md](02-PLATFORM-ARCHITECTURE.md), который появится позже). Подробности контракта, модели и обработки ошибок — в [specs/exterior-agent.md](../specs/exterior-agent.md).

Ключевой архитектурный выбор: провайдер полностью скрыт за реестром режимов
(`src/lib/ai/model-registry.ts`) и Router-адаптерами
(`src/lib/ai/router-provider.ts`, `src/lib/ai/router-geometry-reviewer.ts`).
Architect отправляет мультимодальные запросы только в OLNOO AI Router. Router
выбирает провайдера, хранит его ключ, нормализует ошибки и вызывает Gemini; в
Architect нет SDK или прямого provider-вызова.

## Содержание (TBD)

- Общая схема пайплайна для остальных модулей (интерьер, ландшафт, BIM и т.д.)
- Список агентов и их ответственность (см. [AI Agents](01-PRODUCT.md#ai-agents))
- Полноценный Agent Orchestrator и AI Orchestrator (см. [AI Layer](02-PLATFORM-ARCHITECTURE.md#ai-layer))
- Ретраи на уровне оркестрации (сейчас есть только таймаут и явные коды ошибок на уровне одного запроса, см. `src/lib/ai/errors.ts`)

## Связанные документы

- [specs/vision-agent.md](../specs/vision-agent.md)
- [specs/exterior-agent.md](../specs/exterior-agent.md)
- [specs/reviewer-agent.md](../specs/reviewer-agent.md)
