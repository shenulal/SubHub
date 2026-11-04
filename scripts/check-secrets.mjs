#!/usr/bin/env node
// scripts/check-secrets.mjs
// Pre-commit guard (wired through lint-staged): refuses to commit files that
// look like they contain credentials. Usage: node scripts/check-secrets.mjs <files...>
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const PATTERNS = [
  {
    name: "Private key block",
    // header followed by real base64 key material (fixtures with "test"/"..." do not match)
    re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----(?:\\n|\s)+[A-Za-z0-9+/=]{40,}/,
  },
  { name: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "OpenAI / Anthropic style key", re: /\b(?:sk|sk-ant)-[A-Za-z0-9_-]{24,}\b/ },
  { name: "Resend key", re: /\bre_[A-Za-z0-9]{24,}\b/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { name: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "Google OAuth client secret", re: /\bGOCSPX-[A-Za-z0-9_-]{20,}\b/ },
  { name: "Postgres URL with password", re: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]{6,}@(?!localhost|127\.0\.0\.1|db\.)/ },
  { name: "Generic secret assignment", re: /(?:SECRET|PASSWORD|API_KEY|TOKEN)\s*=\s*["'][A-Za-z0-9+/_\-]{24,}["']/ },
];

const ALLOWED_FILES = new Set([".env.example", "check-secrets.mjs"]);
const ALLOWED_PLACEHOLDERS = /(your-|example|placeholder|dummy|change-me|\.\.\.|xxx|test)/i;

let failed = false;
for (const file of process.argv.slice(2)) {
  if (/\.env(\..+)?$/.test(basename(file)) && basename(file) !== ".env.example") {
    console.error(`[check-secrets] ${file}: environment files must never be committed`);
    failed = true;
    continue;
  }
  if (ALLOWED_FILES.has(basename(file))) continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const { name, re } of PATTERNS) {
    const match = text.match(re);
    if (match && !ALLOWED_PLACEHOLDERS.test(match[0])) {
      console.error(`[check-secrets] ${file}: possible ${name}`);
      failed = true;
    }
  }
}
if (failed) {
  console.error("[check-secrets] commit blocked. Move secrets to environment variables or a secret manager.");
  process.exit(1);
}
