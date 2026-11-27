import { apiClient } from "@/shared/api";

import type { ProjectInput, ProjectPatch, ProjectRecord } from "./types";

const root = "/admin/projects";
const recordPath = (slug: string) => `${root}/${slug}`;

export const fetchProjects = (signal?: AbortSignal): Promise<ProjectRecord[]> =>
  apiClient.get<ProjectRecord[]>(root, { signal });
export const fetchProject = (slug: string, signal?: AbortSignal) =>
  apiClient.get<ProjectRecord>(recordPath(slug), { signal });

export const createProject = (input: ProjectInput, signal?: AbortSignal) =>
  apiClient.post<ProjectRecord>(root, input, { signal });

export const updateProject = (
  slug: string,
  input: ProjectPatch,
  signal?: AbortSignal,
) => apiClient.patch<ProjectRecord>(recordPath(slug), input, { signal });

export const sortProjects = (slugs: string[], signal?: AbortSignal) =>
  apiClient.put<void>(root + "/sort", { slugs }, { signal });

export const deleteProject = (slug: string, signal?: AbortSignal) =>
  apiClient.del<void>(recordPath(slug), { signal });
