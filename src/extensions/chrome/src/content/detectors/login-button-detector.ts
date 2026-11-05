/**
 * Login Button Detector
 * Detects the login-button click → OAuth redirect pattern
 *
 * Handles services such as Gemini and Perplexity that have no login form on the
 * main page and send users to an OAuth page via a login button
 */

import { getDomain } from "../../shared/utils";
import { sendLoginDataImmediate } from "../utils/login-sender";

/**
 * Login button text patterns.
 * The `ko` entries match button labels on third-party Korean-language sites and must stay in Korean.
 */
const LOGIN_BUTTON_PATTERNS = {
  en: ["sign in", "log in", "login", "get started", "try for free"],
  ko: ["로그인", "로그인하기", "시작하기", "무료로 시작"],
};

/**
 * OAuth provider URL patterns
 */
const OAUTH_PROVIDER_PATTERNS = [
  "accounts.google.com",
  "login.microsoftonline.com",
  "github.com/login/oauth",
  "auth.atlassian.com",
  "login.salesforce.com",
  "id.atlassian.com",
  "appleid.apple.com",
  "facebook.com/login",
  "api.twitter.com/oauth",
  "auth0.com",
  ".okta.com",
  "sso.",
];

/**
 * Settings for OAuth-button-type services
 */
export const OAUTH_BUTTON_CONFIG: Record<
  string,
  {
    buttonSelector?: string;
    buttonText?: string[];
    expectedOAuthProvider?: string;
  }
> = {
  "gemini.google.com": {
    buttonText: ["Sign in"],
    expectedOAuthProvider: "accounts.google.com",
  },
  "bard.google.com": {
    buttonText: ["Sign in"],
    expectedOAuthProvider: "accounts.google.com",
  },
  "perplexity.ai": {
    buttonText: ["Sign in", "Log in"],
    buttonSelector: 'button[data-testid*="login"], a[href*="login"]',
  },
  "you.com": {
    buttonText: ["Sign in", "Log in"],
  },
  "huggingface.co": {
    buttonText: ["Sign In", "Log In"],
    buttonSelector: 'a[href="/login"]',
  },
  "midjourney.com": {
    buttonText: ["Sign In"],
    expectedOAuthProvider: "discord.com",
  },
};

/**
 * Find login buttons
 */
function findLoginButtons(): HTMLElement[] {
  const buttons: HTMLElement[] = [];
  const allPatterns = [
    ...LOGIN_BUTTON_PATTERNS.en,
    ...LOGIN_BUTTON_PATTERNS.ko,
  ];

  // Search buttons and links
  const elements = document.querySelectorAll('button, a, [role="button"]');

  for (const el of elements) {
    const element = el as HTMLElement;
    const text = (element.textContent || "").trim().toLowerCase();
    const ariaLabel = (element.getAttribute("aria-label") || "").toLowerCase();
    const href = element.getAttribute("href") || "";

    // Whether the text or aria-label contains a login pattern
    const hasLoginPattern = allPatterns.some(
      (pattern) => text.includes(pattern) || ariaLabel.includes(pattern)
    );

    // Whether the href contains login/signin
    const hasLoginHref =
      href.includes("login") ||
      href.includes("signin") ||
      href.includes("auth");

    if (hasLoginPattern || hasLoginHref) {
      // Check visibility
      if (isElementVisible(element)) {
        buttons.push(element);
      }
    }
  }

  return buttons;
}

/**
 * Check element visibility
 */
function isElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Check whether a URL belongs to an OAuth provider
 */
function isOAuthProviderUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return OAUTH_PROVIDER_PATTERNS.some((pattern) => lowerUrl.includes(pattern));
}

/**
 * Set up navigation monitoring to detect OAuth redirects
 */
function setupOAuthRedirectWatcher(originDomain: string): void {
  // Skip if already set up
  if ((window as any).__shadeOAuthWatcher) return;
  (window as any).__shadeOAuthWatcher = true;

  console.log("[Shade] OAuth redirect watcher enabled for:", originDomain);

  // Detect page exit via the beforeunload event
  window.addEventListener("beforeunload", () => {
    // Store the originating domain in session storage
    try {
      sessionStorage.setItem(
        "__shade_oauth_origin",
        JSON.stringify({
          domain: originDomain,
          timestamp: Date.now(),
        })
      );
    } catch {
      // Ignore storage access failures
    }
  });
}

/**
 * Check whether this is an OAuth callback page
 */
