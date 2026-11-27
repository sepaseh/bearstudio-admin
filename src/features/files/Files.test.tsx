import { CoreContext, type CoreContextValue } from "@/app/contexts";
import { act, fireEvent, waitFor } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n";
import * as VideoUploadModule from "@/shared/ui/video-upload";
import { deferred } from "@/test/deferred";
import { render, screen } from "@/test/render";

import { fetchImages, fetchVideos, uploadVideo } from "./api";
import {
  ManagedImagePicker,
  ManagedVideoPicker,
} from "./components/MediaPicker";
import { VideoSourcePicker } from "./components/VideoSourcePicker";
import type { ImageRecord, VideoRecord, VideoSource } from "./types";

vi.mock("./api", () => ({
  fetchImages: vi.fn(),
  fetchVideos: vi.fn(),
  uploadVideo: vi.fn(),
}));
vi.mock("@/shared/ui/video-upload", async (importOriginal) => ({
  ...(await importOriginal<typeof VideoUploadModule>()),
  captureVideoThumbnail: vi.fn(),
}));

const photo: ImageRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  context: "article",
  width: 320,
  height: 180,
  sizeBytes: 800,
  contentType: "image/webp",
  previewUrl: "/api/v1/public/images/11111111-1111-4111-8111-111111111111",
  thumb: "/api/v1/public/images/11111111-1111-4111-8111-111111111111/thumbnail",
};
const fixturePhoto = (sequence: number): ImageRecord => {
  const id = photo.id.slice(0, -12) + String(sequence).padStart(12, "0");
  return {
    ...photo,
    id,
    previewUrl: "/api/v1/public/images/" + id,
    thumb: null,
  };
};
const video: VideoRecord = {
  id: "22222222-2222-4222-8222-222222222222",
  thumbnailUrl: null,
  sizeBytes: 4096,
  contentType: "video/mp4",
  previewUrl: "/test-delivery/film.mp4",
};
const square = { width: 200, height: 200, size: 10_485_760 };
const profiles = {
  article: square,
  logo: square,
  project: square,
  service: square,
  thumbnail: { width: square.width, height: square.height },
  video: square,
};

const renderPicker = (permissions: string[], picker: ReactNode) =>
  render(
    <CoreContext.Provider
      value={
        {
          settings: {
            uploadProfiles: {
              ...profiles,
              content: { width: 1600, height: 900, size: 5 * 1024 * 1024 },
            },
          },
        } as unknown as CoreContextValue
      }
    >
      <MemoryRouter>
        <Routes>
          <Route
            element={<Outlet context={{ currentUser: { permissions } }} />}
          >
            <Route index element={picker} />
          </Route>
        </Routes>
      </MemoryRouter>
    </CoreContext.Provider>,
  );

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(fetchImages).mockResolvedValue({ items: [photo], total: 1 });
  vi.mocked(fetchVideos).mockResolvedValue({ items: [video], total: 26 });
  await i18n.changeLanguage("en");
});

it("previews known public files without granting access to the catalogs", () => {
  const { container } = renderPicker(
    [],
    <>
      <ManagedImagePicker
        context="project"
        previewUrl={photo.previewUrl}
        value={photo.id}
      />
      <ManagedVideoPicker previewUrl={video.previewUrl} value={video.id} />
    </>,
  );

  expect(screen.getByAltText(i18n.t("mediaPreview"))).toHaveAttribute(
    "src",
    photo.previewUrl,
  );
  expect(container.querySelector("video")).toHaveAttribute(
    "src",
    video.previewUrl,
  );
  expect(screen.getAllByRole("combobox")).toHaveLength(2);
  expect(
    screen
      .getAllByRole("combobox")
      .every((item) => item.hasAttribute("disabled")),
  ).toBe(true);
  expect(fetchImages).not.toHaveBeenCalled();
  expect(fetchVideos).not.toHaveBeenCalled();
});

