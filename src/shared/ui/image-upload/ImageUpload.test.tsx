// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigProvider, Upload, type UploadProps } from "antd";
import type ImgCrop from "antd-img-crop";
import {
  cloneElement,
  type ComponentProps,
  type ReactElement,
  useState,
} from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";

import { readImageSize } from "./image";
import { ImageUpload } from "./ImageUpload";

const cropOutput = vi.hoisted(() => ({
  contents: undefined as string | undefined,
}));

vi.mock("./image", () => ({ readImageSize: vi.fn() }));
vi.mock("antd-img-crop", () => ({
  // jsdom cannot crop canvas images; retain Upload's real file-input/request lifecycle.
  default: ({ beforeCrop, children }: ComponentProps<typeof ImgCrop>) => {
    const child = children as ReactElement<UploadProps>;
    return cloneElement(child, {
      beforeUpload: async (file, fileList) => {
        if (beforeCrop && (await beforeCrop(file, fileList)) === false)
          return Upload.LIST_IGNORE;

        const cropped = Object.assign(
          new File([cropOutput.contents ?? file], file.name, {
            lastModified: file.lastModified,
            type: file.type,
          }),
          { lastModifiedDate: new Date(file.lastModified), uid: file.uid },
        );
        const accepted = await child.props.beforeUpload?.(cropped, [cropped]);
        return accepted === true ? cropped : accepted;
      },
    });
  },
}));

type SyntheticImage = { id: string; url: string };
type UploadTestProps = Extract<
  ComponentProps<typeof ImageUpload<SyntheticImage>>,
  { selectOnly?: false }
>;

const label = "Organization logo";
const previousImage = {
  id: "previous-image",
  url: "blob:synthetic-previous-image",
};
const acceptedImage = {
  id: "accepted-image",
  url: "blob:synthetic-accepted-image",
};
const onLoadingChange =
  vi.fn<NonNullable<UploadTestProps["onLoadingChange"]>>();
const onChange = vi.fn<NonNullable<UploadTestProps["onChange"]>>();
const onError = vi.fn<UploadTestProps["onError"]>();
const upload = vi.fn<UploadTestProps["upload"]>();

const renderUpload = () =>
  render(
    <ImageUpload
      label={label}
      onLoadingChange={onLoadingChange}
      onChange={onChange}
      onError={onError}
      settings={{ height: 256, size: 1_000_000, width: 256 }}
      upload={upload}
      value={previousImage}
    />,
  );

const getFileInput = (container: HTMLElement) => {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("Upload input is missing");
  return input;
};

const chooseFile = (
  container: HTMLElement,
  name = "image.png",
  type = "image/png",
) => {
  const file = new File(["synthetic image bytes"], name, {
    type,
  });
  fireEvent.change(getFileInput(container), {
    target: {
      files: [file],
    },
  });
  return file;
};

beforeEach(async () => {
  vi.resetAllMocks();
  cropOutput.contents = undefined;
  vi.mocked(readImageSize).mockResolvedValue({ height: 256, width: 256 });
  upload.mockResolvedValue(acceptedImage);
  await i18n.changeLanguage("en");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps one file input and makes only the card action open it for a saved image", async () => {
  const user = userEvent.setup();
  const field = (value?: SyntheticImage, disabled = false) => (
    <ImageUpload
      aria-describedby="logo-help"
      aria-required
      disabled={disabled}
      id="logo-field"
      label={label}
      onError={onError}
      settings={{ height: 256, size: 1_000_000, width: 256 }}
      upload={upload}
      value={value}
    />
  );
  const { container, rerender } = render(field());
  const input = getFileInput(container);
  const openFileDialog = vi.spyOn(input, "click");
  expect(input).toHaveAttribute("id", "logo-field");
  expect(input).toHaveAttribute("aria-required", "true");

  const add = screen.getByRole("button", { name: label });
  await user.tab();
  expect(add).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(openFileDialog).toHaveBeenCalledOnce();

  rerender(field(previousImage));
  const preview = screen.getByRole("img", { name: label });
  const replaceLabel = `${i18n.t("mediaImageReplace")} · ${label}`;
  const replace = screen.getByRole("button", { name: replaceLabel });
  expect(getFileInput(container)).toBe(input);
  expect(screen.getByRole("group", { name: label })).toContainElement(preview);
  expect(screen.getByRole("group", { name: label })).toContainElement(replace);
  expect(
    screen.queryByRole("button", { name: `${i18n.t("remove")} · ${label}` }),
  ).not.toBeInTheDocument();
  expect(replace).toHaveAttribute("tabindex", "0");
  expect(replace).toHaveAttribute("aria-describedby", "logo-help");
  await user.click(preview);
  expect(openFileDialog).toHaveBeenCalledOnce();
  await user.tab();
  expect(replace).toHaveFocus();
  await user.keyboard(" ");
  expect(openFileDialog).toHaveBeenCalledTimes(2);

  rerender(field(previousImage, true));
  expect(screen.getByRole("img", { name: label })).toBeVisible();
  const disabledReplace = screen.getByRole("button", { name: replaceLabel });
  expect(disabledReplace).toHaveAttribute("aria-disabled", "true");
  expect(disabledReplace).toHaveAttribute("tabindex", "-1");
  fireEvent.click(disabledReplace);
  fireEvent.keyDown(disabledReplace, { key: "Enter" });
  fireEvent.keyUp(disabledReplace, { key: "Enter" });
  expect(openFileDialog).toHaveBeenCalledTimes(2);
  expect(getFileInput(container)).toBeDisabled();
});

