import { fireEvent, waitFor } from "@testing-library/react";
import type { AriaAttributes } from "react";
import { MemoryRouter, Outlet, Route, Routes, useLocation } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";

import { routeTree } from "@/app/config";
import type * as Files from "@/features/files";
import type { VideoRecord } from "@/features/files";
import { fetchVideos } from "@/features/files/api";
import { fetchServices } from "@/features/services";
import { i18n } from "@/shared/i18n";
import { render, screen } from "@/test/render";

import {
  createProject,
  fetchProject,
  fetchProjects,
  updateProject,
} from "../../api";
import { ProjectsPage } from "../../Projects";
import type { ProjectRecord } from "../../types";
import { ProjectForm } from "./ProjectForm";

const { messages, onClose, onFinish, posterImageId } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
  onClose: vi.fn(),
  onFinish: vi.fn(),
  posterImageId: "22222222-2222-4222-8222-222222222222",
}));
vi.mock("../../api", () => ({
  createProject: vi.fn(),
  fetchProject: vi.fn(),
  fetchProjects: vi.fn(),
  updateProject: vi.fn(),
}));
vi.mock("@/features/services", () => ({ fetchServices: vi.fn() }));
vi.mock("@/app/hooks", () => ({ useAntd: () => ({ messageAPI: messages }) }));
vi.mock("@/features/files/api", () => ({ fetchVideos: vi.fn() }));
vi.mock("@/features/files", async (load) => ({
  ...(await load<typeof Files>()),
  ManagedImagePicker: ({
    "aria-invalid": invalid,
    onChange,
  }: Pick<AriaAttributes, "aria-invalid"> & {
    onChange?: (id: string) => void;
  }) => (
    <button
      aria-invalid={invalid}
      onClick={() => onChange?.(posterImageId)}
      type="button"
    >
      Choose synthetic poster
    </button>
  ),
}));

const videoId = "33333333-3333-4333-8333-333333333333";
const previewId = "44444444-4444-4444-8444-444444444444";
const videoOption = (id: string): VideoRecord => ({
  contentType: "video/mp4",
  id,
  previewUrl: "/api/v1/public/videos/" + id,
  sizeBytes: 4096,
  thumbnailUrl: null,
});
const savedPreviewUrl = "https://example.test/preview.mp4";
const serviceCatalog = {
  items: [
    {
      slug: "animation",
      title: "Animation",
      description: "",
      tags: [],
      images: [],
    },
  ],
};
const record: ProjectRecord = {
  poster: {
    id: posterImageId,
    url: `/api/v1/public/images/${posterImageId}`,
    thumb: "/api/v1/public/images/" + posterImageId + "/thumbnail",
  },
  service: { name: "Animated films", slug: "animation" },
  isFeatured: true,
  title: "Synthetic project",
  slug: "synthetic-project",
  description: "Description",
  video: { id: videoId, url: videoOption(videoId).previewUrl },
  preview: { id: null, url: savedPreviewUrl },
  watch: { label: "Official watch page", url: "https://example.test/watch" },
};
const renderForm = (
  mode = "create",
  permissions = ["content.read", "content.write"],
) =>
  render(
    <MemoryRouter
      initialEntries={[
        mode === "edit" ? "/projects/" + record.slug : "/projects#create",
      ]}
    >
      <Routes>
        <Route element={<Outlet context={{ currentUser: { permissions } }} />}>
          <Route
            path="/projects/:slug?"
            element={
              <ProjectForm
                slug={mode === "edit" ? record.slug : undefined}
                onClose={onClose}
                onFinish={onFinish}
              />
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const enter = (label: string, value: string) =>
  fireEvent.change(screen.getByRole("textbox", { name: label }), {
    target: { value },
  });
const submit = () => screen.getByRole("button", { name: i18n.t("submit") });
const chooseService = async (user: ReturnType<typeof render>["user"]) => {
  await user.click(
    screen.getByRole("combobox", { name: i18n.t("projectService") }),
  );
  await user.click(await screen.findByText("Animation", { exact: true }));
};
const chooseVideo = async (
  user: ReturnType<typeof render>["user"],
  label: string,
  id: string,
) => {
  await user.click(screen.getByRole("combobox", { name: label }));
  const option = await screen.findByText(`${id} · 4 KiB`, {
    selector: ".ant-select-item-option-content",
  });
  // jsdom does not complete the popup's pointer-blocking transition.
  fireEvent.click(option);
};

const ProjectLocation = () => {
  const { pathname, search } = useLocation();
  return <output aria-label="project location">{pathname + search}</output>;
};

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(fetchProject).mockResolvedValue(record);
  vi.mocked(createProject).mockResolvedValue(record);
  vi.mocked(updateProject).mockResolvedValue(record);
  vi.mocked(fetchServices).mockResolvedValue(serviceCatalog);
  await i18n.changeLanguage("en");
});

