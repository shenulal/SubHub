import { applyRequestSubmitPolyfill } from "@/test-utils/request-submit-polyfill";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect, vi } from "vitest";
import { getAllMessages } from "./src/i18n/messages";

const enMessages = getAllMessages("en");

/**
 * Minimal ICU MessageFormat support for the next-intl test stub: resolves
 * `{n, plural, =0 {…} one {# item} other {# items}}` and `{k, select, a {…} other {…}}`
 * before plain `{var}` substitution, so English plural messages render as in the app.
 */
function formatIcuMessage(
  message: string,
  values?: Record<string, unknown>
): string {
  const vals = values ?? {};
  const branched = message.replace(
    /\{(\w+),\s*(plural|select),\s*((?:[^{}]|\{[^{}]*\})*)\}/g,
    (_match, name: string, kind: string, body: string) => {
      const options = new Map<string, string>();
      for (const opt of body.matchAll(/(=?[\w-]+)\s*\{([^{}]*)\}/g)) {
        options.set(opt[1], opt[2]);
      }
      const raw = vals[name];
      let chosen: string | undefined;
      if (kind === "plural") {
        const n = Number(raw);
        chosen =
          options.get(`=${n}`) ??
          (n === 1 ? options.get("one") : undefined) ??
          options.get("other");
        return (chosen ?? "").replace(/#/g, String(raw));
      }
      chosen = options.get(String(raw)) ?? options.get("other");
      return chosen ?? "";
    }
  );
  return Object.entries(vals).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)),
    branched
  );
}

// Extend expect with jest-dom matchers
expect.extend(matchers);

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: () => new Headers(),
}));

// next-intl: stub that resolves keys against the English messages where possible.
// Falls back to the key when a message is not found (compatible with unit
// tests that don't care about translation text).
vi.mock("next-intl", async () => {
  const actual = await vi.importActual<typeof import("next-intl")>("next-intl");

  const lookup = (
    namespace: string,
    key: string,
    values?: Record<string, unknown>
  ): string => {
    const full = namespace ? `${namespace}.${key}` : key;
    const parts = full.split(".");
    let node: unknown = enMessages;
    for (const part of parts) {
      if (node && typeof node === "object" && part in (node as object)) {
        node = (node as Record<string, unknown>)[part];
      } else {
        return full;
      }
    }
    if (typeof node !== "string") return full;
    return formatIcuMessage(node, values);
  };

  return {
    ...actual,
    useTranslations: (namespace = "") => {
      const fn = (key: string, values?: Record<string, unknown>) =>
        lookup(namespace, key, values);
      (fn as unknown as { rich: (k: string) => string }).rich = (k: string) =>
        lookup(namespace, k);
      (fn as unknown as { raw: (k: string) => unknown }).raw = (k: string) =>
        lookup(namespace, k);
      return fn;
    },
    useLocale: () => "en",
    useFormatter: () => ({
      dateTime: (d: Date) => d.toISOString(),
      number: (n: number) => String(n),
      relativeTime: (d: Date) => d.toISOString(),
    }),
    getTranslations:
      async (namespace = "") =>
      (key: string, values?: Record<string, unknown>) =>
        lookup(namespace, key, values),
  };
});

// next-intl/server: Server Component subpath mock
vi.mock("next-intl/server", () => {
  const lookup = (
    namespace: string,
    key: string,
    values?: Record<string, unknown>
  ): string => {
    const full = namespace ? `${namespace}.${key}` : key;
    const parts = full.split(".");
    let node: unknown = enMessages;
    for (const part of parts) {
      if (node && typeof node === "object" && part in (node as object)) {
        node = (node as Record<string, unknown>)[part];
      } else {
        return full;
      }
    }
    if (typeof node !== "string") return full;
    return formatIcuMessage(node, values);
  };

  return {
    getTranslations: async (namespace = "") => {
      const fn = (key: string, values?: Record<string, unknown>) =>
        lookup(namespace as string, key, values);
      (fn as unknown as { rich: (k: string) => string }).rich = (k: string) =>
        lookup(namespace as string, k);
      (fn as unknown as { raw: (k: string) => unknown }).raw = (k: string) =>
        lookup(namespace as string, k);
      return fn;
    },
    getLocale: async () => "en",
    getFormatter: async () => ({
      dateTime: (d: Date) => d.toISOString(),
      number: (n: number) => String(n),
      relativeTime: (d: Date) => d.toISOString(),
    }),
    getMessages: async () => enMessages,
  };
});

// Mock ResizeObserver (needed by shadcn/ui components)
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver (fires the callback immediately so count-up animations run)
// Defined as a class so `new IntersectionObserver(...)` works
global.IntersectionObserver = class MockIntersectionObserver {
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  constructor(callback: IntersectionObserverCallback) {
    this.observe = vi.fn((element: Element) => {
      callback(
        [
          {
            isIntersecting: true,
            target: element,
          } as IntersectionObserverEntry,
        ],
        this as unknown as IntersectionObserver
      );
    });
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
  }
} as unknown as typeof IntersectionObserver;

// Mock framer-motion (jsdom compatible)
vi.mock("framer-motion", async () => {
  const React = await import("react");

  // motion proxy: falls back to plain elements for HTML tags
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, prop: string) => {
        const Component = React.forwardRef(function MotionMock(
          props: Record<string, unknown>,
          ref: React.Ref<HTMLElement>
        ) {
          const {
            initial: _initial,
            animate: _animate,
            exit: _exit,
            variants: _variants,
            whileInView: _whileInView,
            whileHover: _whileHover,
            whileTap: _whileTap,
            viewport: _viewport,
            transition: _transition,
            layout: _layout,
            layoutId: _layoutId,
            onAnimationComplete: _onAnimationComplete,
            ...rest
          } = props;
          return React.createElement(prop, { ...rest, ref });
        });
        Component.displayName = `motion.${prop}`;
        return Component;
      },
    }
  );

  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useAnimation: () => ({
      start: vi.fn(),
      stop: vi.fn(),
      set: vi.fn(),
    }),
    useInView: () => true,
    // Mock animate(): calls onUpdate immediately with the final value
    animate: (
      from: number,
      to: number,
      options?: { onUpdate?: (v: number) => void }
    ) => {
      options?.onUpdate?.(to);
      return { stop: vi.fn(), cancel: vi.fn() };
    },
  };
});

// Mock scrollTo
window.scrollTo = vi.fn();

// jsdom lacks requestSubmit (shared polyfill)
applyRequestSubmitPolyfill();

// Filter test noise such as NEXT_REDIRECT
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const hasRedirect = args.some((arg) => {
    if (typeof arg === "string" && arg.includes("NEXT_REDIRECT")) return true;
    if (arg instanceof Error) {
      const digest = (arg as { digest?: string }).digest;
      if (typeof digest === "string" && digest.includes("NEXT_REDIRECT"))
        return true;
      if (arg.message.includes("NEXT_REDIRECT")) return true;
    }
    // Also check the string form (guards against unknown types)
    if (String(arg).includes("NEXT_REDIRECT")) return true;
    return false;
  });

  if (hasRedirect) {
    return;
  }

  originalConsoleError(...args);
};
