import { CoreContext, type CoreContextValue } from "@/app/contexts";
import { waitFor } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";

import type { UploadProgressHandler } from "@/shared/api";
import { i18n } from "@/shared/i18n";
import { render, screen } from "@/test/render";

import { fetchImages, uploadImage } from "../api";
import type { ImageRecord } from "../types";
import { ManagedImageField } from "./ManagedImageField";

type CropperPort = {
  disabled?: boolean;
  fallbackUrl?: string;
  label: string;
  onChange: (uploaded: { id: string; url: string }) => void;
  onLoadingChange: (loading: boolean) => void;
  onRemove?: () => void;
  settings: { height: number; width: number };
  upload: (
    file: File,
    progress: UploadProgressHandler,
    signal: AbortSignal,
  ) => Promise<{ id: string; url: string }>;
  value?: { url: string };
};

vi.mock("../api", () => ({
  fetchImages: vi.fn(),
  fetchVideos: vi.fn(),
  uploadImage: vi.fn(),
}));

vi.mock("@/shared/ui/image-upload", () => ({
  ImageUpload: ({
    disabled,
    fallbackUrl,
    label,
    onChange,
    onLoadingChange,
    onRemove,
    settings,
    upload,
    value,
  }: CropperPort) => (
    <>
      <button
        disabled={disabled}
        onClick={() => {
          onLoadingChange(true);
          const cropped = new File(["cropped"], "cropped.webp", {
            type: "image/webp",
          });
          void upload(cropped, () => undefined, new AbortController().signal)
            .then(onChange)
            .finally(() => onLoadingChange(false));
        }}
        type="button"
      >
        {(value?.url ?? fallbackUrl) && (
          <img alt="" src={value?.url ?? fallbackUrl} />
        )}
        {label} {settings.width} × {settings.height}
      </button>
      {onRemove && (
        <button disabled={disabled} onClick={onRemove} type="button">
          Remove {label}
        </button>
      )}
    </>
  ),
}));

const profile = { height: 180, size: 4096, width: 320 };
const record: ImageRecord = {
  id: "selected-image",
  context: "service",
  width: profile.width,
  height: profile.height,
  sizeBytes: 800,
  contentType: "image/webp",
  previewUrl: "/test-delivery/selected",
  thumb: "/test-delivery/small-selected",
};

const selected = { id: record.id, url: record.previewUrl, thumb: record.thumb };
const first = {
  id: "first-image",
  url: "/test-delivery/first",
  thumb: "/test-delivery/small-first",
};
const second = {
  id: "second-image",
  url: "/test-delivery/second",
  thumb: "/test-delivery/small-second",
};
const other = {
  id: "other-image",
  url: "/test-delivery/other",
  thumb: "/test-delivery/small-other",
};
const added = {
  ...record,
  id: "added-image",
  previewUrl: "/test-delivery/added",
  thumb: "/test-delivery/small-added",
};

