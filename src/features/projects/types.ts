import type {
  MediaSource,
  VideoReference,
  VideoSource,
} from "@/features/files";

type ProjectWatch = { label: string; url: string };

export type ProjectInput = {
  title: string;
  slug: string;
  serviceSlug: string;
  isFeatured: boolean;
  description: string;
  poster: MediaSource;
  video?: VideoSource;
  preview?: VideoSource;
  watch?: ProjectWatch;
};

type EmptySource = Record<string, never>;

export type ProjectPatch = Partial<
  Omit<ProjectInput, "video" | "preview" | "watch">
> & {
  video?: VideoSource | EmptySource;
  preview?: VideoSource | EmptySource;
  watch?: ProjectWatch | EmptySource;
};

export type ProjectRecord = Omit<
  ProjectInput,
  "serviceSlug" | "poster" | "video" | "preview" | "watch"
> & {
  service: { name: string; slug: string };
  poster: { id: string | null; url: string; thumb: string | null };
  video: VideoReference | null;
  preview: VideoReference | null;
  watch: ProjectWatch | null;
};
