// src/lib/services/notification/template-render.ts
/**
 * Pure `{{placeholder}}` rendering — safe to import from client components.
 */
import type { TemplateContent } from "./default-templates";

export interface RenderedTemplate {
  subject: string;
  body: string;
}

export type TemplateVars = Record<string, unknown>;

/** `{{ path.to.value }}` — whitespace tolerant, dotted paths allowed. */
const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;

function lookup(vars: TemplateVars, path: string): unknown {
  return path.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in (node as object)) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, vars);
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(stringify).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Replace placeholders in a single string; unknown keys render as "". */
export function renderString(template: string, vars: TemplateVars): string {
  return template.replace(PLACEHOLDER, (_match, path: string) =>
    stringify(lookup(vars, path))
  );
}

/** Pure: render subject and body. Collapses doubled spaces left by empty vars. */
export function renderTemplate(
  template: TemplateContent,
  vars: TemplateVars
): RenderedTemplate {
  const tidy = (s: string) => s.replace(/[ \t]{2,}/g, " ").trim();
  return {
    subject: tidy(renderString(template.subject ?? "", vars)),
    body: tidy(renderString(template.body, vars)),
  };
}

/** Placeholder names referenced by a template (for validation/preview). */
export function extractPlaceholders(template: TemplateContent): string[] {
  const found = new Set<string>();
  for (const text of [template.subject ?? "", template.body]) {
    for (const match of text.matchAll(PLACEHOLDER)) found.add(match[1]);
  }
  return Array.from(found);
}
