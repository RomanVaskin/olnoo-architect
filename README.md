# Architect OLNOO

Architect OLNOO делает профессиональный дизайн и проектирование домов и загородных посёлков доступными каждому человеку — независимо от опыта, знаний искусственного интеллекта и владения профессиональными CAD/BIM-программами. Платформа объединяет лучшие мировые AI-модели и профессиональные инструменты проектирования в единую интеллектуальную систему: от загрузки исходных материалов (идея, фото, участок, существующий дом) до генерации и ревью архитектурных решений через конвейер специализированных AI-агентов, с последующим экспортом в BIM-форматы.

Architect OLNOO — одна из вертикальных платформ экосистемы OLNOO. Подробнее — в [docs/00-VISION.md](docs/00-VISION.md).

> Статус: ранняя стадия — проект находится в фазе документирования и планирования архитектуры.

## Структура проекта

```
architect-olnoo/
├── docs/     # Архитектурная и продуктовая документация
├── specs/    # Детальные спецификации фич и AI-агентов
└── src/      # Исходный код (пока пусто)
```

## Documentation

Вся документация проекта находится в [`docs/`](docs/README.md):

- [00-VISION.md](docs/00-VISION.md) — видение продукта
- [01-PRODUCT.md](docs/01-PRODUCT.md) — философия продукта, спецификация, роли, сценарии, модули, MVP, дорожная карта
- [02-PLATFORM-ARCHITECTURE.md](docs/02-PLATFORM-ARCHITECTURE.md) — архитектура платформы
- [03-DATABASE.md](docs/03-DATABASE.md) — база данных
- [04-AI-PIPELINE.md](docs/04-AI-PIPELINE.md) — AI-конвейер
- [05-FRONTEND.md](docs/05-FRONTEND.md) — фронтенд
- [06-BACKEND.md](docs/06-BACKEND.md) — бэкенд
- [07-API.md](docs/07-API.md) — API
- [08-SECURITY.md](docs/08-SECURITY.md) — безопасность
- [09-TODO.md](docs/09-TODO.md) — текущие задачи

Детальные спецификации отдельных фич и агентов — в [`specs/`](specs/README.md).

## Development

Проект пока находится в фазе документирования — исходный код и зависимости ещё не добавлены. Дальнейшие шаги по разработке будут описаны здесь по мере появления кода в [`src/`](src/).

## AI architecture

```text
Architect browser
      ↓ authenticated Next.js API routes
Architect generation/review orchestration
      ↓ AI_ROUTER_URL + x-api-key
OLNOO AI Router
      ↓ provider adapter
Gemini
```

Architect does not contain a provider SDK or provider credential. See
[`docs/04-AI-PIPELINE.md`](docs/04-AI-PIPELINE.md) and
[`docs/11-DEPLOYMENT.md`](docs/11-DEPLOYMENT.md).
