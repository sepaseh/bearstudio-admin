import { apiClient } from "@/shared/api";

import type { Faq, FaqCatalog, FaqRequest } from "./types";

const basePath = "/admin/faqs";
const faqPath = (id: Faq["id"]) => `${basePath}/${id}`;

export const fetchFaqs = (signal?: AbortSignal): Promise<FaqCatalog> =>
  apiClient.get<FaqCatalog>(basePath, { signal });

export const fetchFaq = (id: Faq["id"], signal?: AbortSignal): Promise<Faq> =>
  apiClient.get<Faq>(faqPath(id), { signal });

export const createFaq = (
  { answer, question }: FaqRequest,
  signal?: AbortSignal,
): Promise<Faq> =>
  apiClient.post<Faq>(basePath, { answer, question }, { signal });

export const updateFaq = (
  id: Faq["id"],
  { answer, question }: Partial<FaqRequest>,
  signal?: AbortSignal,
): Promise<Faq> =>
  apiClient.patch<Faq>(faqPath(id), { answer, question }, { signal });

export const deleteFaq = (id: Faq["id"], signal?: AbortSignal): Promise<void> =>
  apiClient.del<void>(faqPath(id), { signal });

export const sortFaqs = (
  { ids }: { ids: Faq["id"][] },
  signal?: AbortSignal,
): Promise<void> =>
  apiClient.patch<void>(basePath + "/sort", { ids }, { signal });