it("shows a saved direct video without a remove action or a catalog request", () => {
  const change = vi.fn();
  const savedUrl = "https://example.test/legacy.mp4";
  const { container } = renderPicker(
    ["content.write"],
    <VideoSourcePicker value={{ url: savedUrl }} onChange={change} />,
  );

  expect(
    screen.getByRole("combobox", { name: i18n.t("videos") }),
  ).toBeDisabled();
  expect(screen.queryByRole("radiogroup")).toBeNull();
  expect(container.querySelector('input[type="url"]')).toBeNull();
  expect(container.querySelector("video")).toBeNull();
  expect(screen.getByText(savedUrl)).toBeVisible();
  expect(screen.queryByRole("button", { name: i18n.t("remove") })).toBeNull();
  expect(change).not.toHaveBeenCalled();
  expect(fetchVideos).not.toHaveBeenCalled();
});

it("plays an acknowledged upload inline and clears the selection from the card", async () => {
  const label = "Project film";
  const previewLabel = `${label} · ${i18n.t("mediaPreview")}`;
  const file = new File(["synthetic video"], "film.mp4", { type: "video/mp4" });
  const thumbnail = new File(["synthetic thumbnail"], "film.webp", {
    type: "image/webp",
  });
  const thumbnailUrl = `${video.previewUrl}/thumbnail`;
  const pendingUpload = deferred<VideoRecord>();
  const onChange = vi.fn<(source: VideoSource | null) => void>();
  const onLoadingChange = vi.fn<(loading: boolean) => void>();

  vi.mocked(VideoUploadModule.captureVideoThumbnail).mockResolvedValue(
    thumbnail,
  );
  vi.mocked(uploadVideo).mockReturnValue(pendingUpload.promise);

  function ControlledVideo() {
    const [value, setValue] = useState<VideoSource | null>(null);
    return (
      <VideoSourcePicker
        label={label}
        onChange={(source) => {
          onChange(source);
          setValue(source);
        }}
        onLoadingChange={onLoadingChange}
        selectOnly
        value={value}
      />
    );
  }

  const { user } = renderPicker(["media.write"], <ControlledVideo />);
  await user.upload(
    screen.getByLabelText(label, { selector: 'input[type="file"]' }),
    file,
  );
  await waitFor(() =>
    expect(uploadVideo).toHaveBeenCalledExactlyOnceWith(
      { file, thumbnail },
      expect.any(Function),
      expect.any(AbortSignal),
    ),
  );
  expect(onLoadingChange.mock.calls).toEqual([[true]]);
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.queryByLabelText(previewLabel)).not.toBeInTheDocument();

  await act(async () => pendingUpload.resolve({ ...video, thumbnailUrl }));

  expect(onChange).toHaveBeenCalledExactlyOnceWith({ id: video.id });
  expect(onLoadingChange.mock.calls).toEqual([[true], [false]]);
  const player = screen.getByLabelText(previewLabel, { selector: "video" });
  expect(player).toBeVisible();
  expect(player).toHaveAttribute("src", video.previewUrl);
  expect(player).toHaveAttribute("poster", thumbnailUrl);
  expect(player).toHaveAttribute("controls");
  expect(player).toHaveAttribute("preload", "metadata");
  expect(player).not.toHaveAttribute("autoplay");
  const card = screen.getByRole("group", { name: "Project film" });
  expect(card).toContainElement(player);
  const replace = screen.getByRole("button", {
    name: `${i18n.t("mediaVideoReplace")} · Project film`,
  });
  expect(replace).toHaveAttribute("tabindex", "0");
  expect(replace).not.toHaveAttribute("aria-disabled", "true");
  expect(replace).not.toContainElement(player);
  expect(fetchVideos).not.toHaveBeenCalled();

  const remove = screen.getByRole("button", {
    name: `${i18n.t("remove")} · ${label}`,
  });
  expect(card).toContainElement(remove);
  replace.focus();
  await user.tab();
  expect(remove).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(onChange.mock.calls).toEqual([[{ id: video.id }], [null]]);
  expect(screen.queryByLabelText(previewLabel)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: label })).toBeEnabled();
  expect(uploadVideo).toHaveBeenCalledOnce();
});

