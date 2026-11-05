/**
 * Field detection utilities
 * Identifies username, password, and MFA input fields
 */

import { setMFADetected } from "../state";

/** Username field name patterns - extended */
const USERNAME_PATTERNS = [
  // Base patterns
  "user",
  "username",
  "email",
  "login",
  "account",
  "id",
  "identifier",
  // Additional patterns (GitHub, Notion, etc.)
  "login_field",
  "signin",
  "sign-in",
  "emailaddress",
  "email-input",
  "loginemail",
  "useremail",
  "usermail",
  "mail",
  // Korean patterns: match field names/labels on third-party Korean-language sites (must stay Korean)
  "이메일",
  "아이디",
  "사용자",
];

/** Password field patterns for autocomplete attribute */
const PASSWORD_AUTOCOMPLETE_PATTERNS = [
  "password",
  "current-password",
  "new-password",
];

/** MFA field name patterns */
const MFA_PATTERNS = [
  "totp",
  "mfa",
  "otp",
  "code",
  "token",
  "verification",
  "verify",
  "authenticator",
  "auth",
  "2fa",
  "twofactor",
  "security",
  "sms",
  "multifactor",
];

/**
 * Get all searchable attributes from an input element
 */
const getSearchableAttributes = (input: HTMLInputElement): string[] => {
  return [
    input.name || "",
    input.id || "",
    input.placeholder || "",
    input.getAttribute("aria-label") || "",
    input.getAttribute("data-testid") || "",
    input.getAttribute("data-test") || "",
    input.className || "",
  ].map((s) => s.toLowerCase());
};

/**
 * Determine if an input field is likely a username field
 * Enhanced to detect custom UI components (Atlassian, GitHub, Notion, etc.)
 */
export const isUsernameField = (input: HTMLInputElement): boolean => {
  const type = input.type.toLowerCase();

  // Check for email type
  if (type === "email") return true;

  // Check autocomplete attribute
  const autocomplete = (input.autocomplete || "").toLowerCase();
  if (autocomplete.includes("username") || autocomplete.includes("email")) {
    return true;
  }

  // Get all searchable attributes
  const attributes = getSearchableAttributes(input);

  // Check for common username field patterns
  if (
    USERNAME_PATTERNS.some((pattern) =>
      attributes.some((attr) => attr.includes(pattern))
    )
  ) {
    return true;
  }

  // Extra check: a text input that precedes a password field
  if (type === "text") {
    // The first text field in a form is most likely the username
    const form = input.closest("form");
    if (form) {
      const inputs = form.querySelectorAll(
        'input[type="text"], input[type="email"], input:not([type])'
      );
      if (inputs.length > 0 && inputs[0] === input) {
        // Check whether the same form has a password field
        const hasPasswordField = form.querySelector('input[type="password"]');
        if (hasPasswordField) {
          return true;
        }
      }
    }
  }

  // Extra check: site-specific selectors
  const hostname = window.location.hostname;

  // GitHub only
  if (hostname.includes("github.com") && input.id === "login_field") {
    return true;
  }

  // Notion only
  if (
    hostname.includes("notion.so") &&
    input.getAttribute("data-testid")?.includes("email")
  ) {
    return true;
  }

  // Claude.ai only (Magic Link / Passwordless)
  if (hostname.includes("claude.ai")) {
    // Detect the email input on the Claude.ai login page (the Korean "email" placeholder must stay Korean)
    const isEmailLikeField =
      type === "email" ||
      input.placeholder?.toLowerCase().includes("이메일") ||
      input.placeholder?.toLowerCase().includes("email") ||
      attributes.some((attr) => attr.includes("email"));
    if (isEmailLikeField) {
      return true;
    }
  }

  // Detect Passwordless/Magic Link login pages (email field with no password field)
  if (type === "text" || type === "email") {
    const form = input.closest("form");
    if (form) {
      const hasPasswordField = form.querySelector('input[type="password"]');
      // No password field and the current field looks like email: treat it as the username (Korean placeholder must stay Korean)
      if (!hasPasswordField) {
        const isEmailLikeField =
          type === "email" ||
          input.placeholder?.toLowerCase().includes("email") ||
          input.placeholder?.toLowerCase().includes("이메일") ||
          attributes.some(
            (attr) => attr.includes("email") || attr.includes("mail")
          );
        if (isEmailLikeField) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Determine if an input field is a password field
 * Enhanced to detect hidden password fields (Google, Dropbox, Zoom, HubSpot)
 */
export const isPasswordField = (input: HTMLInputElement): boolean => {
  const type = input.type.toLowerCase();

  // Primary check: type="password"
  if (type === "password") {
    return true;
  }

  // Secondary check: autocomplete attribute indicates password
  const autocomplete = (input.autocomplete || "").toLowerCase();
  if (PASSWORD_AUTOCOMPLETE_PATTERNS.some((p) => autocomplete.includes(p))) {
    return true;
  }

  // Tertiary check: aria-label or data-* attributes contain password
  const ariaLabel = (input.getAttribute("aria-label") || "").toLowerCase();
  const dataTestId = (input.getAttribute("data-testid") || "").toLowerCase();
  const dataTest = (input.getAttribute("data-test") || "").toLowerCase();

  if (
    ariaLabel.includes("password") ||
    dataTestId.includes("password") ||
    dataTest.includes("password")
  ) {
    return true;
  }

  return false;
};

/**
 * Determine if an input field is likely an MFA/TOTP field
 */
export const isMFAField = (input: HTMLInputElement): boolean => {
  const type = input.type.toLowerCase();
  const name = input.name.toLowerCase();
  const id = input.id.toLowerCase();
  const placeholder = (input.placeholder || "").toLowerCase();
  const className = input.className.toLowerCase();

  const hasPattern = (patterns: string[]): boolean =>
    patterns.some(
      (pattern) =>
        name.includes(pattern) ||
        id.includes(pattern) ||
        placeholder.includes(pattern) ||
        className.includes(pattern)
    );

  // Check for numeric input types commonly used for TOTP
  if (type === "number" || type === "tel") {
    if (hasPattern(MFA_PATTERNS)) {
      setMFADetected(true, "TOTP");
      return true;
    }
  }

  // Check for text fields that might be used for codes
  if (type === "text") {
    const maxLength = input.maxLength;
    const autocomplete = (input.autocomplete || "").toLowerCase();
    const inputMode = (input.inputMode || "").toLowerCase();

    // Check for specific TOTP indicators
    const isTOTPField =
      hasPattern(MFA_PATTERNS) ||
      (maxLength >= 4 && maxLength <= 8) ||
      autocomplete === "one-time-code" ||
      inputMode === "numeric";

    if (isTOTPField) {
      setMFADetected(true, "TOTP");
      return true;
    }
  }

  return false;
};
