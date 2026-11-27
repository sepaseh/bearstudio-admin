// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { VideoSource } from "@/features/files";
import { AdminApiError } from "@/shared/api";
import { i18n } from "@/shared/i18n";

import { fetchHome, saveHome } from "./api";
import { HomePage } from "./Home";
import type { HomeInput, HomeRecord } from "./types";

const messages = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("@/app/hooks", () => ({ useAntd: () => ({ messageAPI: messages }) }));
vi.mock("./api", () => ({
  fetchHome: vi.fn(),
  saveHome: vi.fn(),
}));
vi.mock("@/features/files", () => ({
  ManagedImagePicker: ({
    context,
    disabled,
    id,
    onChange,
    value,
  }: {
    context: string;
    disabled?: boolean;
    id?: string;
    onChange?: (id: string | null) => void;
    value?: string;
  }) => (
    <input
      data-context={context}
      disabled={disabled}
      id={id}
      onChange={({ target }) => onChange?.(target.value || null)}
      value={value ?? ""}
    />
  ),
  VideoSourcePicker: ({
    disabled,
    id,
    onChange,
    value,
  }: {
    disabled?: boolean;
    id?: string;
    onChange?: (source: VideoSource | null) => void;
    value?: VideoSource;
  }) => (
    <input
      disabled={disabled}
      id={id}
      onChange={({ target }) =>
        onChange?.(target.value ? { id: target.value } : null)
      }
      value={value?.id ?? ""}
    />
  ),
}));

const imageRecord = (imageId: string, alt: string) => ({
  imageId,
  alt,
  url: `/api/v1/public/images/${imageId}`,
  thumb: `/api/v1/public/images/${imageId}/thumbnail`,
});
const videoRecord = (source: VideoSource) =>
  typeof source.id === "string"
    ? { id: source.id, url: `/api/v1/public/videos/${source.id}` }
    : { id: null, url: source.url };
const image = imageRecord(
  "a1000000-0000-4000-8000-000000000001",
  "Synthetic image alt",
);
const approachImageId = "a1000000-0000-4000-8000-000000000002";
const contentImageId = "a1000000-0000-4000-8000-000000000003";
const projectImageId = "a1000000-0000-4000-8000-000000000004";
const videoId = "b1000000-0000-4000-8000-000000000001";
const heroUrl = "https://example.test/hero.mp4";

const home: HomeRecord = {
  key: "home",
  content: {
    heroDescription: "Current hero",
    heroVideo: { id: null, url: heroUrl },
    heroPoster: image,
    aboutTitle: "Current About",
    aboutSubtitle: "",
    aboutDescription: "Current About description.",
    aboutVideo: videoRecord({ id: videoId }),
    aboutPoster: image,
    approach: [
      { title: "First approach", image },
      { title: "Second approach", image },
      { title: "Third approach", image },
      { title: "Fourth approach", image },
    ],
    whyTitle: "Current Why",
    whySubtitle: "",
    whyDescription: "Current Why description.",
    whyImage: image,
  },
};

const renderPage = (permissions = ["content.read", "content.write"]) =>
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={{ currentUser: { permissions } }} />}>
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const approachFields = () =>
  within(screen.getByRole("group", { name: i18n.t("approach") }));

const change = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(saveHome).mockImplementation(async (content) => ({
    key: "home",
    content: {
      ...content,
      heroPoster: imageRecord(
        content.heroPoster.imageId,
        content.heroDescription.trim(),
      ),
      heroVideo: videoRecord(content.heroVideo),
      aboutPoster: content.aboutPoster
        ? imageRecord(content.aboutPoster.imageId, content.aboutPoster.alt)
        : null,
      aboutVideo: content.aboutVideo ? videoRecord(content.aboutVideo) : null,
      approach: content.approach.map(({ title, image }) => ({
        title,
        image: imageRecord(image.imageId, title.trim()),
      })),
      whyImage: imageRecord(content.whyImage.imageId, content.whyTitle.trim()),
    },
  }));
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

it("offers a generic retry when the initial Home read fails", async () => {
  vi.mocked(fetchHome)
    .mockRejectedValueOnce(new Error("Synthetic upstream failure"))
    .mockResolvedValueOnce(home);

  renderPage();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    i18n.t("unexpectedError"),
  );
  expect(
    screen.queryByText("Synthetic upstream failure"),
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: i18n.t("retry") }));
  expect(
    await screen.findByDisplayValue(home.content.heroDescription),
  ).toBeVisible();
});

