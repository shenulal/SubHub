import { describe, expect, it } from "vitest";
import { buildZip, crc32 } from "./zip";

describe("zip writer", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(Buffer.from("123456789")).toString(16)).toBe("cbf43926");
    expect(crc32(Buffer.alloc(0))).toBe(0);
  });

  it("produces a well-formed stored archive", () => {
    const zip = buildZip(
      [
        { name: "data.json", data: '{"a":1}' },
        { name: "rows.csv", data: Buffer.from("a,b\n1,2\n") },
      ],
      new Date("2026-11-04T12:30:10Z")
    );
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
    expect(zip.readUInt16LE(zip.length - 22 + 10)).toBe(2);
    expect(zip.toString("latin1")).toContain("data.json");
    expect(zip.toString("latin1")).toContain("rows.csv");
    expect(zip.readUInt32LE(14)).toBe(crc32(Buffer.from('{"a":1}')));
  });
});