const renderWithPermissions = (permissions: string[], page: ReactNode) =>
  render(
    <CoreContext.Provider
      value={
        {
          settings: {
            uploadProfiles: {
              content: { width: 1600, height: 900, size: 5 * 1024 * 1024 },
              article: profile,
              logo: profile,
              project: profile,
              service: profile,
              thumbnail: profile,
              video: profile,
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
            <Route index element={page} />
          </Route>
        </Routes>
      </MemoryRouter>
    </CoreContext.Provider>,
  );

beforeEach(async () => {
  vi.resetAllMocks();

  vi.mocked(fetchImages).mockResolvedValue({ items: [record], total: 1 });
  await i18n.changeLanguage("en");
});

it("uploads directly into the matching profile, preserves slot order and enforces the count", async () => {
  const changes = vi.fn();
  function ServiceImages() {
    const [ids, setIds] = useState(["first-image", "second-image"]);
    return (
      <ManagedImageField
        context="service"
        imageReferences={[first, second]}
        label="Service image"
        maxCount={3}
        multiple
        onChange={setIds}
        onLoadingChange={changes}
        value={ids}
      />
    );
  }

  vi.mocked(uploadImage)
    .mockResolvedValueOnce(record)
    .mockResolvedValueOnce(added);
  const { container, user } = renderWithPermissions(
    ["media.write"],
    <ServiceImages />,
  );

  await user.click(
    await screen.findByRole("button", { name: "Service image 1 320 × 180" }),
  );
  await waitFor(() =>
    expect(container.querySelector("img")).toHaveAttribute("src", record.thumb),
  );
  await user.click(
    screen.getByRole("button", { name: "Service image 3 320 × 180" }),
  );
  await waitFor(() =>
    expect(container.querySelectorAll("img")).toHaveLength(3),
  );
  expect(
    [...container.querySelectorAll("img")].map((image) =>
      image.getAttribute("src"),
    ),
  ).toEqual([record.thumb, second.thumb, added.thumb]);
  const uploadSlots = screen
    .getAllByRole("button", { name: /^Service image \d+ 320 × 180$/ })
    .map((button) => button.parentElement);
  const stack = uploadSlots[0]?.parentElement;
  expect(stack).toHaveStyle({ flexDirection: "column" });
  for (const slot of uploadSlots) {
    expect(slot?.parentElement).toBe(stack);
    expect(slot).toHaveStyle({ width: "100%" });
  }
  expect(
    screen.queryByRole("button", { name: "Service image 4 320 × 180" }),
  ).toBeNull();
  expect(fetchImages).not.toHaveBeenCalled();
  expect(uploadImage).toHaveBeenCalledTimes(2);
  expect(vi.mocked(uploadImage).mock.calls[0][0]).toEqual({
    context: "service",
    file: expect.objectContaining({ name: "cropped.webp", type: "image/webp" }),
  });
  expect(changes.mock.calls).toEqual([[true], [false], [true], [false]]);
});

it("lets a read-only media role reuse existing images without requesting upload profiles", async () => {
  const { user } = renderWithPermissions(
    ["media.read"],
    <ManagedImageField
      context="service"
      imageReferences={[selected]}
      label="Service image"
      multiple
      value={[record.id]}
    />,
  );
  const preview = screen.getByRole("img", { name: "Service image 1" });
  expect(preview).toHaveAttribute("src", record.thumb);
  expect(preview).toHaveAttribute("width", "80");
  expect(preview).toHaveAttribute("height", "80");
  await user.click(screen.getByRole("combobox"));
  await waitFor(() => expect(fetchImages).toHaveBeenCalledOnce());
  expect(uploadImage).not.toHaveBeenCalled();
});

it("removes just the selected service image slot when IDs repeat", async () => {
  const onChange = vi.fn<(ids: string[]) => void>();
  function ServiceImages() {
    const [ids, setIds] = useState([record.id, "other-image", record.id]);
    return (
      <ManagedImageField
        context="service"
        imageReferences={[selected, other]}
        label="Service image"
        maxCount={3}
        multiple
        onChange={(next) => {
          onChange(next);
          setIds(next);
        }}
        value={ids}
      />
    );
  }

  const { container, user } = renderWithPermissions(
    ["media.write"],
    <ServiceImages />,
  );
  await user.click(
    await screen.findByRole("button", { name: "Remove Service image 1" }),
  );
  expect(onChange).toHaveBeenCalledExactlyOnceWith(["other-image", record.id]);
  expect(
    [...container.querySelectorAll("img")].map((image) =>
      image.getAttribute("src"),
    ),
  ).toEqual([other.thumb, record.thumb]);
  expect(
    screen.getByRole("button", { name: "Service image 3 320 × 180" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Remove Service image 3" }),
  ).toBeNull();
  expect(uploadImage).not.toHaveBeenCalled();
});

it("clears a custom logo and keeps the built-in fallback available", async () => {
  const onChange = vi.fn<(id: string | null) => void>();
  function Logo() {
    const [id, setId] = useState<string | null>(record.id);
    return (
      <ManagedImageField
        context="logo"
        fallbackUrl="/logo.svg"
        imageReferences={[selected]}
        label="Logo"
        onChange={(next) => {
          onChange(next);
          setId(next);
        }}
        value={id}
      />
    );
  }

  const { container, user } = renderWithPermissions(["media.write"], <Logo />);
  const remove = await screen.findByRole("button", { name: "Remove Logo" });
  expect(container.querySelector("img")).toHaveAttribute(
    "src",
    record.previewUrl,
  );
  await user.click(remove);
  expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
  expect(container.querySelector("img")).toHaveAttribute("src", "/logo.svg");
  expect(screen.queryByRole("button", { name: "Remove Logo" })).toBeNull();
  expect(uploadImage).not.toHaveBeenCalled();
});
