import {
  Flex,
  Image,
  Progress,
  Spin,
  Tooltip,
  Typography,
  Upload,
  type UploadProps,
  type UploadRef,
} from "antd";
import ImgCrop from "antd-img-crop";
import {
  type AriaAttributes,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import type { UploadProgressHandler } from "@/shared/api";
import { useAbortController, useLock } from "@/shared/hooks";
import {
  MediaUploadCard,
  mediaUploadPreviewStyle,
} from "@/shared/ui/MediaUploadCard";
import { MediaUploadPlaceholder } from "@/shared/ui/MediaUploadPlaceholder";

import { readImageSize } from "./image";

type ImageUploadBaseProps = Pick<
  AriaAttributes,
  "aria-describedby" | "aria-invalid" | "aria-required"
> & {
  disabled?: boolean;
  fallbackUrl?: string;
  fullPreviewUrl?: string;
  id?: string;
  label: string;
  onLoadingChange?: (loading: boolean) => void;
  onError: (error: Error) => void;
  onRemove?: () => void;
  settings: { height: number; size: number; width: number };
};

type ImmediateUpload<T> = {
  selectOnly?: false;
  onChange?: (image: T) => void;
  upload: (
    file: File,
    onUploadProgress: UploadProgressHandler,
    signal: AbortSignal,
  ) => Promise<T>;
  value?: T;
};

type DeferredSelection = {
  selectOnly: true;
  onChange?: (file: File) => void;
  value?: File;
};

type ImageUploadProps<T> = ImageUploadBaseProps &
  (ImmediateUpload<T> | DeferredSelection);

export const ImageUpload = <T extends { id: string; url: string }>(
  props: ImageUploadProps<T>,
) => {
  const {
    disabled = false,
    fallbackUrl,
    fullPreviewUrl,
    id,
    label,
    onLoadingChange,
    onError,
    onRemove,
    settings,
    "aria-describedby": description,
    "aria-invalid": invalid,
    "aria-required": required,
  } = props;
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState<number>();
  const [localPreview, setLocalPreview] = useState<{
    file: File;
    url: string;
  }>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const { cancel, start } = useAbortController();
  const { lock, unlock } = useLock();
  const active = useRef(false);
  const container = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const notify = useRef(onLoadingChange);
  const sourceFiles = useRef(new WeakSet<File>());
  const uploadRef = useRef<UploadRef<T>>(null);
  const { height, size, width } = settings;
  const aspect = width / height;
  const types = ["image/jpeg", "image/png", "image/webp"];
  const file = props.selectOnly ? props.value : undefined;
  const previewUrl = props.selectOnly
    ? localPreview && localPreview.file === file
      ? localPreview.url
      : undefined
    : (props.value?.url ?? fallbackUrl);

  const finish = () => {
    active.current = false;
    unlock();
    if (mounted.current) {
      setBusy(false);
      setPercent(undefined);
      notify.current?.(false);
    }
  };

  const beforeCrop: NonNullable<UploadProps["beforeUpload"]> = async (
    selected,
  ) => {
    sourceFiles.current.add(selected);
    if (disabled || !mounted.current || !lock()) return false;

    try {
      const webpWithoutType = !selected.type && /\.webp$/i.test(selected.name);
      if (
        !selected.size ||
        (!types.includes(selected.type) && !webpWithoutType)
      ) {
        throw new Error(t("mediaImageInvalid"));
      }
      if (selected.size > size) throw new Error(t("imageTooLarge"));
      active.current = true;
      setBusy(true);
      notify.current?.(true);
      await readImageSize(selected);
      if (!mounted.current) {
        finish();
        return false;
      }

      return true;
    } catch (error) {
      if (mounted.current && error instanceof Error) onError(error);
      finish();
      return false;
    }
  };

  const beforeUpload: NonNullable<UploadProps["beforeUpload"]> = async (
    selected,
  ) => {
    if (sourceFiles.current.has(selected) || !mounted.current)
      return Upload.LIST_IGNORE;

    try {
      if (selected.size > size) throw new Error(t("imageTooLarge"));
      const dimensions = await readImageSize(selected);
      if (!mounted.current) return Upload.LIST_IGNORE;
      if (dimensions.width < width || dimensions.height < height) {
        throw new Error(t("imageTooSmall"));
      }
      if (props.selectOnly) {
        props.onChange?.(selected);
        finish();
        return Upload.LIST_IGNORE;
      }
      return true;
    } catch (error) {
      if (mounted.current && error instanceof Error) onError(error);
      finish();
      return Upload.LIST_IGNORE;
    }
  };

  const handleUpload: UploadProps["customRequest"] = async ({
    file: selected,
    onSuccess,
    onProgress,
    onError: reject,
  }) => {
    if (!mounted.current || props.selectOnly) return;

    const signal = start();

    try {
      if (!(selected instanceof File)) throw new Error(t("imageInvalid"));
      setPercent(0);
      const result = await props.upload(
        selected,
        (event) => {
          if (
            signal.aborted ||
            !mounted.current ||
            event.progress === undefined
          )
            return;

          const progress = Math.min(
            100,
            Math.max(0, Math.round(event.progress * 100)),
          );
          setPercent(progress);
          onProgress?.({ percent: progress });
        },
        signal,
      );
      if (signal.aborted || !mounted.current) return;

      props.onChange?.(result);
      onSuccess?.(result);
    } catch (error) {
      if (!signal.aborted && mounted.current && error instanceof Error) {
        onError(error);
        reject?.(error);
      }
    } finally {
      if (!signal.aborted) finish();
    }
  };

  const chooseFile = () => {
    uploadRef.current?.nativeElement
      ?.querySelector<HTMLInputElement>('input[type="file"]')
      ?.click();
  };

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLocalPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useLayoutEffect(() => {
    notify.current = onLoadingChange;
  }, [onLoadingChange]);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancel();
      unlock();
      if (active.current) {
        active.current = false;
        notify.current?.(false);
      }
    };
  }, [cancel, unlock]);

  const status = (
    <Flex align="center" gap={4} role="status" vertical>
      {percent === undefined ? (
        <Spin size="small" />
      ) : (
        <Progress percent={percent} size="small" status="active" />
      )}
      <Typography.Text style={{ overflowWrap: "anywhere" }}>
        {t("loading")}
      </Typography.Text>
    </Flex>
  );
  const previewLabel = t("mediaPreview");
  const previewImage = previewUrl ? (
    <img alt={label} src={previewUrl} style={mediaUploadPreviewStyle} />
  ) : null;

  return (
    <Flex gap={8} ref={container} style={{ minWidth: 0 }} vertical>
      <ImgCrop
        aspect={aspect}
        beforeCrop={beforeCrop}
        fillColor="transparent"
        modalCancel={t("cancel")}
        modalOk={t("submit")}
        modalProps={{
          getContainer: () => container.current ?? document.body,
          afterOpenChange: (open) => {
            if (!open) return;

            container.current
              ?.querySelector('[role="slider"]')
              ?.setAttribute("aria-label", t("imageZoom"));
            for (const button of container.current?.querySelectorAll<HTMLButtonElement>(
              ".img-crop-control button",
            ) ?? []) {
              button.type = "button";
            }
          },
        }}
        modalTitle={t("cropImage")}
        onModalCancel={(resolve) => {
          finish();
          resolve(Upload.LIST_IGNORE);
        }}
        quality={1}
        rotationSlider={false}
      >
        <Upload<T>
          accept={[...types, ".webp"].join(",")}
          aria-describedby={description}
          aria-invalid={invalid}
          aria-label={label}
          aria-required={required}
          beforeUpload={beforeUpload}
          customRequest={props.selectOnly ? undefined : handleUpload}
          disabled={disabled || busy}
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
              aria-describedby={description}
              aria-invalid={invalid}
              cover={
                fullPreviewUrl ? (
                  <Tooltip title={previewLabel} trigger={["hover", "focus"]}>
                    <button
                      aria-label={`${previewLabel} · ${label}`}
                      disabled={disabled || busy}
                      onClick={() => setPreviewOpen(true)}
                      style={{
                        background: "transparent",
                        border: 0,
                        cursor: disabled || busy ? "default" : "zoom-in",
                        overflow: "hidden",
                        padding: 0,
                      }}
                      type="button"
                    >
                      {previewImage}
                    </button>
                  </Tooltip>
                ) : (
                  previewImage
                )
              }
              disabled={disabled}
              label={label}
              onRemove={onRemove}
              onReplace={chooseFile}
              replaceLabel={t("mediaImageReplace")}
              status={busy ? status : null}
            />
          ) : (
            <MediaUploadPlaceholder
              aria-describedby={description}
              aria-invalid={invalid}
              disabled={disabled}
              label={label}
              onSelect={chooseFile}
              status={busy ? status : null}
            />
          )}
        </Upload>
      </ImgCrop>
      {fullPreviewUrl && (
        <Image.PreviewGroup
          items={[{ alt: label, src: fullPreviewUrl }]}
          preview={{
            alt: label,
            open: previewOpen,
            onOpenChange: setPreviewOpen,
          }}
        />
      )}
      <Typography.Text type="secondary">
        {t("imageTarget")}: {width} × {height}
      </Typography.Text>
    </Flex>
  );
};
