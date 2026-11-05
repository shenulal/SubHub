import pino from "pino";

const isDev = process.env.NODE_ENV === "development";

/**
 * Pino Logger
 * - JSON output (production) / pretty print (development via pipe)
 * - per-environment log level (debug for dev, info for prod)
 * - automatic masking of sensitive data
 */
export const logger = pino({
  level: isDev ? "debug" : "info",
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  redact: {
    paths: [
      "password",
      "token",
      "secret",
      "authorization",
      "cookie",
      "*.password",
      "*.token",
      "*.secret",
      "*.authorization",
      "*.cookie",
      "req.headers.authorization",
      "req.headers.cookie",
      // sensitive data in payload (Server Action withLogging)
      "payload.password",
      "payload.token",
      "payload.secret",
      "payload.privateKey",
      "payload.currentPassword",
      "payload.newPassword",
      "payload.confirmPassword",
      "payload.*.password",
      "payload.*.token",
      "payload.*.secret",
      "payload.*.privateKey",
      "payload.credentials.privateKey",
      "payload.credentials.secret",
      // sensitive data in request body (API Route withLogging)
      "body.password",
      "body.token",
      "body.secret",
      "body.privateKey",
      "body.currentPassword",
      "body.newPassword",
      "body.confirmPassword",
      "body.*.password",
      "body.*.token",
      "body.*.secret",
      "body.*.privateKey",
      "body.credentials.privateKey",
      "body.credentials.secret",
      // sensitive data in response body (API Route withLogging)
      "responseBody.password",
      "responseBody.token",
      "responseBody.secret",
      "responseBody.*.password",
      "responseBody.*.token",
      "responseBody.*.secret",
    ],
    censor: "[REDACTED]",
  },
  base: {
    service: process.env.SERVICE_NAME || "subhub",
  },
});
