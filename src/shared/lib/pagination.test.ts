import { describe, expect, it } from "vitest";

import { getPage } from "./pagination";

describe("getPage", () => {
  it.each([
    ["1", 1],
    ["24", 24],
    [" 004 ", 4],
  ])("normalizes the page %j to %i", (page, expected) => {
    expect(getPage(page)).toBe(expected);
  });

  it.each([undefined, "", "invalid", "0", "-2"])(
    "uses page 1 for %j",
    (page) => {
      expect(getPage(page)).toBe(1);
    },
  );

  it.each([
    ["3.5", 3],
    ["4suffix", 4],
  ])("reads the decimal integer prefix of %j as %i", (page, expected) => {
    expect(getPage(page)).toBe(expected);
  });
});
