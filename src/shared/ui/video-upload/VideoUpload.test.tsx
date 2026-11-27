import { act, fireEvent, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";
import { render, screen } from "@/test/render";

import { VideoUpload } from "./VideoUpload";

type Upload = ComponentProps<typeof VideoUpload<string>>["upload"];

const previewUrl = "/api/v1/public/videos/previous";

const chooseFile = (container: HTMLElement, file: File) => {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("Video input is missing");
  fireEvent.change(input, { target: { files: [file] } });
};

it("keeps playback and keyboard file selection separate within the upload card", async () => {
  const upload = vi.fn<Upload>();
  const { container, rerender, user } = render(
    <VideoUpload label="Video" previewUrl={previewUrl} upload={upload} />,
  );
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("Video input is missing");
  const openFilePicker = vi.spyOn(input, "click");
  const card = within(screen.getByRole("group", { name: "Video" }));
  const player = card.getByLabelText(`Video · ${i18n.t("mediaPreview")}`);
  const replaceLabel = `${i18n.t("mediaVideoReplace")} · Video`;
  const replace = card.getByRole("button", { name: replaceLabel });
  const actions = card.getByRole("list");

  expect(actions).toContainElement(replace);
  expect(actions).not.toContainElement(player);
  expect(replace).not.toHaveTextContent(i18n.t("mediaVideoReplace"));
  expect(replace).toHaveAttribute("tabindex", "0");
  expect(player).toHaveAttribute("controls");
  expect(player).toHaveAttribute("playsinline");
  expect(player).not.toHaveAttribute("autoplay");
  fireEvent.click(player);
  fireEvent.keyDown(player, { key: "Enter" });
  expect(openFilePicker).not.toHaveBeenCalled();

  replace.focus();
  await user.keyboard("{Enter} ");
  expect(openFilePicker).toHaveBeenCalledTimes(2);

  rerender(
    <VideoUpload
      disabled
      label="Video"
      previewUrl={previewUrl}
      upload={upload}
    />,
  );
  const disabledReplace = screen.getByRole("button", { name: replaceLabel });
  expect(disabledReplace).toHaveAttribute("aria-disabled", "true");
  expect(disabledReplace).toHaveAttribute("tabindex", "-1");
  fireEvent.click(disabledReplace);
  fireEvent.keyDown(disabledReplace, { key: "Enter" });
  fireEvent.keyUp(disabledReplace, { key: "Enter" });
  expect(openFilePicker).toHaveBeenCalledTimes(2);
  expect(player).toHaveAttribute("controls");
  expect(player).toHaveAttribute("src", previewUrl);
});

it("rejects empty, non-MP4, and oversized files without replacing the preview", async () => {
  const upload = vi.fn<Upload>();
  const { container } = render(
    <VideoUpload label="Video" previewUrl={previewUrl} upload={upload} />,
  );
  const oversized = new File(["synthetic"], "large.mp4", { type: "video/mp4" });
  Object.defineProperty(oversized, "size", { value: 100 * 1024 * 1024 + 1 });

  for (const file of [
    new File([], "empty.mp4", { type: "video/mp4" }),
    new File(["synthetic"], "wrong.webm", { type: "video/webm" }),
    oversized,
  ]) {
    chooseFile(container, file);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      i18n.t("mediaVideoInvalid"),
    );
    expect(upload).not.toHaveBeenCalled();
    expect(container.querySelector("video")).toHaveAttribute("src", previewUrl);
  }
});

it("cancels the request, keeps the previous preview and accepts only the retried upload", async () => {
  const initial = deferred<string>();
  const upload = vi
    .fn<Upload>()
    .mockImplementationOnce(async (_, onProgress) => {
      onProgress({
        bytes: 42,
        lengthComputable: true,
        loaded: 42,
        progress: 0.42,
      });
      return initial.promise;
    })
    .mockResolvedValueOnce("accepted");
  const onChange = vi.fn<(videoId: string) => void>();
  const onLoadingChange = vi.fn<(loading: boolean) => void>();
  const { container, user } = render(
    <VideoUpload
      label="Video"
      onChange={onChange}
      onLoadingChange={onLoadingChange}
      previewUrl={previewUrl}
      upload={upload}
    />,
  );
  const original = new File(["synthetic"], "original.mp4", {
    type: "video/mp4",
  });
  chooseFile(container, original);
  await waitFor(() => expect(upload).toHaveBeenCalledOnce());
  const [input, , signal] = upload.mock.calls[0];
  expect(input).toBe(original);
  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "42",
  );
  expect(container.querySelector("video")).toHaveAttribute("src", previewUrl);

  await user.click(screen.getByRole("button", { name: i18n.t("cancel") }));
  expect(signal.aborted).toBe(true);
  expect(onLoadingChange.mock.calls).toEqual([[true], [false]]);
  expect(container.querySelector("video")).toHaveAttribute("src", previewUrl);

  const retry = new File(["retry"], "retry.mp4", { type: "video/mp4" });
  chooseFile(container, retry);
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledExactlyOnceWith("accepted"),
  );
  await act(async () => initial.resolve("stale"));
  expect(upload.mock.calls[1][0]).toBe(retry);
  expect(onLoadingChange.mock.calls).toEqual([
    [true],
    [false],
    [true],
    [false],
  ]);
  expect(onChange).toHaveBeenCalledExactlyOnceWith("accepted");
});

it("keeps the existing video and exposes an upload error with retry available", async () => {
  const upload = vi
    .fn<Upload>()
    .mockRejectedValue(new Error("Video upload failed"));
  const onChange = vi.fn<(videoId: string) => void>();
  const { container } = render(
    <VideoUpload
      label="Video"
      onChange={onChange}
      previewUrl={previewUrl}
      upload={upload}
    />,
  );
  chooseFile(
    container,
    new File(["synthetic"], "failure.mp4", { type: "video/mp4" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Video upload failed",
  );
  expect(container.querySelector("video")).toHaveAttribute("src", previewUrl);
  await waitFor(() =>
    expect(container.querySelector('input[type="file"]')).toBeEnabled(),
  );
  expect(onChange).not.toHaveBeenCalled();
});

it("does not attach a response to a changed field", async () => {
  const pending = deferred<string>();
  const upload = vi.fn<Upload>().mockReturnValue(pending.promise);
  const onChange = vi.fn<(videoId: string) => void>();
  const field = (source: string) => (
    <VideoUpload
      label="Video"
      onChange={onChange}
      previewUrl={source}
      upload={upload}
    />
  );
  const { container, rerender } = render(field(previewUrl));
  chooseFile(
    container,
    new File(["synthetic"], "abandoned.mp4", { type: "video/mp4" }),
  );
  await waitFor(() => expect(upload).toHaveBeenCalledOnce());
  const signal = upload.mock.calls[0][2];

  const nextUrl = "/api/v1/public/videos/different";
  rerender(field(nextUrl));
  await act(async () => pending.resolve("stale"));
  expect(signal.aborted).toBe(true);
  expect(container.querySelector("video")).toHaveAttribute("src", nextUrl);
  expect(onChange).not.toHaveBeenCalled();
});
