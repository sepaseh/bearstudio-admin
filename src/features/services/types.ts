type ServiceImage = { id: string; url: string; thumb: string | null };

type ServiceFields = {
  title: string;
  slug: string;
  description: string;
  tags: string[];
};

export type ServiceRequest = ServiceFields & {
  imageIds: string[];
};

export type ServiceGroup = ServiceFields & {
  images: ServiceImage[];
};

export type ServiceCatalog = { items: ServiceGroup[] };
