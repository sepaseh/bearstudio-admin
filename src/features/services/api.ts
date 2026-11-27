import { apiClient } from "@/shared/api";

import type { ServiceCatalog, ServiceGroup, ServiceRequest } from "./types";

const basePath = "/admin/services";
const servicePath = (slug: string) => `${basePath}/${slug}`;

export const fetchServices = (signal?: AbortSignal): Promise<ServiceCatalog> =>
  apiClient.get<ServiceCatalog>(basePath, { signal });

export const fetchService = (
  slug: string,
  signal?: AbortSignal,
): Promise<ServiceGroup> =>
  apiClient.get<ServiceGroup>(servicePath(slug), { signal });

export const createService = (
  { title, slug, description, tags, imageIds }: ServiceRequest,
  signal?: AbortSignal,
): Promise<ServiceGroup> =>
  apiClient.post<ServiceGroup>(
    basePath,
    {
      title,
      slug,
      description,
      tags,
      imageIds,
    },
    { signal },
  );

export const updateService = (
  currentSlug: string,
  { title, slug, description, tags, imageIds }: ServiceRequest,
  signal?: AbortSignal,
): Promise<ServiceGroup> =>
  apiClient.patch<ServiceGroup>(
    servicePath(currentSlug),
    {
      title,
      slug,
      description,
      tags,
      imageIds,
    },
    { signal },
  );

export const deleteService = (
  slug: string,
  signal?: AbortSignal,
): Promise<void> => apiClient.del<void>(servicePath(slug), { signal });

export const sortServices = (
  { slugs }: { slugs: string[] },
  signal?: AbortSignal,
): Promise<void> =>
  apiClient.patch<void>(basePath + "/sort", { slugs }, { signal });
