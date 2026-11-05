import { I18nProvider } from "@refinedev/core";

type Locale = "en";

const messages: Record<Locale, Record<string, string>> = {
  en: {
    "buttons.create": "Create",
    "buttons.edit": "Edit",
    "buttons.delete": "Delete",
    "buttons.show": "Show",
    "buttons.save": "Save",
    "buttons.cancel": "Cancel",
    "buttons.refresh": "Refresh",
  },
};

let currentLocale: Locale = "en";

/**
 * Refine I18nProvider skeleton.
 * - Initially covers only the main button keys; to be extended to pages/notifications later.
 */
export const i18nProvider: I18nProvider = {
  translate: (key: string, options?: Record<string, unknown>) => {
    const template = messages[currentLocale]?.[key];
    if (!template) {
      return key;
    }

    if (!options) {
      return template;
    }

    return Object.entries(options).reduce(
      (acc, [optionKey, value]) =>
        acc.replace(`{{${optionKey}}}`, String(value)),
      template
    );
  },
  changeLocale: async (lang: string) => {
    if (lang === "en") {
      currentLocale = lang;
    }
    return Promise.resolve();
  },
  getLocale: () => currentLocale,
};
