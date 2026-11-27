import {
  Button,
  Flex,
  Progress,
  Typography,
  Upload,
  type UploadProps,
  type UploadRef,
} from "antd";
import { isCancel } from "axios";
import {
  type AriaAttributes,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import type { UploadProgressHandler } from "@/shared/api";
import { useAbortController, useLock } from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";
import {
  MediaUploadCard,
  mediaUploadPreviewStyle,
} from "@/shared/ui/MediaUploadCard";
import { MediaUploadPlaceholder } from "@/shared/ui/MediaUploadPlaceholder";

type VideoUploadProps<T> = AriaAttributes & {
  disabled?: boolean;
  id?: string;
  label: string;
  onChange?: (video: T) => void;
  onLoadingChange?: (loading: boolean) => void;
  onRemove?: () => void;
  posterUrl?: string;
  previewUrl?: string;
  upload: (
    file: File,
    onUploadProgress: UploadProgressHandler,
    signal: AbortSignal,
  ) => Promise<T>;
};

const maximumVideoBytes = 100 * 1024 * 1024;

export const VideoUpload = <T,>({
  "aria-required": required,
  disabled = false,
  id,
  label,
  onChange,
  onLoadingChange,
  onRemove,
  posterUrl,
  previewUrl,
  upload,
  ...aria
}: VideoUploadProps<T>) => {
  const { t } = useTranslation();
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<number>();
  const { cancel, start } = useAbortController();
  const { lock, unlock } = useLock();
  const mounted = useRef(false);
  const request = useRef<{ cancelled: () => void; release: () => void }>(
    undefined,
  );
  const uploadRef = useRef<UploadRef<T>>(null);
  const uploading = progress !== undefined;

  const finish = useCallback(() => {
    const active = request.current;
    request.current = undefined;
    unlock();
    if (mounted.current) setProgress(undefined);
    active?.release();
  }, [unlock]);

  const cancelUpload = useCallback(() => {
    cancel();
    request.current?.cancelled();
    finish();
  }, [cancel, finish]);

  const chooseFile = () => {
    uploadRef.current?.nativeElement
      ?.querySelector<HTMLInputElement>('input[type="file"]')
      ?.click();
  };

  const removePreview = () => {
    setError(undefined);
    onRemove?.();
  };

  const beforeUpload: NonNullable<UploadProps["beforeUpload"]> = (file) => {
    if (disabled || !mounted.current || request.current)
      return Upload.LIST_IGNORE;

    if (
      file.type !== "video/mp4" ||
      file.size === 0 ||
      file.size > maximumVideoBytes
    ) {
      setError(t("mediaVideoInvalid"));
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const handleUpload: UploadProps["customRequest"] = async ({
    file,
    onError: reject,
    onProgress,
    onSuccess,
  }) => {
    if (disabled || !mounted.current || !(file instanceof File) || !lock())
      return;

    const signal = start();
    request.current = {
      cancelled: () => reject?.(new Error(t("cancel"))),
      release: () => onLoadingChange?.(false),
    };
    setError(undefined);
    setProgress(0);
    onLoadingChange?.(true);

    try {
      const result = await upload(
        file,
        ({ progress }) => {
          if (signal.aborted || !mounted.current || progress === undefined)
            return;
          const percent = Math.min(
            100,
            Math.max(0, Math.round(progress * 100)),
          );
          setProgress(percent);
          onProgress?.({ percent });
        },
        signal,
      );
      if (signal.aborted || !mounted.current) return;
      onSuccess?.(result);
      onChange?.(result);
    } catch (failure) {
      if (signal.aborted || !mounted.current) return;
      if (!isCancel(failure)) setError(getErrorMessage(failure));
      reject?.(
        failure instanceof Error
          ? failure
          : new Error(getErrorMessage(failure)),
      );
    } finally {
      if (!signal.aborted) finish();
    }
  };

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancel();
      finish();
    };
  }, [cancel, finish]);

  useLayoutEffect(() => {
    if (request.current) cancelUpload();
  }, [cancelUpload, disabled, id, previewUrl]);

  const status = uploading ? (
    <Flex align="center" gap={4} justify="center" vertical>
      <Progress percent={progress} size="small" status="active" />
      <Typography.Text>{t("loading")}</Typography.Text>
      <Button onClick={cancelUpload} size="small">
        {t("cancel")}
      </Button>
    </Flex>
  ) : null;

  return (
    <Flex gap="small" vertical>
      <Upload<T>
        accept="video/mp4,.mp4"
        aria-label={id ? undefined : label}
        aria-required={required}
        {...aria}
        beforeUpload={beforeUpload}
        customRequest={handleUpload}
        disabled={disabled || uploading}
        hasControlInside
        id={id}
        maxCount={1}
        openFileDialogOnClick={false}
        ref={uploadRef}
        showUploadList={false}
        styles={{ trigger: { display: "block" } }}
      >
        {previewUrl ? (
          <MediaUploadCard
            {...aria}
            cover={
              <video
                aria-label={`${label} · ${t("mediaPreview")}`}
                controls
                playsInline
                poster={posterUrl}
                preload="metadata"
                src={previewUrl}
                style={{
                  ...mediaUploadPreviewStyle,
                  background: "black",
                }}
              />
            }
            disabled={disabled}
            label={label}
            onRemove={onRemove ? removePreview : undefined}
            onReplace={chooseFile}
            replaceLabel={t("mediaVideoReplace")}
            status={status}
          />
        ) : (
          <MediaUploadPlaceholder
            {...aria}
            disabled={disabled}
            label={label}
            onSelect={chooseFile}
            status={status}
          />
        )}
      </Upload>
      {error ? (
        <Typography.Text role="alert" type="danger">
          {error}
        </Typography.Text>
      ) : null}
    </Flex>
  );
};
