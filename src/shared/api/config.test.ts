import { expect, it } from "vitest";

import { apiUrl } from "./config";

it("uses the API path on the panel origin", () => {
  expect(apiUrl).toBe("/api/v1");
});
