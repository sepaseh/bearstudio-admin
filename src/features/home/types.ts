import type { VideoReference, VideoSource } from "@/features/files";

type HomeImageReference = { imageId: string };
type HomeImageInput = HomeImageReference & { alt: string };
type HomeImageRecord = HomeImageInput & { url: string; thumb: string | null };

export type HomeInput = {
  heroDescription: string;
  heroVideo: VideoSource;
  heroPoster: HomeImageReference;
  aboutTitle: string;
  aboutSubtitle: string;
  aboutDescription: string;
  aboutVideo: VideoSource | null;
  aboutPoster: HomeImageInput | null;
  approach: { title: string; image: HomeImageReference }[];
  whyTitle: string;
  whySubtitle: string;
  whyDescription: string;
  whyImage: HomeImageReference;
};

export type HomeContent = Omit<
  HomeInput,
  | "heroPoster"
  | "heroVideo"
  | "aboutPoster"
  | "aboutVideo"
  | "approach"
  | "whyImage"
> & {
  heroPoster: HomeImageRecord;
  heroVideo: VideoReference;
  aboutPoster: HomeImageRecord | null;
  aboutVideo: VideoReference | null;
  approach: { title: string; image: HomeImageRecord }[];
  whyImage: HomeImageRecord;
};

export type HomeRecord = {
  key: "home";
  content: HomeContent;
};
