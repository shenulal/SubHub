/**
 * Login URL Configuration
 * Login-detection settings for SaaS services where basic detection failed
 */

export interface LoginConfig {
  /** URL patterns where the actual login happens */
  loginUrlPatterns?: string[];
  /** Selector to wait for while the login form renders */
  waitForSelector?: string;
  /** Button that must be clicked to show the login form */
  clickBeforeLogin?: string;
  /** Login type */
  type:
    | "redirect"
    | "spa"
    | "modal"
    | "shadow-dom"
    | "oauth-button"
    | "2-step"
    | "standard";
  /** Extra wait time (ms) */
  extraWaitTime?: number;
  /** OAuth provider (for the oauth-button type) */
  oauthProvider?: string;
  /** Custom selectors */
  selectors?: {
    email?: string;
    password?: string;
    submit?: string;
  };
}

/**
 * Per-domain login settings
 * The 15 services that failed in testing, plus special cases
 */
export const LOGIN_CONFIG: Record<string, LoginConfig> = {
  // ============================================
  // Redirect-based login (6)
  // ============================================

  // ChatGPT - redirects to Auth0
  "chat.openai.com": {
    loginUrlPatterns: ["auth0.openai.com", "auth.openai.com"],
    waitForSelector: 'input[name="email"], input[name="username"]',
    type: "redirect",
    extraWaitTime: 3000,
    selectors: {
      email: 'input[name="email"], input[name="username"]',
      password: 'input[name="password"]',
      submit: 'button[type="submit"], button[name="action"]',
    },
  },

  // Handle the Auth0 OpenAI domain directly
  "auth0.openai.com": {
    waitForSelector: 'input[name="email"], input[name="username"]',
    type: "standard",
    selectors: {
      email: 'input[name="email"], input[name="username"]',
      password: 'input[name="password"]',
      submit: 'button[type="submit"]',
    },
  },

  // Auth OpenAI domain (new auth URL)
  "auth.openai.com": {
    waitForSelector:
      'input[type="email"], input[name="email"], input[name="username"]',
    type: "2-step",
    extraWaitTime: 2000,
    selectors: {
      email: 'input[type="email"], input[name="email"], input[name="username"]',
      password: 'input[type="password"], input[name="password"]',
      submit: 'button[type="submit"]',
    },
  },

  // Claude - OAuth-first, needs the email login button
  "claude.ai": {
    clickBeforeLogin:
      'button:contains("email"), a:contains("email"), [data-testid*="email"]',
    waitForSelector: 'input[type="email"]',
    type: "modal",
    extraWaitTime: 2000,
    selectors: {
      email: 'input[type="email"]',
      submit: 'button[type="submit"]',
    },
  },

  // Okta - Sign-In Widget
  "login.okta.com": {
    waitForSelector: '#okta-sign-in, input[name="identifier"]',
    type: "redirect",
    extraWaitTime: 3000,
    selectors: {
      email:
        '#okta-signin-username, input[name="identifier"], input[name="username"]',
      password:
        '#okta-signin-password, input[name="credentials.passcode"], input[type="password"]',
      submit: '#okta-signin-submit, button[type="submit"]',
    },
  },

  // Buffer
  "login.buffer.com": {
    loginUrlPatterns: ["account.buffer.com"],
    waitForSelector: 'input[type="email"]',
    type: "redirect",
    extraWaitTime: 2000,
  },

  "account.buffer.com": {
    waitForSelector: 'input[type="email"]',
    type: "standard",
    selectors: {
      email: 'input[type="email"], input[name="email"]',
      password: 'input[type="password"]',
      submit: 'button[type="submit"]',
    },
  },

  // n8n
  "app.n8n.cloud": {
    loginUrlPatterns: ["app.n8n.cloud/signin", "app.n8n.cloud/login"],
    waitForSelector: 'input[type="email"]',
    type: "redirect",
    extraWaitTime: 2000,
    selectors: {
      email: 'input[type="email"]',
      password: 'input[type="password"]',
      submit: 'button[data-test-id="signin-button"], button[type="submit"]',
    },
  },

  // DataRobot
  "app.datarobot.com": {
    waitForSelector: 'input[name="email"], input[type="email"], #email',
    type: "redirect",
    extraWaitTime: 3000,
    selectors: {
      email: 'input[name="email"], #email, input[type="email"]',
      password: 'input[name="password"], #password, input[type="password"]',
      submit: 'button[type="submit"]',
    },
  },

  // ============================================
  // Dynamic SPA loading (5)
  // ============================================

  // Zendesk
  "www.zendesk.com": {
    waitForSelector: 'input[type="email"], input[name="email"]',
    type: "spa",
    extraWaitTime: 5000,
    selectors: {
      email: 'input[type="email"], input[name="email"]',
      password: 'input[type="password"], input[name="password"]',
      submit: 'button[type="submit"], input[type="submit"]',
    },
  },

  // Copy.AI
  "app.copy.ai": {
    waitForSelector: 'input[type="email"]',
    type: "spa",
    extraWaitTime: 4000,
    selectors: {
      email: 'input[type="email"], input[placeholder*="email" i]',
      password: 'input[type="password"]',
    },
  },

  // Consensus
  "consensus.app": {
    clickBeforeLogin:
      'button:contains("Sign in"), a:contains("Sign in"), [data-testid*="signin"]',
    waitForSelector: 'input[type="email"]',
    type: "spa",
    extraWaitTime: 3000,
  },

  // Pitch
  "app.pitch.com": {
    waitForSelector: 'input[type="email"]',
    type: "spa",
    extraWaitTime: 4000,
    selectors: {
      email: 'input[type="email"]',
      password: 'input[type="password"]',
      submit: 'button[type="submit"]',
    },
  },

  // Drift
  "app.drift.com": {
    waitForSelector: 'input[type="email"], input[formcontrolname="email"]',
    type: "spa",
    extraWaitTime: 4000,
    selectors: {
      email: 'input[type="email"], input[formcontrolname="email"]',
      password: 'input[type="password"], input[formcontrolname="password"]',
      submit: 'button[type="submit"]',
    },
  },

  // ============================================
  // Modal/popup based (3)
  // ============================================

  // Gamma
  "gamma.app": {
    clickBeforeLogin:
      'button:contains("Sign in"), a:contains("Sign in"), [data-testid*="signin"]',
    waitForSelector:
      '[role="dialog"] input[type="email"], .modal input[type="email"]',
    type: "modal",
    extraWaitTime: 2000,
    selectors: {
      email: 'input[type="email"]',
    },
  },

  // Tome
  "tome.app": {
    clickBeforeLogin:
      'button:contains("Log in"), a:contains("Log in"), [data-testid*="login"]',
    waitForSelector: 'input[type="email"]',
    type: "modal",
    extraWaitTime: 2000,
  },

  // Ideogram
  "ideogram.ai": {
    clickBeforeLogin:
      'button:contains("Sign in"), a:contains("Sign in"),[data-testid*="signin"]',
    waitForSelector: '[role="dialog"], .modal',
    type: "modal",
    extraWaitTime: 2000,
  },

  // ============================================
  // Shadow DOM (2)
  // ============================================

  // Vercel v0
  "v0.dev": {
    waitForSelector: 'input[type="email"]',
    type: "shadow-dom",
    extraWaitTime: 3000,
  },

  // Cursor - Shadow DOM based login
  "cursor.sh": {
    waitForSelector: 'input[type="email"], input[name="email"]',
    type: "shadow-dom",
    extraWaitTime: 3000,
    selectors: {
      email: 'input[type="email"], input[name="email"]',
      password: 'input[type="password"]',
      submit: 'button[type="submit"]',
    },
  },

  "cursor.com": {
    waitForSelector: 'input[type="email"], input[name="email"]',
    type: "shadow-dom",
    extraWaitTime: 3000,
    selectors: {
      email: 'input[type="email"], input[name="email"]',
      password: 'input[type="password"]',
      submit: 'button[type="submit"]',
    },
  },

  // ============================================
  // OAuth button → redirect (3)
  // ============================================

  // Gemini - supports Google OAuth only
  "gemini.google.com": {
    clickBeforeLogin: 'a[href*="signin"], button:contains("Sign in")',
    type: "oauth-button",
    oauthProvider: "accounts.google.com",
    extraWaitTime: 2000,
  },

  "bard.google.com": {
    clickBeforeLogin: 'a[href*="signin"], button:contains("Sign in")',
    type: "oauth-button",
    oauthProvider: "accounts.google.com",
    extraWaitTime: 2000,
  },

  // Perplexity
  "www.perplexity.ai": {
    clickBeforeLogin: 'button:contains("Sign in"), a:contains("Sign in")',
    type: "oauth-button",
    extraWaitTime: 2000,
  },

  // ============================================
  // 2-step login (2)
  // ============================================

  // Microsoft - two steps: email → password
  "login.live.com": {
    waitForSelector: 'input[type="email"], input[name="loginfmt"]',
    type: "2-step",
    extraWaitTime: 2000,
    selectors: {
      email: 'input[type="email"], input[name="loginfmt"]',
      password: 'input[type="password"], input[name="passwd"]',
      submit: 'input[type="submit"], button[type="submit"]',
    },
  },

  "login.microsoftonline.com": {
    waitForSelector: 'input[type="email"], input[name="loginfmt"]',
    type: "2-step",
    extraWaitTime: 2000,
    selectors: {
      email: 'input[type="email"], input[name="loginfmt"]',
      password: 'input[type="password"], input[name="passwd"]',
      submit: 'input[type="submit"], button[type="submit"]',
    },
  },

  // GitHub - regular login form (not Shadow DOM)
  "github.com": {
    waitForSelector: 'input[name="login"], input[id="login_field"]',
    type: "standard",
    extraWaitTime: 1000,
    selectors: {
      email: 'input[name="login"], input[id="login_field"]',
      password: 'input[name="password"], input[id="password"]',
      submit: 'input[type="submit"], button[type="submit"]',
    },
  },
};