it("creates Home with four editable Approach slots and no About media", async () => {
  vi.mocked(fetchHome).mockRejectedValue(
    new AdminApiError("Missing", 404, { code: "NOT_FOUND" }),
  );
  renderPage();

  const submit = await screen.findByRole("button", { name: i18n.t("submit") });
  expect(submit).toBeEnabled();
  expect(screen.getAllByLabelText(i18n.t("description"))[0]).toHaveValue("");

  const approach = approachFields();
  const titles = approach.getAllByRole("textbox", { name: i18n.t("title") });
  expect(titles).toHaveLength(4);
  expect(approach.getAllByRole("separator")).toHaveLength(3);
  for (const field of titles) {
    expect(field).toBeEnabled();
    expect(field).toHaveValue("");
  }
  expect(approach.queryByRole("button")).toBeNull();
  expect(
    screen.queryByRole("textbox", { name: "Image alt text" }),
  ).not.toBeInTheDocument();
  const approachImages = approach.getAllByLabelText(i18n.t("images"));
  for (const field of approachImages)
    expect(field).toHaveAttribute("data-context", "approach");
  const poster = screen.getByLabelText(i18n.t("poster"));
  const images = screen.getAllByLabelText(i18n.t("images"));
  const whyImage = images[images.length - 1];
  expect(poster).toHaveAttribute("data-context", "content");
  expect(whyImage).toHaveAttribute("data-context", "project");
  expect(screen.queryByRole("switch")).toBeNull();

  for (const field of screen.getAllByRole("textbox", {
    name: i18n.t("description"),
  }))
    change(field, "Synthetic description");
  for (const field of screen.getAllByRole("textbox", { name: i18n.t("title") }))
    change(field, "Synthetic title");
  for (const field of approachImages) change(field, approachImageId);
  change(poster, contentImageId);
  change(screen.getByLabelText(i18n.t("video")), videoId);
  fireEvent.click(submit);
  expect(await screen.findByText(i18n.t("requiredField"))).toBeInTheDocument();
  expect(saveHome).not.toHaveBeenCalled();

  change(whyImage, projectImageId);
  fireEvent.click(submit);

  await waitFor(() =>
    expect(saveHome).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        aboutPoster: null,
        aboutVideo: null,
        approach: Array.from({ length: 4 }, () => ({
          title: "Synthetic title",
          image: { imageId: approachImageId },
        })),
        heroDescription: "Synthetic description",
        heroPoster: { imageId: contentImageId },
        whyImage: { imageId: projectImageId },
      }),
      expect.any(AbortSignal),
    ),
  );
});

it("pads a shorter Approach, keeps edits in slot order, and preserves saved About media", async () => {
  vi.mocked(fetchHome).mockResolvedValue({
    ...home,
    content: { ...home.content, approach: home.content.approach.slice(0, 2) },
  });
  const heroDescription = "A longer introduction for the home page. "
    .repeat(8)
    .trim();
  const input: HomeInput = {
    ...home.content,
    approach: [
      "Updated first approach",
      "Second approach",
      "New third approach",
      "New fourth approach",
    ].map((title, index) => ({
      title,
      image: {
        imageId: index < 2 ? image.imageId : approachImageId,
      },
    })),
    heroDescription,
    heroPoster: { imageId: image.imageId },
    heroVideo: { url: heroUrl },
    aboutVideo: { id: videoId },
    aboutPoster: { imageId: image.imageId, alt: image.alt },
    whyTitle: "Updated Why",
    whyImage: { imageId: image.imageId },
  };
  renderPage();
  expect(await screen.findByDisplayValue("First approach")).toBeVisible();
  expect(screen.queryByRole("switch")).toBeNull();
  expect(screen.queryByDisplayValue(videoId)).toBeNull();
  expect(screen.getAllByLabelText(i18n.t("poster"))).toHaveLength(1);
  expect(screen.getAllByLabelText(i18n.t("video"))).toHaveLength(1);
  change(
    screen.getByDisplayValue(home.content.heroDescription),
    heroDescription,
  );
  change(screen.getByDisplayValue(home.content.whyTitle), input.whyTitle);

  const approach = approachFields();
  const titles = approach.getAllByRole("textbox", { name: i18n.t("title") });
  expect(titles).toHaveLength(4);
  expect(titles[1]).toHaveValue("Second approach");
  expect(titles[2]).toHaveValue("");
  expect(titles[3]).toHaveValue("");
  expect(approach.queryByRole("button")).toBeNull();

  change(titles[0], "Updated first approach");
  change(titles[2], "New third approach");
  change(titles[3], "New fourth approach");
  const images = approach.getAllByLabelText(i18n.t("images"));
  change(images[2], approachImageId);
  change(images[3], approachImageId);
  fireEvent.click(screen.getByRole("button", { name: i18n.t("submit") }));

  await waitFor(() =>
    expect(saveHome).toHaveBeenCalledExactlyOnceWith(
      input,
      expect.any(AbortSignal),
    ),
  );
});

it("shows four read-only slots and declines to overwrite a longer saved Approach", async () => {
  vi.mocked(fetchHome).mockResolvedValue({
    ...home,
    content: {
      ...home.content,
      approach: [...home.content.approach, { title: "Fifth approach", image }],
    },
  });
  renderPage();

  expect(
    await screen.findByText(i18n.t("homeApproachCountConflict")),
  ).toBeVisible();
  const titles = approachFields().getAllByRole("textbox", {
    name: i18n.t("title"),
  });
  expect(titles).toHaveLength(4);
  for (const title of titles) expect(title).toBeDisabled();
  expect(screen.getByRole("button", { name: i18n.t("submit") })).toBeDisabled();
  expect(saveHome).not.toHaveBeenCalled();
});

it("keeps Home read-only for a content reader", async () => {
  vi.mocked(fetchHome).mockResolvedValue(home);
  renderPage(["content.read"]);
  expect(
    await screen.findByDisplayValue(home.content.heroDescription),
  ).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: i18n.t("submit") }),
  ).not.toBeInTheDocument();
  expect(saveHome).not.toHaveBeenCalled();
});
