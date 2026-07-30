import { GenerationError } from "./errors";
import type { GenerationMode, SourceViewRole } from "@/lib/types";
import type { ArchitecturalConstraints, SourceImageInput } from "./types";

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_IMAGES = 3;
const MAX_TEXT_LENGTH = 4000;
const GENERATION_MODES: GenerationMode[] = ["auto", "fast", "balanced", "maximum-quality"];
const SOURCE_VIEW_ROLES = new Set<SourceViewRole>(["front", "side", "rear", "detail", "other"]);

/**
 * Conservative cap on the combined raw (pre-base64) bytes of all images in a
 * single generation request. The current provider's inline-request limit is
 * ~20MB total for the whole request (prompt + files); base64 encoding
 * inflates raw bytes by ~4/3, and the JSON request wrapper adds a little
 * more. Staying well under 20MB after that expansion leaves headroom for the
 * prompt text and multiple image parts instead of failing right at the edge.
 *
 * TODO: if requests routinely approach this limit, add a Router file-upload
 * contract (upload once, reference by URI) instead of sending images inline
 * — not implemented yet, since MVP request sizes are far below it.
 */
export const MAX_TOTAL_INLINE_IMAGE_BYTES = 12 * 1024 * 1024;

export function formatCombinedImageSizeError(totalBytes: number): string {
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
  const limitMb = (MAX_TOTAL_INLINE_IMAGE_BYTES / (1024 * 1024)).toFixed(0);
  return `Суммарный размер изображений (${totalMb} МБ) превышает лимит ${limitMb} МБ на одну генерацию. Уменьшите количество или размер файлов.`;
}

export interface ValidatedGenerationInput {
  images: SourceImageInput[];
  constraints: ArchitecturalConstraints;
  mode: GenerationMode;
  variantCount: number;
  autoReview: boolean;
}

export interface ValidatedCorrectionInput {
  images: SourceImageInput[];
  constraints: ArchitecturalConstraints;
  findings: string[];
  mode: GenerationMode;
  sourceConceptId: string;
}

export async function validateCorrectionForm(formData: FormData): Promise<ValidatedCorrectionInput> {
  const files = formData.getAll("images").filter((entry): entry is File => entry instanceof File);
  if (files.length < 2 || files.length > 3) {
    throw new GenerationError("validation", "Для исправления нужны текущая концепция, основной исходный ракурс и не более одного опорного ракурса.");
  }
  for (const file of files) {
    if (!ACCEPTED_IMAGE_TYPES.has(file.type) || file.size > MAX_FILE_SIZE) {
      throw new GenerationError("unsupported-file", `Файл «${file.name}» не подходит для исправления концепции.`);
    }
  }
  const totalImageBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalImageBytes > MAX_TOTAL_INLINE_IMAGE_BYTES) {
    throw new GenerationError("validation", formatCombinedImageSizeError(totalImageBytes));
  }

  const sourceConceptId = String(formData.get("sourceConceptId") ?? "").trim();
  if (!sourceConceptId || sourceConceptId.length > 200) throw new GenerationError("validation", "Не указана исходная концепция для исправления.");
  const goal = String(formData.get("goal") ?? "").trim();
  if (!goal || goal.length > MAX_TEXT_LENGTH) throw new GenerationError("validation", "Цель проекта для исправления не указана или слишком длинная.");
  const findings = parseStringArray(formData.get("findings")).filter(Boolean).slice(0, 10);
  if (findings.length === 0) throw new GenerationError("validation", "Reviewer не передал конкретные замечания для исправления.");
  const modeRaw = String(formData.get("mode") ?? "");
  if (!GENERATION_MODES.includes(modeRaw as GenerationMode)) throw new GenerationError("validation", "Указан неизвестный режим генерации.");

  const roles = parseCorrectionRoles(formData.get("roles"), files.length);
  const images: SourceImageInput[] = await Promise.all(files.map(async (file, index) => ({
    data: Buffer.from(await file.arrayBuffer()),
    mimeType: file.type,
    role: roles[index],
    purpose: index === 0 ? "correction-target" : index === 1 ? "primary" : "reference",
  })));
  return {
    images,
    constraints: {
      goal,
      explicitChanges: String(formData.get("explicitChanges") ?? "").trim().slice(0, MAX_TEXT_LENGTH),
      mustKeep: parseStringArray(formData.get("mustKeep")),
      mayChange: parseStringArray(formData.get("mayChange")),
    },
    findings,
    mode: modeRaw as GenerationMode,
    sourceConceptId,
  };
}

function parseCorrectionRoles(value: FormDataEntryValue | null, imageCount: number): SourceViewRole[] {
  const fallback: SourceViewRole[] = ["other", "front", "other"].slice(0, imageCount) as SourceViewRole[];
  if (typeof value !== "string" || !value) return fallback;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length !== imageCount) throw new Error();
    return parsed.map((role) => {
      if (typeof role !== "string" || !SOURCE_VIEW_ROLES.has(role as SourceViewRole)) throw new Error();
      return role as SourceViewRole;
    });
  } catch {
    throw new GenerationError("validation", "Роли изображений для исправления имеют некорректный формат.");
  }
}