it("creates with all required project fields and Featured unchecked", async () => {
  vi.mocked(fetchVideos)
    .mockResolvedValueOnce({ items: [videoOption(previewId)], total: 1 })
    .mockResolvedValueOnce({ items: [videoOption(videoId)], total: 1 });
  const { user } = renderForm("create", [
    "content.read",
    "content.write",
    "media.read",
  ]);
  await waitFor(() => expect(submit()).toBeEnabled());
  expect(
    screen.queryByRole("textbox", { name: "Image alt text" }),
  ).not.toBeInTheDocument();
  const watchLabel = screen.getByLabelText(i18n.t("watchLabel"));
  const watchLink = screen.getByLabelText(i18n.t("watchUrl"));
  const description = screen.getByLabelText(i18n.t("description"));
  const featured = screen.getByLabelText(i18n.t("featuredProject"));
  expect(watchLabel.compareDocumentPosition(watchLink)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
  expect(watchLink.compareDocumentPosition(description)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
  expect(description.compareDocumentPosition(featured)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
  enter(i18n.t("title"), "  Synthetic  ");
  enter(i18n.t("slug"), "  SYNTHETIC-CLIP  ");
  await chooseService(user);
  await user.click(
    screen.getByRole("button", { name: "Choose synthetic poster" }),
  );
  enter(i18n.t("watchUrl"), "https://example.test/watch");
  enter(i18n.t("watchLabel"), "Official Watch");
  enter(i18n.t("description"), "  Project description  ");
  await chooseVideo(user, i18n.t("mediaPreview"), previewId);
  await user.click(submit());
  await waitFor(() =>
    expect(
      screen.getByRole("combobox", { name: i18n.t("video") }),
    ).toHaveAttribute("aria-invalid", "true"),
  );
  expect(createProject).not.toHaveBeenCalled();

  await chooseVideo(user, i18n.t("video"), videoId);
  await user.click(submit());

  await waitFor(() =>
    expect(createProject).toHaveBeenCalledExactlyOnceWith(
      {
        title: "Synthetic",
        slug: "synthetic-clip",
        serviceSlug: "animation",
        isFeatured: false,
        description: "Project description",
        poster: { id: posterImageId },
        video: { id: videoId },
        preview: { id: previewId },
        watch: { label: "Official Watch", url: "https://example.test/watch" },
      },
      expect.any(AbortSignal),
    ),
  );
  expect(onFinish).toHaveBeenCalledOnce();
});

it("requires every editable project field except Featured", async () => {
  const { user } = renderForm("create", [
    "content.read",
    "content.write",
    "media.read",
  ]);
  await screen.findByRole("textbox", { name: i18n.t("title") });
  expect(screen.queryByRole("radio")).toBeNull();
  for (const name of ["poster", "video", "mediaPreview"] as const)
    expect(screen.queryByRole("textbox", { name: i18n.t(name) })).toBeNull();

  await waitFor(() => expect(submit()).toBeEnabled());
  await user.click(submit());

  await waitFor(() => {
    for (const name of [
      "title",
      "slug",
      "watchLabel",
      "watchUrl",
      "description",
    ] as const)
      expect(
        screen.getByRole("textbox", { name: i18n.t(name) }),
      ).toHaveAttribute("aria-invalid", "true");
    for (const name of ["projectService", "video", "mediaPreview"] as const)
      expect(
        screen.getByRole("combobox", { name: i18n.t(name) }),
      ).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByRole("button", { name: "Choose synthetic poster" }),
    ).toHaveAttribute("aria-invalid", "true");
  });
  expect(
    screen.getByRole("checkbox", { name: i18n.t("featuredProject") }),
  ).not.toHaveAttribute("aria-required", "true");
  expect(createProject).not.toHaveBeenCalled();
  expect(onFinish).not.toHaveBeenCalled();
});

it("blocks clearing the saved Watch fields and preserves saved media", async () => {
  const { user } = renderForm("edit");
  const title = await screen.findByDisplayValue(record.title);
  await waitFor(() => expect(title).toHaveFocus());
  expect(screen.queryByRole("button", { name: i18n.t("remove") })).toBeNull();
  expect(screen.getByText(savedPreviewUrl)).toBeVisible();
  enter(i18n.t("watchUrl"), "");
  enter(i18n.t("watchLabel"), "");
  await user.click(submit());

  await waitFor(() => {
    expect(screen.getByLabelText(i18n.t("watchLabel"))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText(i18n.t("watchUrl"))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
  expect(updateProject).not.toHaveBeenCalled();
  expect(onFinish).not.toHaveBeenCalled();
  expect(screen.getByText(savedPreviewUrl)).toBeVisible();
});

it("replaces a previously saved poster URL with a managed image", async () => {
  const legacyUrl = "https://example.test/poster.webp?size=large";
  vi.mocked(fetchProject).mockResolvedValue({
    ...record,
    poster: { id: null, url: legacyUrl, thumb: null },
  });
  const { user } = renderForm("edit", [
    "content.read",
    "content.write",
    "media.read",
  ]);
  await screen.findByDisplayValue(record.title);
  expect(screen.getByText(legacyUrl)).toBeVisible();
  expect(screen.queryByRole("textbox", { name: i18n.t("poster") })).toBeNull();
  await user.click(
    screen.getByRole("button", { name: "Choose synthetic poster" }),
  );
  await user.click(submit());
  await waitFor(() =>
    expect(updateProject).toHaveBeenCalledExactlyOnceWith(
      record.slug,
      { poster: { id: posterImageId } },
      expect.any(AbortSignal),
    ),
  );
});

it("opens project rows at the stored slug and returns to the complete list after a rename", async () => {
  const slug = "renamed-project";
  const changed = { ...record, slug, isFeatured: false };
  vi.mocked(fetchProjects)
    .mockResolvedValueOnce([record])
    .mockResolvedValueOnce([changed]);
  vi.mocked(updateProject).mockResolvedValueOnce(changed);
  const { user } = render(
    <MemoryRouter initialEntries={["/projects?service=animation&title=Film"]}>
      <Routes>
        <Route
          element={
            <Outlet
              context={{
                currentUser: { permissions: ["content.read", "content.write"] },
              }}
            />
          }
        >
          <Route
            path={routeTree.projects.routePattern}
            element={
              <>
                <ProjectsPage />
                <ProjectLocation />
              </>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  const update = await screen.findByRole("button", { name: i18n.t("update") });
  const posterHeader = screen.getByRole("columnheader", {
    name: i18n.t("poster"),
  });
  const rowHeader = screen.getByRole("columnheader", { name: i18n.t("row") });
  expect(posterHeader.nextElementSibling).toBe(rowHeader);
  expect(rowHeader.nextElementSibling).toBe(
    screen.getByRole("columnheader", { name: i18n.t("title") }),
  );
  const rowCell = screen.getByRole("cell", {
    name: record.title,
  }).previousElementSibling;
  expect(rowCell).toHaveTextContent(/^1$/);
  const posterCell = rowCell?.previousElementSibling;
  expect(posterCell?.querySelector(".ant-avatar-square")).toHaveStyle({
    width: "32px",
    height: "32px",
  });
  expect(posterCell?.querySelector("img")).toHaveAttribute(
    "src",
    record.poster.thumb,
  );
  const thumbnail = screen.getByRole("img", {
    name: i18n.t("poster") + " · " + record.title,
  });
  await user.hover(thumbnail);
  const preview = await screen.findByRole("tooltip");
  expect(preview).toHaveTextContent(/^$/);
  expect(preview.querySelector(".ant-avatar-square")).toHaveStyle({
    width: "200px",
    height: "200px",
  });
  expect(preview.querySelector("img")).toHaveAttribute(
    "src",
    record.poster.url,
  );
  await user.unhover(thumbnail);
  expect(screen.getByRole("cell", { name: "Animated films" })).toHaveStyle({
    textAlign: "center",
  });
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(fetchServices).not.toHaveBeenCalled();
  await waitFor(() => expect(update).toBeEnabled());
  expect(fetchProjects).toHaveBeenCalledExactlyOnceWith(
    expect.any(AbortSignal),
  );
  await user.click(update);
  await screen.findByDisplayValue(record.title);
  expect(screen.getByLabelText("project location")).toHaveTextContent(
    /^\/projects\/synthetic-project$/,
  );
  expect(fetchServices).toHaveBeenCalledExactlyOnceWith(
    expect.any(AbortSignal),
  );
  expect(fetchProject).toHaveBeenCalledExactlyOnceWith(
    record.slug,
    expect.any(AbortSignal),
  );

  enter(i18n.t("slug"), "  RENAMED-PROJECT  ");
  const featured = screen.getByRole("checkbox", {
    name: i18n.t("featuredProject"),
  });
  expect(featured).toBeChecked();
  await user.click(featured);
  await user.click(submit());

  await waitFor(() =>
    expect(updateProject).toHaveBeenCalledExactlyOnceWith(
      record.slug,
      { slug, isFeatured: false },
      expect.any(AbortSignal),
    ),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("project location")).toHaveTextContent(
      /^\/projects$/,
    ),
  );
  expect(fetchProjects).toHaveBeenCalledTimes(2);
});

it("retries service options inside the editor after a failed request", async () => {
  vi.mocked(fetchServices).mockRejectedValueOnce(
    new Error("Synthetic service catalog unavailable"),
  );
  const { user } = renderForm();
  const retry = await screen.findByRole("button", { name: i18n.t("retry") });
  expect(submit()).toBeDisabled();
  enter(i18n.t("title"), "Draft project");
  await user.click(retry);
  await waitFor(() => expect(submit()).toBeEnabled());
  expect(screen.getByRole("textbox", { name: i18n.t("title") })).toHaveValue(
    "Draft project",
  );
  await chooseService(user);
  expect(fetchServices).toHaveBeenCalledTimes(2);
});