/**
 * Get the login settings for the current domain
 */
export function getLoginConfig(hostname: string): LoginConfig | null {
  // Exact match
  if (LOGIN_CONFIG[hostname]) {
    return LOGIN_CONFIG[hostname];
  }

  // Match after stripping www
  const withoutWww = hostname.replace(/^www\./, "");
  if (LOGIN_CONFIG[withoutWww]) {
    return LOGIN_CONFIG[withoutWww];
  }

  // Subdomain pattern match (e.g. *.okta.com)
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    // Check tenant.okta.com -> okta.com
    const baseDomain = parts.slice(-2).join(".");
    if (hostname.includes(".okta.") || hostname.endsWith(".okta.com")) {
      return LOGIN_CONFIG["login.okta.com"];
    }
  }

  return null;
}

/**
 * Check whether the URL is a redirect URL
 */
export function isRedirectLoginUrl(url: string): boolean {
  const hostname = new URL(url).hostname;

  for (const config of Object.values(LOGIN_CONFIG)) {
    if (config.loginUrlPatterns) {
      for (const pattern of config.loginUrlPatterns) {
        if (hostname.includes(pattern) || url.includes(pattern)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * List of all configured domains
 */
export function getAllConfiguredDomains(): string[] {
  return Object.keys(LOGIN_CONFIG);
}