function checkOAuthCallback(): boolean {
  try {
    const stored = sessionStorage.getItem("__shade_oauth_origin");
    if (!stored) return false;

    const { domain, timestamp } = JSON.parse(stored);
    const currentDomain = getDomain(window.location.href);

    // Returned to the same domain within 5 minutes
    if (Date.now() - timestamp < 5 * 60 * 1000 && currentDomain === domain) {
      // Check OAuth success parameters
      const url = new URL(window.location.href);
      const hasOAuthSuccess =
        url.searchParams.has("code") ||
        url.searchParams.has("access_token") ||
        url.searchParams.has("id_token") ||
        url.hash.includes("access_token") ||
        url.hash.includes("id_token");

      if (hasOAuthSuccess) {
        console.log("[Shade] OAuth callback detected for:", domain);
        sessionStorage.removeItem("__shade_oauth_origin");
        return true;
      }
    }
  } catch {
    // Ignore parse failures
  }

  return false;
}

/**
 * Set up login-button click listeners
 */
function setupLoginButtonListeners(
  buttons: HTMLElement[],
  originDomain: string
): void {
  for (const button of buttons) {
    // Skip if a listener is already attached
    if ((button as any).__shadeLoginListener) continue;
    (button as any).__shadeLoginListener = true;

    button.addEventListener(
      "click",
      (event) => {
        console.log(
          "[Shade] Login button clicked:",
          button.textContent?.trim()
        );

        // Set up OAuth redirect monitoring
        setupOAuthRedirectWatcher(originDomain);

        // Check for a URL change shortly after the click
        setTimeout(() => {
          const currentUrl = window.location.href;
          if (isOAuthProviderUrl(currentUrl)) {
            console.log("[Shade] Redirected to OAuth provider");
          }
        }, 100);
      },
      { capture: true }
    );
  }
}

/**
 * Detect whether the current page has a login button and set up monitoring
 */
export function detectAndMonitorLoginButtons(): {
  found: boolean;
  buttonCount: number;
  isOAuthButtonType: boolean;
} {
  const hostname = window.location.hostname;
  const domain = getDomain(window.location.href);

  // OAuth callback check
  if (checkOAuthCallback()) {
    // Send the successful OAuth login event
    sendLoginDataImmediate(domain, "", "", false, undefined);
    return { found: true, buttonCount: 0, isOAuthButtonType: true };
  }

  // Check for OAuth-button-type service settings
  const config = OAUTH_BUTTON_CONFIG[hostname];

  let buttons: HTMLElement[] = [];

  if (config) {
    console.log("[Shade] OAuth button type service detected:", hostname);

    // Find the button using the configured selector
    if (config.buttonSelector) {
      const elements = document.querySelectorAll(config.buttonSelector);
      buttons = Array.from(elements) as HTMLElement[];
    }

    // Find the button using the configured text
    if (config.buttonText && buttons.length === 0) {
      const allElements = document.querySelectorAll(
        'button, a, [role="button"]'
      );
      for (const el of allElements) {
        const element = el as HTMLElement;
        const text = (element.textContent || "").trim().toLowerCase();

        if (config.buttonText.some((t) => text.includes(t.toLowerCase()))) {
          if (isElementVisible(element)) {
            buttons.push(element);
          }
        }
      }
    }
  } else {
    // Generic login button search
    buttons = findLoginButtons();
  }

  if (buttons.length > 0) {
    console.log(`[Shade] Found ${buttons.length} login button(s)`);
    setupLoginButtonListeners(buttons, domain);
    return {
      found: true,
      buttonCount: buttons.length,
      isOAuthButtonType: !!config,
    };
  }

  return { found: false, buttonCount: 0, isOAuthButtonType: false };
}

/**
 * Login detection on OAuth provider pages
 * Detects login events directly on accounts.google.com and similar
 */
export function detectOAuthProviderLogin(): void {
  const hostname = window.location.hostname;

  // Google OAuth
  if (hostname.includes("accounts.google.com")) {
    console.log("[Shade] On Google OAuth page");

    // Monitor the email input field
    const emailInput = document.querySelector(
      'input[type="email"], #identifierId'
    ) as HTMLInputElement;
    if (emailInput) {
      console.log("[Shade] Found Google email input");
      // If it already has a value, treat it as a 2-step login
      if (emailInput.value) {
        console.log("[Shade] Google account detected (pre-filled)");
      }
    }
  }

  // Microsoft OAuth
  if (
    hostname.includes("login.microsoftonline.com") ||
    hostname.includes("login.live.com")
  ) {
    console.log("[Shade] On Microsoft OAuth page");

    const emailInput = document.querySelector(
      'input[type="email"], input[name="loginfmt"]'
    ) as HTMLInputElement;
    if (emailInput) {
      console.log("[Shade] Found Microsoft email input");
    }
  }
}
