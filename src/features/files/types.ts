export type FileContext = "contents" | "logo";

export type StoredFile = {
  id: string;
  isUsed: boolean;
  size: number;
  url: string;
};

type SettingsImageContext =
  "article" | "project" | "service" | "content" | "logo" | "video";
export type ImageContext = SettingsImageContext | "approach";
export type ImageFilter = ImageContext | "editorial";

export type ImageRecord = {
  id: string;
  context: ImageContext;
  width: number;
  height: number;
  sizeBytes: number;
  contentType: "image/webp";
  previewUrl: string;
  thumbnailUrl?: string;
  thumb: string | null;
};

type ImageProfile = { width: number; height: number; size: number };
export type ImageProfiles = Record<SettingsImageContext, ImageProfile> & {
  thumbnail: Pick<ImageProfile, "width" | "height">;
};

export type VideoRecord = {
  id: string;
  sizeBytes: number;
  contentType: "video/mp4";
  previewUrl: string;
  thumbnailUrl: string | null;
};

export type MediaSource =
  { id: string; url?: never } | { url: string; id?: never };

export type VideoSource = MediaSource;

export type ImageReference = { id: string; url: string; thumb?: string | null };
export type VideoReference = { id: string | null; url: string };
