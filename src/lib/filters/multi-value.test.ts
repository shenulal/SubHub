// src/lib/filters/multi-value.test.ts
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  inFilter,
  mergeLegacyValue,
  multiValueSchema,
  parseMultiEnum,
  parseMultiValue,
  parseOptionalMultiValue,
  readMultiParam,
  serializeMultiValue,
} from "./multi-value";

describe("multi-value helpers", () => {
  it("splits comma-separated values, trims and de-duplicates", () => {
    expect(parseMultiValue(" a, b,,a ")).toEqual(["a", "b"]);
    expect(parseMultiValue(["a,b", "c"])).toEqual(["a", "b", "c"]);
    expect(parseMultiValue(undefined)).toEqual([]);
    expect(parseOptionalMultiValue(",")).toBeUndefined();
  });

  it("keeps only allowed enum values", () => {
    expect(parseMultiEnum("A,X,B", ["A", "B"] as const)).toEqual(["A", "B"]);
    expect(parseMultiEnum("X", ["A"] as const)).toBeUndefined();
  });

  it("serialises lists for URLs and drops empty selections", () => {
    expect(serializeMultiValue(["a", "b"])).toBe("a,b");
    expect(serializeMultiValue([])).toBeUndefined();
  });

  it("reads repeated and comma-separated URL params", () => {
    const params = new URLSearchParams("team=a,b&team=c");
    expect(readMultiParam(params, "team")).toEqual(["a", "b", "c"]);
    expect(readMultiParam(params, "missing")).toBeUndefined();
  });

  it("merges a legacy single value into a list", () => {
    expect(mergeLegacyValue(["a"], "b")).toEqual(["a", "b"]);
    expect(mergeLegacyValue(undefined, "a")).toEqual(["a"]);
    expect(mergeLegacyValue([], undefined)).toBeUndefined();
  });

  it("builds Prisma equality / in clauses (empty = no filter)", () => {
    expect(inFilter([])).toBeUndefined();
    expect(inFilter(["a"])).toBe("a");
    expect(inFilter(["a", "b"])).toEqual({ in: ["a", "b"] });
  });

  it("zod schema accepts arrays, CSV strings and legacy single values", () => {
    const schema = z.object({ ids: multiValueSchema(z.string().min(1)) });
    expect(schema.parse({ ids: ["a", "b"] }).ids).toEqual(["a", "b"]);
    expect(schema.parse({ ids: "a,b" }).ids).toEqual(["a", "b"]);
    expect(schema.parse({ ids: "a" }).ids).toEqual(["a"]);
    expect(schema.parse({ ids: "" }).ids).toBeUndefined();
    expect(schema.parse({}).ids).toBeUndefined();
    expect(schema.safeParse({ ids: 5 }).success).toBe(false);
  });
});
