/**
 * Server-only error taxonomy for the image-generation pipeline. Every code maps
 * to a clear Russian message safe to return to the client — never the raw
 * provider error, stack trace, or secret (see docs/08-SECURITY.md direction).
 */

export type GenerationErrorCode =
  | "missing-api-key"
  | "unsupported-file"
  | "provider-timeout"
  | "safety-rejection"
  | "rate-limit"
  | "quota-exhausted"
  | "malformed-response"
  | "provider-failure"
  | "validation";

const MESSAGES: Record<GenerationErrorCode, string> = {
  "missing-api-key": "OLNOO AI Router не настроен на сервере. Обратитесь к администратору.",
  "unsupported-file": "Файл имеет неподдерживаемый формат или превышает допустимый размер.",
  "provider-timeout": "AI-провайдер не ответил вовремя. Попробуйте повторить генерацию ещё раз.",
  "safety-rejection": "Провайдер отклонил запрос по правилам безопасности контента. Измените описание или исходные изображения.",
  "rate-limit": "Превышен лимит запросов к AI-провайдеру. Подождите немного и повторите попытку.",
  "quota-exhausted": "Квота AI-провайдера исчерпана или не активирована для этой модели. Проверьте биллинг и квоты провайдера.",
  "malformed-response": "AI-провайдер вернул некорректный ответ. Попробуйте повторить генерацию.",
  "provider-failure": "Не удалось получить результат от AI-провайдера. Попробуйте повторить генерацию позже.",
  validation: "Проверьте введённые данные и попробуйте снова.",
};

export class GenerationError extends Error {
  readonly code: GenerationErrorCode;

  constructor(code: GenerationErrorCode, detail?: string) {
    super(detail ?? MESSAGES[code]);
    this.code = code;
  }

  /** The message safe to show the user — the specific detail when one was given, otherwise the generic message for this code. */
  get userMessage(): string {
    return this.message;
  }
}
