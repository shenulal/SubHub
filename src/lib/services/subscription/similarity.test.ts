import { describe, expect, it } from "vitest";
import {
  diceCoefficient,
  jaroWinkler,
  nameSimilarity,
  normalizeDomain,
  normalizeName,
} from "./similarity";

describe("normalizeName", () => {
  it("lower-cases, strips punctuation and legal suffixes", () => {
    expect(normalizeName("Slack Technologies, Inc.")).toBe(
      "slack technologies"
    );
    expect(normalizeName("  Notion   Labs LTD ")).toBe("notion labs");
  });

  it("strips accents", () => {
    expect(normalizeName("Café GmbH")).toBe("cafe");
  });
});

describe("normalizeDomain", () => {
  it("removes protocol, www and path", () => {
    expect(normalizeDomain("https://www.Slack.com/pricing?x=1")).toBe(
      "slack.com"
    );
    expect(normalizeDomain(null)).toBe("");
  });
});

describe("diceCoefficient", () => {
  it("returns 1 for identical strings and 0 for disjoint", () => {
    expect(diceCoefficient("slack", "slack")).toBe(1);
    expect(diceCoefficient("abc", "xyz")).toBe(0);
  });

  it("returns 0 for single-character inputs", () => {
    expect(diceCoefficient("a", "ab")).toBe(0);
  });

  it("is high for near matches", () => {
    expect(diceCoefficient("github", "githb")).toBeGreaterThan(0.6);
  });
});

describe("jaroWinkler", () => {
  it("rewards common prefixes", () => {
    expect(jaroWinkler("martha", "marhta")).toBeCloseTo(0.961, 2);
    expect(jaroWinkler("abc", "")).toBe(0);
    expect(jaroWinkler("abc", "xyz")).toBe(0);
  });
});

describe("nameSimilarity", () => {
  it("treats legal-suffix variants as identical", () => {
    expect(nameSimilarity("Slack Inc", "slack")).toBe(1);
  });

  it("scores typos above a typical threshold", () => {
    expect(nameSimilarity("Figma", "Figna")).toBeGreaterThan(0.8);
  });

  it("scores unrelated names low", () => {
    expect(nameSimilarity("Figma", "Zendesk")).toBeLessThan(0.6);
  });

  it("returns 0 for empty names", () => {
    expect(nameSimilarity("", "Figma")).toBe(0);
  });
});
