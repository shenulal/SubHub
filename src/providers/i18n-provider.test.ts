import { describe, expect, it } from "vitest";
import { i18nProvider } from "./i18n-provider";

describe("i18nProvider", () => {
  it("returns the default locale", () => {
    expect(i18nProvider.getLocale?.()).toBe("en");
  });

  it("can change the locale and ignores unsupported locales", async () => {
    await i18nProvider.changeLocale?.("en");
    expect(i18nProvider.getLocale?.()).toBe("en");
    await i18nProvider.changeLocale?.("ko");
    expect(i18nProvider.getLocale?.()).toBe("en");
  });

  it("returns the translation when the key exists, otherwise the key itself", () => {
    const t = i18nProvider.translate;
    expect(t?.("buttons.save")).toBe("Save");
    expect(t?.("nonexistent.key")).toBe("nonexistent.key");
  });
});
