// @vitest-environment node
import { describe, expect, it } from "vitest";

import { reorderRows } from "./reorder-rows";

const first = { id: "first", name: "First record" };
const second = { id: "second", name: "Second record" };
const third = { id: "third", name: "Third record" };

describe("reorderRows", () => {
  it.each([
    ["first", "third", [second, third, first]],
    ["third", "first", [third, first, second]],
  ] as const)(
    "moves %s to %s without mutating the records",
    (from, to, expected) => {
      const records = [first, second, third];

      const reordered = reorderRows(records, from, to);

      expect(records).toEqual([first, second, third]);
      expect(reordered).not.toBe(records);
      expect(reordered).toHaveLength(expected.length);
      for (const [index, record] of expected.entries())
        expect(reordered?.[index]).toBe(record);
    },
  );

  it.each([
    ["first", undefined],
    ["first", "first"],
    ["missing", "second"],
    ["first", "missing"],
    [1, "first"],
    ["first", 1],
  ] as const)("ignores a drop from %s to %s", (from, to) => {
    expect(reorderRows([first, second, third], from, to)).toBeUndefined();
  });

  it("ignores a drop on an empty table", () => {
    expect(reorderRows([], "first", "second")).toBeUndefined();
  });
});
