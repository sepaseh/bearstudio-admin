import { beforeEach, expect, it, vi } from "vitest";

import { apiClient } from "@/shared/api";

import { fetchHome, saveHome } from "./api";
import type { HomeInput } from "./types";

vi.mock("@/shared/api", () => ({
  apiClient: { get: vi.fn(), put: vi.fn() },
}));

beforeEach(() => vi.resetAllMocks());

it("reads Home at its singleton path", async () => {
  const { signal } = new AbortController();
  await fetchHome(signal);

  expect(apiClient.get).toHaveBeenCalledExactlyOnceWith("/admin/pages/home", {
    signal,
  });
});

it("replaces the whole Home content at its singleton path", async () => {
  const { signal } = new AbortController();
  const image = { imageId: "a1000000-0000-4000-8000-000000000001" };
  const approachImageId = "a1000000-0000-4000-8000-000000000002";
  const projectImageId = "a1000000-0000-4000-8000-000000000004";
  const values: HomeInput = {
    heroDescription: "Synthetic introduction.",
    heroVideo: { url: "https://example.test/hero.mp4" },
    heroPoster: image,
    aboutTitle: "About the studio",
    aboutSubtitle: "",
    aboutDescription: "Synthetic About description.",
    aboutVideo: null,
    aboutPoster: null,
    approach: [
      "First approach",
      "Second approach",
      "Third approach",
      "Fourth approach",
    ].map((title) => ({
      title,
      image: { imageId: approachImageId },
    })),
    whyTitle: "Why this studio",
    whySubtitle: "",
    whyDescription: "Synthetic Why description.",
    whyImage: { imageId: projectImageId },
  };

  await saveHome(values, signal);

  expect(apiClient.put).toHaveBeenCalledExactlyOnceWith(
    "/admin/pages/home",
    values,
    { signal },
  );
});
