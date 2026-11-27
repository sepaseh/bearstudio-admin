type ThumbnailDimensions = { height: number; width: number };

const maximumThumbnailBytes = 1024 * 1024;
const preparationTimeoutMs = 12_000;

const waitForVideo = (
  video: HTMLVideoElement,
  event: "loadeddata" | "seeked",
  signal: AbortSignal,
  start: () => void,
) =>
  new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();

    const cleanup = () => {
      video.removeEventListener(event, ready);
      video.removeEventListener("error", failed);
      signal.removeEventListener("abort", aborted);
    };
    const ready = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(new Error("The video frame could not be decoded."));
    };
    const aborted = () => {
      cleanup();
      reject(signal.reason);
    };

    video.addEventListener(event, ready);
    video.addEventListener("error", failed);
    signal.addEventListener("abort", aborted);
    try {
      start();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });

const encodeJpeg = (
  canvas: HTMLCanvasElement,
  quality: number,
  signal: AbortSignal,
) =>
  new Promise<Blob>((resolve, reject) => {
    signal.throwIfAborted();
    const aborted = () => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    try {
      canvas.toBlob(
        (blob) => {
          signal.removeEventListener("abort", aborted);
          if (blob?.type === "image/jpeg") resolve(blob);
          else reject(new Error("The video thumbnail could not be encoded."));
        },
        "image/jpeg",
        quality,
      );
    } catch (error) {
      signal.removeEventListener("abort", aborted);
      reject(error);
    }
  });

export const captureVideoThumbnail = async (
  file: File,
  { height, width }: ThumbnailDimensions,
  signal: AbortSignal,
): Promise<File> => {
  signal.throwIfAborted();
  const timeout = new AbortController();
  const operation = AbortSignal.any([signal, timeout.signal]);
  const video = document.createElement("video");
  const url = URL.createObjectURL(file);
  const deadline = window.setTimeout(
    () => timeout.abort(),
    preparationTimeoutMs,
  );
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;

  try {
    await waitForVideo(video, "loadeddata", operation, () => {
      video.src = url;
    });
    const { duration, videoHeight, videoWidth } = video;
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      !videoWidth ||
      !videoHeight
    )
      throw new Error("The MP4 has no decodable visual track.");

    const frameTime = Math.min(1, duration / 2);
    if (video.currentTime !== frameTime)
      await waitForVideo(video, "seeked", operation, () => {
        video.currentTime = frameTime;
      });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas image processing is unavailable.");

    const cropWidth = Math.min(videoWidth, (videoHeight * width) / height);
    const cropHeight = Math.min(videoHeight, (videoWidth * height) / width);
    context.drawImage(
      video,
      (videoWidth - cropWidth) / 2,
      (videoHeight - cropHeight) / 2,
      cropWidth,
      cropHeight,
      0,
      0,
      width,
      height,
    );

    for (const quality of [0.82, 0.6, 0.4]) {
      const blob = await encodeJpeg(canvas, quality, operation);
      operation.throwIfAborted();
      if (blob.size > 0 && blob.size <= maximumThumbnailBytes)
        return new File([blob], "thumbnail.jpg", { type: blob.type });
    }
    throw new Error("The video thumbnail exceeds the size limit.");
  } finally {
    window.clearTimeout(deadline);
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
};
