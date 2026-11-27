import { beforeEach, expect, it, vi } from "vitest";

import {
  createProject,
  deleteProject,
  fetchProject,
  fetchProjects,
  sortProjects,
  updateProject,
} from "./api";

const { get, post, patch, put, del } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));
vi.mock("@/shared/api", () => ({ apiClient: { get, post, patch, put, del } }));
beforeEach(() => vi.resetAllMocks());

const slug = "synthetic-project";
const posterImageId = "22222222-2222-4222-8222-222222222222";
const signal = new AbortController().signal;

it("returns the complete project array without query parameters", async () => {
  const projects = [
    {
      slug,
      service: { name: "Animation", slug: "animation" },
      isFeatured: false,
      poster: {
        id: posterImageId,
        url: `/api/v1/public/images/${posterImageId}`,
        thumb: `/api/v1/public/images/${posterImageId}/thumbnail`,
      },
    },
  ];
  get.mockResolvedValue(projects);
  await expect(fetchProjects(signal)).resolves.toEqual(projects);
  expect(get).toHaveBeenCalledExactlyOnceWith("/admin/projects", {
    signal,
  });
});

it("passes native project fields and the existing explicit clear objects", async () => {
  const input = {
    serviceSlug: "animation",
    isFeatured: true,
    title: "Synthetic project",
    slug,
    poster: { id: posterImageId },
    description: "",
    watch: { label: "Official watch page", url: "https://example.test/work" },
  };
  await createProject(input, signal);
  const changed = {
    slug: "renamed-project",
    isFeatured: false,
    serviceSlug: "production",
    poster: { url: "https://example.test/new-poster.webp" },
    preview: {},
    video: {},
  };
  await updateProject(slug, changed, signal);
  expect(post).toHaveBeenCalledExactlyOnceWith("/admin/projects", input, {
    signal,
  });
  expect(patch).toHaveBeenCalledExactlyOnceWith(
    "/admin/projects/" + slug,
    changed,
    { signal },
  );
});

it("saves the complete project slug order, including a project named sort", async () => {
  const slugs = ["sort", slug];
  await sortProjects(slugs, signal);
  expect(put).toHaveBeenCalledExactlyOnceWith(
    "/admin/projects/sort",
    { slugs },
    { signal },
  );
});

it("reads and deletes by slug without a request body", async () => {
  await fetchProject(slug, signal);
  await deleteProject(slug, signal);
  expect(get).toHaveBeenCalledExactlyOnceWith("/admin/projects/" + slug, {
    signal,
  });
  expect(del).toHaveBeenCalledExactlyOnceWith("/admin/projects/" + slug, {
    signal,
  });
});