/**
 * Re-validates everything the client already checked (see
 * new-project-wizard.tsx) — the server never trusts client-side validation
 * alone (see docs/02-PLATFORM-ARCHITECTURE.md — Secure by default).
 */
export async function validateGenerationForm(formData: FormData): Promise<ValidatedGenerationInput> {
  const files = formData.getAll("images").filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    throw new GenerationError("validation", "Добавьте хотя бы одно исходное изображение.");
  }
  if (files.length > MAX_IMAGES) {
    throw new GenerationError("validation", `Можно передать не более ${MAX_IMAGES} изображений.`);
  }

  for (const file of files) {
    if (file.type === "application/pdf") {
      throw new GenerationError(
        "unsupported-file",
        "PDF-файлы пока нельзя передать в модель генерации изображений. Загрузите фотографию в формате JPEG, PNG или WebP.",
      );
    }
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      throw new GenerationError(
        "unsupported-file",
        `Файл «${file.name}» имеет неподдерживаемый формат. Поддерживаются JPEG, PNG и WebP.`,
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new GenerationError("unsupported-file", `Файл «${file.name}» больше ${MAX_FILE_SIZE / (1024 * 1024)} МБ.`);
    }
  }

  const totalImageBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalImageBytes > MAX_TOTAL_INLINE_IMAGE_BYTES) {
    throw new GenerationError("validation", formatCombinedImageSizeError(totalImageBytes));
  }

  const goal = String(formData.get("goal") ?? "").trim();
  if (!goal) {
    throw new GenerationError("validation", "Опишите цель проекта.");
  }
  if (goal.length > MAX_TEXT_LENGTH) {
    throw new GenerationError("validation", "Описание цели слишком длинное.");
  }

  const explicitChanges = String(formData.get("explicitChanges") ?? "").trim();
  if (explicitChanges.length > MAX_TEXT_LENGTH) {
    throw new GenerationError("validation", "Описание изменений слишком длинное.");
  }

  const mustKeep = parseStringArray(formData.get("mustKeep"));
  const mayChange = parseStringArray(formData.get("mayChange"));

  const modeRaw = String(formData.get("mode") ?? "");
  if (!GENERATION_MODES.includes(modeRaw as GenerationMode)) {
    throw new GenerationError("validation", "Указан неизвестный режим генерации.");
  }
  const mode = modeRaw as GenerationMode;

  const variantCountRaw = Number(formData.get("variantCount"));
  if (!Number.isInteger(variantCountRaw) || variantCountRaw < 1 || variantCountRaw > 3) {
    throw new GenerationError("validation", "Количество вариантов должно быть от 1 до 3.");
  }

  const autoReviewRaw = formData.get("autoReview");
  if (autoReviewRaw !== null && autoReviewRaw !== "true" && autoReviewRaw !== "false") {
    throw new GenerationError("validation", "Параметр автоматической проверки имеет некорректное значение.");
  }
  const autoReview = autoReviewRaw === "true";

  const contexts = parseImageContexts(formData.get("imageContexts"), files.length);
  const images: SourceImageInput[] = await Promise.all(
    files.map(async (file, index) => ({
      data: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
      role: contexts[index].role,
      purpose: contexts[index].purpose,
    })),
  );

  return {
    images,
    constraints: { goal, explicitChanges, mustKeep, mayChange },
    mode,
    variantCount: variantCountRaw,
    autoReview,
  };
}

function parseImageContexts(value: FormDataEntryValue | null, imageCount: number): Array<{ role: SourceViewRole; purpose: "primary" | "reference" }> {
  if (typeof value !== "string" || !value) {
    return Array.from({ length: imageCount }, (_, index) => ({ role: "other", purpose: index === 0 ? "primary" : "reference" }));
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new GenerationError("validation", "Описание ракурсов имеет некорректный формат.");
  }
  if (!Array.isArray(parsed) || parsed.length !== imageCount) {
    throw new GenerationError("validation", "Количество описаний ракурсов не совпадает с количеством изображений.");
  }
  const contexts = parsed.map((item) => {
    const role = (item as { role?: unknown })?.role;
    const purpose = (item as { purpose?: unknown })?.purpose;
    if (typeof role !== "string" || !SOURCE_VIEW_ROLES.has(role as SourceViewRole) || (purpose !== "primary" && purpose !== "reference")) {
      throw new GenerationError("validation", "Описание одного из ракурсов содержит неизвестную роль или назначение.");
    }
    return { role: role as SourceViewRole, purpose: purpose as "primary" | "reference" };
  });
  if (contexts.filter((context) => context.purpose === "primary").length !== 1 || contexts[0].purpose !== "primary") {
    throw new GenerationError("validation", "Первое изображение должно быть единственным основным ракурсом.");
  }
  return contexts;
}

function parseStringArray(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .slice(0, 30)
      .map((item) => item.slice(0, 200));
  } catch {
    return [];
  }
}