it("keeps poster options and retries a failed scroll request in the project picker", async () => {
  const firstPage = [
    photo,
    ...Array.from({ length: 23 }, (_, index) => fixturePhoto(index + 2)),
  ];
  const lastPhoto = fixturePhoto(25);
  vi.mocked(fetchImages)
    .mockResolvedValueOnce({ items: firstPage, total: 25 })
    .mockRejectedValueOnce(new Error("Synthetic second page failure"))
    .mockResolvedValueOnce({ items: [photo, lastPhoto], total: 25 });
  const { container, user } = renderPicker(
    ["media.read"],
    <ManagedImagePicker context="project" selectOnly value={photo.id} />,
  );
  expect(container.querySelector("img")).toBeNull();
  const select = screen.getByRole("combobox", { name: i18n.t("images") });
  await user.click(select);
  const optionSelector = ".ant-select-item-option span";
  const firstOption = await screen.findByText(photo.id, {
    selector: optionSelector,
  });
  const avatar = firstOption.parentElement?.querySelector(".ant-avatar-square");
  expect(avatar).toHaveStyle({ width: "32px", height: "32px" });
  expect(avatar?.querySelector("img")).toHaveAttribute("src", photo.thumb);
  expect(screen.queryByRole("button", { name: "Page 2" })).toBeNull();

  const list = firstOption.closest<HTMLElement>(
    ".ant-select-dropdown-list-holder",
  )!;
  Object.defineProperties(list, {
    clientHeight: { value: 200 },
    scrollHeight: { value: 500 },
  });
  fireEvent.scroll(list, { target: { scrollTop: 50 } });
  expect(fetchImages).toHaveBeenCalledTimes(1);
  fireEvent.scroll(list, { target: { scrollTop: 300 } });

  const retry = await screen.findByRole("button", { name: i18n.t("retry") });
  expect(list.querySelector(".ant-select-item-option")).toBeInTheDocument();
  expect(fetchImages).toHaveBeenLastCalledWith(
    { context: "project", page: 2 },
    expect.any(AbortSignal),
  );
  await user.click(retry);
  if (select.getAttribute("aria-expanded") === "false")
    await user.click(select);
  await waitFor(() =>
    expect(
      screen.getByRole("listbox").querySelector('[role="option"]'),
    ).toHaveAttribute("aria-setsize", "25"),
  );
  expect(fetchImages).toHaveBeenCalledTimes(3);
});

it("shows text choices and saves one video ID without preview or paging controls", async () => {
  const nextVideo = {
    ...video,
    id: "22222222-2222-4222-8222-222222222223",
  };
  vi.mocked(fetchVideos).mockResolvedValue({ items: [nextVideo], total: 25 });
  const change = vi.fn();
  const { container, user } = renderPicker(
    ["media.read"],
    <VideoSourcePicker onChange={change} selectOnly value={{ id: video.id }} />,
  );
  expect(container.querySelector("video")).toBeNull();
  await user.click(screen.getByRole("combobox", { name: i18n.t("videos") }));
  const choice = await screen.findByText(nextVideo.id + " · 4 KiB", {
    selector: ".ant-select-item-option-content",
  });
  expect(choice.querySelector("img")).toBeNull();
  expect(screen.queryByRole("button", { name: "Page 2" })).toBeNull();
  await user.click(choice);
  expect(change).toHaveBeenCalledExactlyOnceWith({ id: nextVideo.id });
});

