import { describe, expect, it } from "vitest";

import {
  SAAS_CATALOG_SEED,
  SUBCATEGORY_PARENT,
  slugify,
  toCatalogRow,
  validateCatalogSeed,
} from "./saas-catalog";

describe("saas-catalog seed", () => {
  it("contains at least 120 services with unique slugs and names", () => {
    expect(SAAS_CATALOG_SEED.length).toBeGreaterThanOrEqual(120);
    expect(validateCatalogSeed(SAAS_CATALOG_SEED)).toEqual([]);
    expect(new Set(SAAS_CATALOG_SEED.map((e) => e.name)).size).toBe(
      SAAS_CATALOG_SEED.length
    );
  });
  it("maps every entry to a known parent category", () => {
    for (const entry of SAAS_CATALOG_SEED) {
      expect(SUBCATEGORY_PARENT[entry.sub], entry.name).toBeTruthy();
    }
  });
  it("derives rows with logo, website and domain alias", () => {
    const row = toCatalogRow({
      name: "Acme & Co",
      domain: "acme.io",
      sub: "Marketing",
      steps: ["a", "b", "c"],
    });
    expect(row.slug).toBe("acme-and-co");
    expect(row.category).toBe("Software");
    expect(row.logoUrl).toContain("acme.io");
    expect(row.website).toBe("https://acme.io");
    expect(row.aliases).toContain("acme.io");
    expect(row.basePriceCurrency).toBe("USD");
  });
  it("flags invalid entries", () => {
    expect(
      validateCatalogSeed([
        { name: "X", domain: "x.io", sub: "Nope", steps: ["1"] },
      ])
    ).toEqual(["unknown subcategory: X → Nope", "steps out of range: X"]);
    expect(slugify("Fly.io")).toBe("fly-io");
  });
});
