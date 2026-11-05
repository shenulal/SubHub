/**
 * Enhanced Form Detector
 * Enhanced logic for detecting login forms on SaaS sites where basic detection failed
 */

import { getLoginConfig, LoginConfig } from "./login-url-config";
import { deepQuerySelector, deepQuerySelectorAll } from "./shadow-dom";

// Helper for text-based selectors (substitute for unsupported :contains)
function findElementByText(
  text: string,
  tagNames: string[] = ["button", "a"]
): HTMLElement | null {
  const lowerText = text.toLowerCase();

  for (const tagName of tagNames) {
    const elements = document.querySelectorAll(tagName);
    for (const el of elements) {
      const elementText = (el.textContent || "").toLowerCase();
      if (elementText.includes(lowerText)) {
        return el as HTMLElement;
      }
    }
  }

  return null;
}

/**
 * Wait until an element appears
 */
async function waitForElement(
  selector: string,
  timeout: number = 10000,
  root: Document | ShadowRoot = document
): Promise<HTMLElement | null> {
  const startTime = Date.now();
  const checkInterval = 500;

  while (Date.now() - startTime < timeout) {
    // Regular DOM search
    let element = root.querySelector(selector) as HTMLElement;
    if (element) return element;

    // Shadow DOM search
    element = deepQuerySelector(selector, root as Document) as HTMLElement;
    if (element) return element;

    // Wait
    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }

  return null;
}

/**
 * Click the modal trigger button
 */