it("opens the full image from the cover and the replacement picker from the footer", async () => {
  const fullPreviewUrl = "/api/v1/public/images/previous-image";
  const user = userEvent.setup();
  // jsdom does not finish the preview's CSS leave transition.
  const { container } = render(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <ImageUpload
        fullPreviewUrl={fullPreviewUrl}
        label={label}
        onError={onError}
        onRemove={vi.fn()}
        settings={{ height: 256, size: 1_000_000, width: 256 }}
        upload={upload}
        value={previousImage}
      />
    </ConfigProvider>,
  );
  const openFileDialog = vi.spyOn(getFileInput(container), "click");
  const card = within(screen.getByRole("group", { name: label }));
  const actions = within(card.getByRole("list"));
  const previewLabel = `${i18n.t("mediaPreview")} · ${label}`;
  const replaceLabel = `${i18n.t("mediaImageReplace")} · ${label}`;
  const cover = card.getByRole("button", { name: previewLabel });
  const image = within(cover).getByRole("img", { name: label });
  const replace = actions.getByRole("button", { name: replaceLabel });
  expect(
    actions.getByRole("button", { name: `${i18n.t("remove")} · ${label}` }),
  ).toBeVisible();
  expect(actions.queryByRole("button", { name: previewLabel })).toBeNull();
  expect(image).toHaveAttribute("src", previousImage.url);

  await user.click(image);
  const dialog = within(await screen.findByRole("dialog", { name: label }));
  expect(dialog.getByRole("img", { name: label })).toHaveAttribute(
    "src",
    fullPreviewUrl,
  );
  expect(openFileDialog).not.toHaveBeenCalled();

  await user.click(dialog.getByRole("button", { name: /^close$/i }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await user.click(replace);
  expect(openFileDialog).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog")).toBeNull();
});

it.each([
  ["saved image", { value: previousImage }],
  ["legacy preview", { fallbackUrl: previousImage.url }],
] as const)(
  "removes the %s through a separate card action",
  async (_kind, preview) => {
    const user = userEvent.setup();
    const remove = vi.fn();
    const field = (disabled = false, cleared = false) => (
      <ImageUpload
        {...(cleared ? {} : preview)}
        disabled={disabled}
        label={label}
        onError={onError}
        onRemove={remove}
        settings={{ height: 256, size: 1_000_000, width: 256 }}
        upload={upload}
      />
    );
    const { container, rerender } = render(field());
    const openFileDialog = vi.spyOn(getFileInput(container), "click");
    const removeLabel = `${i18n.t("remove")} · ${label}`;
    const action = screen.getByRole("button", { name: removeLabel });

    expect(action).toHaveAttribute("tabindex", "0");
    await user.click(action);
    expect(remove).toHaveBeenCalledOnce();
    expect(openFileDialog).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();

    rerender(field(true));
    const disabledRemove = screen.getByRole("button", { name: removeLabel });
    expect(disabledRemove).toHaveAttribute("aria-disabled", "true");
    expect(disabledRemove).toHaveAttribute("tabindex", "-1");
    fireEvent.click(disabledRemove);
    fireEvent.keyDown(disabledRemove, { key: " " });
    fireEvent.keyUp(disabledRemove, { key: " " });
    expect(remove).toHaveBeenCalledOnce();
    rerender(field(false, true));
    expect(screen.queryByRole("button", { name: removeLabel })).toBeNull();
    expect(screen.getByRole("button", { name: label })).toBeEnabled();
  },
);

describe("image upload request lifecycle", () => {
  it("accepts WebP files", async () => {
    const managed = renderUpload();
    chooseFile(managed.container, "source.webp", "image/webp");
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledExactlyOnceWith(acceptedImage),
    );
    expect(upload).toHaveBeenCalledOnce();
  });

  it("passes the cropped file to a deferred form without starting an upload", async () => {
    cropOutput.contents = "cropped bytes";
    const select = vi.fn<(file: File) => void>();
    const { container } = render(
      <ImageUpload
        label={label}
        onChange={select}
        onError={onError}
        onLoadingChange={onLoadingChange}
        selectOnly
        settings={{ height: 256, size: 1_000_000, width: 256 }}
      />,
    );
    const input = chooseFile(container);

    await waitFor(() => expect(select).toHaveBeenCalledOnce());
    const [cropped] = select.mock.calls[0];
    expect(cropped).not.toBe(input);
    expect(cropped.name).toBe(input.name);
    expect(cropped.size).toBe(cropOutput.contents.length);
    expect(upload).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onLoadingChange).toHaveBeenLastCalledWith(false);
  });

  it("clears the cropped selection from a deferred form without uploading it", async () => {
    const previewUrl = "blob:cropped-preview";
    const revokeObjectURL = vi.fn();
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = () => previewUrl;
        static revokeObjectURL = revokeObjectURL;
      },
    );
    const user = userEvent.setup();

    function DeferredField() {
      const [value, setValue] = useState<File>();
      return (
        <ImageUpload
          label={label}
          onChange={setValue}
          onError={onError}
          onRemove={() => setValue(undefined)}
          selectOnly
          settings={{ height: 256, size: 1_000_000, width: 256 }}
          value={value}
        />
      );
    }

    const { container } = render(<DeferredField />);
    chooseFile(container);
    expect(await screen.findByRole("img", { name: label })).toHaveAttribute(
      "src",
      previewUrl,
    );
    expect(upload).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: `${i18n.t("remove")} · ${label}` }),
    );
    expect(screen.queryByRole("img", { name: label })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: label })).toBeEnabled();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(previewUrl);
    expect(upload).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("rejects an undecodable source before cropping and permits a successful retry", async () => {
    const failure = new Error("Synthetic image decode failure");
    vi.mocked(readImageSize).mockRejectedValueOnce(failure);
    const { container } = renderUpload();

    const selected = chooseFile(container, "corrupt.png");
    await waitFor(() =>
      expect(onError).toHaveBeenCalledExactlyOnceWith(failure),
    );

    expect(readImageSize).toHaveBeenCalledTimes(1);
    expect(vi.mocked(readImageSize).mock.calls[0][0]).toBe(selected);
    expect(upload).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(onLoadingChange).toHaveBeenLastCalledWith(false);
    expect(getFileInput(container).disabled).toBe(false);
    expect(screen.getByRole("img", { name: label }).getAttribute("src")).toBe(
      previousImage.url,
    );

    const retry = chooseFile(container, "retry.png");
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledExactlyOnceWith(acceptedImage),
    );

    expect(readImageSize).toHaveBeenCalledTimes(3);
    expect(vi.mocked(readImageSize).mock.calls[1][0]).toBe(retry);
    expect(vi.mocked(readImageSize).mock.calls[2][0]).not.toBe(retry);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onLoadingChange).toHaveBeenLastCalledWith(false);
    expect(getFileInput(container).disabled).toBe(false);
  });

  it.each(["success", "failure"] as const)(
    "ignores a late source decode %s after the control unmounts",
    async (outcome) => {
      const pending = deferred<Awaited<ReturnType<typeof readImageSize>>>();
      vi.mocked(readImageSize).mockReturnValueOnce(pending.promise);
      const { container, unmount } = renderUpload();
      const selected = chooseFile(container);
      await waitFor(() => expect(readImageSize).toHaveBeenCalledTimes(1));
      expect(vi.mocked(readImageSize).mock.calls[0][0]).toBe(selected);
      expect(onLoadingChange).toHaveBeenLastCalledWith(true);
      expect(getFileInput(container).disabled).toBe(true);

      unmount();
      expect(onLoadingChange).toHaveBeenLastCalledWith(false);
      const busyChanges = onLoadingChange.mock.calls.length;
      await act(async () => {
        if (outcome === "success") pending.resolve({ height: 256, width: 256 });
        else pending.reject(new Error("Synthetic obsolete decode failure"));
      });

      expect(readImageSize).toHaveBeenCalledTimes(1);
      expect(upload).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      expect(onLoadingChange).toHaveBeenCalledTimes(busyChanges);
    },
  );

  it("still rejects cropped images below the required dimensions", async () => {
    vi.mocked(readImageSize)
      .mockResolvedValueOnce({ height: 512, width: 512 })
      .mockResolvedValueOnce({ height: 128, width: 256 });
    const { container } = renderUpload();

    const selected = chooseFile(container);
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    expect(vi.mocked(readImageSize).mock.calls[0][0]).toBe(selected);
    expect(vi.mocked(readImageSize).mock.calls[1][0]).not.toBe(selected);
    expect(onError.mock.calls[0][0].message).toBe(i18n.t("imageTooSmall"));
    expect(upload).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(onLoadingChange).toHaveBeenLastCalledWith(false);
    expect(getFileInput(container).disabled).toBe(false);
  });

  it("still rejects cropped images that exceed the byte limit", async () => {
    cropOutput.contents = "a".repeat(1_000_001);
    const { container } = renderUpload();

    const selected = chooseFile(container);
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    expect(readImageSize).toHaveBeenCalledTimes(1);
    expect(vi.mocked(readImageSize).mock.calls[0][0]).toBe(selected);
    expect(onError.mock.calls[0][0].message).toBe(i18n.t("imageTooLarge"));
    expect(upload).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(onLoadingChange).toHaveBeenLastCalledWith(false);
    expect(getFileInput(container).disabled).toBe(false);
  });

  it("retains the accepted image after an upload failure and permits a successful retry", async () => {
    const pending = deferred<SyntheticImage>();
    const failure = new Error("Synthetic upload failure");
    upload.mockReturnValueOnce(pending.promise);
    const { container } = renderUpload();

    chooseFile(container);
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(getFileInput(container).disabled).toBe(true);
    expect(screen.getByText(i18n.t("loading"))).toBeDefined();
    expect(onLoadingChange).toHaveBeenLastCalledWith(true);

    await act(async () => {
      pending.reject(failure);
    });

    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(onChange).not.toHaveBeenCalled();
    expect(onLoadingChange).toHaveBeenLastCalledWith(false);
    expect(getFileInput(container).disabled).toBe(false);
    expect(screen.queryByText(i18n.t("loading"))).toBeNull();
    expect(screen.getByRole("img", { name: label }).getAttribute("src")).toBe(
      previousImage.url,
    );

    chooseFile(container, "retry.png");
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledExactlyOnceWith(acceptedImage);
      expect(onLoadingChange).toHaveBeenLastCalledWith(false);
      expect(getFileInput(container).disabled).toBe(false);
    });
    expect(upload).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it.each(["success", "failure"] as const)(
    "aborts on unmount and ignores a late upload %s",
    async (outcome) => {
      const pending = deferred<SyntheticImage>();
      upload.mockReturnValueOnce(pending.promise);
      const { container, unmount } = renderUpload();
      chooseFile(container);
      await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
      expect(onLoadingChange).toHaveBeenLastCalledWith(true);
      const signal = upload.mock.calls[0][2];
      expect(signal.aborted).toBe(false);

      unmount();
      expect(signal.aborted).toBe(true);
      expect(onLoadingChange).toHaveBeenLastCalledWith(false);
      const busyChanges = onLoadingChange.mock.calls.length;
      await act(async () => {
        if (outcome === "success") pending.resolve(acceptedImage);
        else pending.reject(new Error("Synthetic obsolete upload failure"));
      });

      expect(onChange).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      expect(onLoadingChange).toHaveBeenCalledTimes(busyChanges);
    },
  );
});