it("keeps ordered image selections across catalog pages and caps them at three", async () => {
  const secondPhoto = fixturePhoto(2);
  const thirdPhoto = fixturePhoto(3);
  const fourthPhoto = fixturePhoto(4);
  vi.mocked(fetchImages)
    .mockResolvedValueOnce({ items: [photo, secondPhoto], total: 26 })
    .mockResolvedValueOnce({ items: [thirdPhoto, fourthPhoto], total: 26 });
  const change = vi.fn();
  const Picker = () => {
    const [ids, setIds] = useState<string[]>([]);
    return (
      <ManagedImagePicker
        context="service"
        maxCount={3}
        multiple
        onChange={(selected) => {
          change(selected);
          setIds(selected);
        }}
        value={ids}
      />
    );
  };
  const { user } = renderPicker(["media.read"], <Picker />);
  const select = screen.getByRole("combobox", { name: i18n.t("images") });
  const option = (image: ImageRecord) =>
    screen.findByText(image.id, { selector: ".ant-select-item-option span" });
  expect(fetchImages).not.toHaveBeenCalled();

  await user.click(select);
  const secondOption = await option(secondPhoto);
  const avatar =
    secondOption.parentElement?.querySelector(".ant-avatar-square");
  expect(avatar).toHaveStyle({ width: "32px", height: "32px" });
  expect(avatar?.querySelector("img")).toHaveAttribute(
    "src",
    secondPhoto.previewUrl,
  );
  await user.click(secondOption);
  await user.click(await option(photo));
  await user.click(screen.getByRole("button", { name: "Page 2" }));
  await waitFor(() =>
    expect(fetchImages).toHaveBeenNthCalledWith(
      2,
      { context: "service", page: 2 },
      expect.any(AbortSignal),
    ),
  );
  await user.click(select);
  await user.click(await option(thirdPhoto));
  const selectedIds = [secondPhoto.id, photo.id, thirdPhoto.id];
  expect(change).toHaveBeenLastCalledWith(selectedIds);
  expect(screen.queryByAltText(i18n.t("mediaPreview"))).toBeNull();
  expect(screen.queryByRole("button", { name: "Move up" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Move down" })).toBeNull();

  await user.click(await option(fourthPhoto));
  expect(change).toHaveBeenCalledTimes(3);
  expect(fetchImages).toHaveBeenCalledTimes(2);
  expect(fetchVideos).not.toHaveBeenCalled();
});

it("removes saved images from the select without opening the catalog", async () => {
  const secondPhoto = fixturePhoto(2);
  const change = vi.fn();
  const Picker = () => {
    const [ids, setIds] = useState([photo.id, secondPhoto.id]);
    return (
      <ManagedImagePicker
        context="service"
        maxCount={3}
        multiple
        onChange={(selected) => {
          change(selected);
          setIds(selected);
        }}
        value={ids}
      />
    );
  };
  const { user } = renderPicker([], <Picker />);
  const select = screen.getByRole("combobox", { name: i18n.t("images") });
  await user.click(select);
  expect(select).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByAltText(i18n.t("mediaPreview"))).toBeNull();
  await user.keyboard("{Backspace}");
  expect(change).toHaveBeenLastCalledWith([photo.id]);
  await user.keyboard("{Backspace}");
  expect(change).toHaveBeenLastCalledWith([]);
  expect(select).toBeDisabled();
  expect(fetchImages).not.toHaveBeenCalled();
});

it("disables the image select while the picker is busy", async () => {
  const secondPhoto = fixturePhoto(2);
  const change = vi.fn();
  const { user } = renderPicker(
    ["media.read"],
    <ManagedImagePicker
      context="service"
      disabled
      maxCount={3}
      multiple
      onChange={change}
      value={[photo.id, secondPhoto.id]}
    />,
  );

  const select = screen.getByRole("combobox", { name: i18n.t("images") });
  expect(select).toBeDisabled();
  await user.click(select);
  expect(fetchImages).not.toHaveBeenCalled();
  expect(change).not.toHaveBeenCalled();
});