async function clickLoginTrigger(config: LoginConfig): Promise<boolean> {
  if (!config.clickBeforeLogin) return false;

  // Handle non-standard selectors such as :contains()
  const selectors = config.clickBeforeLogin.split(",").map((s) => s.trim());

  for (const selector of selectors) {
    let element: HTMLElement | null = null;

    // Handle text-based selectors
    if (selector.includes(":contains(")) {
      const match = selector.match(/:contains\(["']?(.+?)["']?\)/);
      if (match) {
        const text = match[1];
        const tagMatch = selector.match(/^(\w+):/);
        const tags = tagMatch ? [tagMatch[1]] : ["button", "a"];
        element = findElementByText(text, tags);
      }
    } else {
      // Standard selector
      element = document.querySelector(selector) as HTMLElement;
    }

    if (element && element.offsetParent !== null) {
      console.log("[Shade] Clicking login trigger:", selector);
      element.click();
      // Wait for the modal to render
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return true;
    }
  }

  return false;
}

/**
 * Enhanced login form detection
 */
export async function detectLoginFormEnhanced(): Promise<{
  found: boolean;
  type: string;
  fields: {
    email?: HTMLInputElement;
    password?: HTMLInputElement;
    submit?: HTMLElement;
  };
}> {
  const hostname = window.location.hostname;
  const config = getLoginConfig(hostname);

  console.log(
    "[Shade] Enhanced detection for:",
    hostname,
    config ? `(type: ${config.type})` : "(no config)"
  );

  const result = {
    found: false,
    type: "standard",
    fields: {} as {
      email?: HTMLInputElement;
      password?: HTMLInputElement;
      submit?: HTMLElement;
    },
  };

  // Run enhanced detection when settings exist
  if (config) {
    result.type = config.type;

    // 1. When a modal trigger click is required
    if (config.clickBeforeLogin) {
      const clicked = await clickLoginTrigger(config);
      console.log("[Shade] Login trigger clicked:", clicked);
    }

    // 2. Extra wait time
    if (config.extraWaitTime) {
      console.log("[Shade] Extra wait time:", config.extraWaitTime);
      await new Promise((resolve) => setTimeout(resolve, config.extraWaitTime));
    }

    // 3. Wait for a specific selector
    if (config.waitForSelector) {
      console.log("[Shade] Waiting for selector:", config.waitForSelector);
      const element = await waitForElement(config.waitForSelector, 10000);
      if (element) {
        console.log("[Shade] Wait selector found");
      }
    }

    // 4. Deep search for the Shadow DOM type
    if (config.type === "shadow-dom") {
      return detectInShadowDOM(config);
    }

    // 5. Find fields using custom selectors
    if (config.selectors) {
      if (config.selectors.email) {
        result.fields.email = document.querySelector(
          config.selectors.email
        ) as HTMLInputElement;
      }
      if (config.selectors.password) {
        result.fields.password = document.querySelector(
          config.selectors.password
        ) as HTMLInputElement;
      }
      if (config.selectors.submit) {
        result.fields.submit = document.querySelector(
          config.selectors.submit
        ) as HTMLElement;
      }
    }
  }

  // Fall back to generic detection when there are no settings or custom selectors found nothing
  if (!result.fields.email) {
    result.fields.email = findEmailField();
  }
  if (!result.fields.password) {
    result.fields.password = findPasswordField();
  }
  if (!result.fields.submit) {
    result.fields.submit = findSubmitButton();
  }

  result.found = !!(result.fields.email || result.fields.password);

  console.log("[Shade] Enhanced detection result:", {
    found: result.found,
    type: result.type,
    hasEmail: !!result.fields.email,
    hasPassword: !!result.fields.password,
  });

  return result;
}

/**
 * Detect login forms inside Shadow DOM
 */
async function detectInShadowDOM(config: LoginConfig): Promise<{
  found: boolean;
  type: string;
  fields: {
    email?: HTMLInputElement;
    password?: HTMLInputElement;
    submit?: HTMLElement;
  };
}> {
  const result = {
    found: false,
    type: "shadow-dom",
    fields: {} as {
      email?: HTMLInputElement;
      password?: HTMLInputElement;
      submit?: HTMLElement;
    },
  };

  // Find the email field
  const emailSelectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[autocomplete="email"]',
    'input[autocomplete="username"]',
  ];

  for (const selector of emailSelectors) {
    const element = deepQuerySelector(selector) as HTMLInputElement;
    if (element) {
      result.fields.email = element;
      break;
    }
  }

  // Find the password field
  const passwordSelectors = [
    'input[type="password"]',
    'input[name="password"]',
    'input[autocomplete="current-password"]',
  ];

  for (const selector of passwordSelectors) {
    const element = deepQuerySelector(selector) as HTMLInputElement;
    if (element) {
      result.fields.password = element;
      break;
    }
  }

  // Find the submit button
  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:contains("Sign in")',
    'button:contains("Log in")',
  ];

  for (const selector of submitSelectors) {
    if (selector.includes(":contains(")) {
      // Text-based search inside Shadow DOM
      const buttons = deepQuerySelectorAll("button");
      const match = selector.match(/:contains\(["']?(.+?)["']?\)/);
      if (match) {
        const text = match[1].toLowerCase();
        for (const btn of buttons) {
          if ((btn.textContent || "").toLowerCase().includes(text)) {
            result.fields.submit = btn as HTMLElement;
            break;
          }
        }
      }
    } else {
      const element = deepQuerySelector(selector) as HTMLElement;
      if (element) {
        result.fields.submit = element;
        break;
      }
    }
    if (result.fields.submit) break;
  }

  result.found = !!(result.fields.email || result.fields.password);
  return result;
}

/**
 * Find the email/username field
 */
function findEmailField(): HTMLInputElement | undefined {
  const selectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[name="username"]',
    'input[name="identifier"]',
    'input[autocomplete="email"]',
    'input[autocomplete="username"]',
    'input[id*="email" i]',
    'input[id*="user" i]',
    'input[placeholder*="email" i]',
    // Matches the Korean "email" placeholder on third-party Korean-language sites (must stay Korean)
    'input[placeholder*="이메일" i]',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector) as HTMLInputElement;
    if (element && isVisible(element)) {
      return element;
    }
  }

  return undefined;
}

/**
 * Find the password field
 */
function findPasswordField(): HTMLInputElement | undefined {
  const element = document.querySelector(
    'input[type="password"]'
  ) as HTMLInputElement;
  if (element && isVisible(element)) {
    return element;
  }
  return undefined;
}

/**
 * Find the submit button
 */
function findSubmitButton(): HTMLElement | undefined {
  const selectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button[name="submit"]',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector) as HTMLElement;
    if (element && isVisible(element)) {
      return element;
    }
  }

  // Text-based search (the Korean entries match login buttons on third-party Korean-language sites)
  const buttonTexts = [
    "Sign in",
    "Log in",
    "Login",
    "Submit",
    "로그인",
    "로그인하기",
  ];
  const buttons = document.querySelectorAll("button");

  for (const btn of buttons) {
    const text = (btn.textContent || "").trim().toLowerCase();
    for (const searchText of buttonTexts) {
      if (text.includes(searchText.toLowerCase())) {
        if (isVisible(btn as HTMLElement)) {
          return btn as HTMLElement;
        }
      }
    }
  }

  return undefined;
}

/**
 * Check element visibility
 */
function isVisible(element: HTMLElement): boolean {
  if (!element) return false;

  const style = window.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.opacity === "0"
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Detect dynamic form loading and retry
 */
export function setupDynamicFormObserver(callback: () => void): void {
  // Run the callback when a form or input field is added
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            // Check whether a form or input field was added
            if (
              node.tagName === "FORM" ||
              node.tagName === "INPUT" ||
              node.querySelector("form") ||
              node.querySelector('input[type="password"]') ||
              node.querySelector('input[type="email"]')
            ) {
              console.log("[Shade] Dynamic form detected");
              callback();
              return;
            }
          }
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Automatically disconnect after 10 seconds
  setTimeout(() => {
    observer.disconnect();
  }, 10000);
}
