import { Flex, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useOutletContext } from "react-router";

import { useOptionalCore } from "@/app/hooks/useCore";
import type { DefaultLayoutContext } from "@/layouts/default";
import { captureVideoThumbnail, VideoUpload } from "@/shared/ui/video-upload";

import { uploadVideo } from "../api";
import type { VideoRecord, VideoReference, VideoSource } from "../types";
import { ManagedVideoPicker, type PickerProps } from "./MediaPicker";

type VideoSourcePickerProps = PickerProps & {
  label?: string;
  onChange?: (source: VideoSource | null) => void;
  onLoadingChange?: (loading: boolean) => void;
  value?: VideoSource | null;
  videoReference?: VideoReference | null;
};

export const VideoSourcePicker = ({
  disabled,
  id,
  label,
  onChange,
  onLoadingChange,
  selectOnly,
  value,
  videoReference,
  ...aria
}: VideoSourcePickerProps) => {
  const { t } = useTranslation();
  const thumbnailProfile =
    useOptionalCore()?.settings.uploadProfiles?.thumbnail;
  const [uploadedPreview, setUploadedPreview] = useState<VideoRecord>();
  const context =
    useOutletContext<
      DefaultLayoutContext<{ permissions: readonly string[] }>
    >();
  const canUpload =
    context?.currentUser.permissions.includes("media.write") ?? false;
  const uploaded =
    uploadedPreview?.id === value?.id ? uploadedPreview : undefined;
  const videoUrl =
    uploaded?.previewUrl ??
    (videoReference?.id === value?.id ? videoReference?.url : undefined);
  const canEdit = !disabled && Boolean(onChange);

  const removeVideo = () => {
    setUploadedPreview(undefined);
    onChange?.(null);
  };

  return (
    <Flex gap="small" vertical>
      {canUpload ? (
        <VideoUpload<VideoRecord>
          {...aria}
          disabled={!canEdit || !thumbnailProfile}
          id={id}
          label={label ?? t("video")}
          onChange={(entry) => {
            setUploadedPreview(entry);
            onChange?.({ id: entry.id });
          }}
          onLoadingChange={onLoadingChange}
          onRemove={onChange ? removeVideo : undefined}
          posterUrl={uploaded?.thumbnailUrl ?? undefined}
          previewUrl={videoUrl}
          upload={async (file, onProgress, signal) => {
            if (!thumbnailProfile)
              throw new Error(t("mediaVideoThumbnailError"));
            const thumbnail = await captureVideoThumbnail(
              file,
              thumbnailProfile,
              signal,
            ).catch((error: unknown) => {
              if (signal.aborted) throw error;
              throw new Error(t("mediaVideoThumbnailError"), { cause: error });
            });
            signal.throwIfAborted();
            return uploadVideo({ file, thumbnail }, onProgress, signal);
          }}
        />
      ) : (
        <ManagedVideoPicker
          {...(label && !id ? { "aria-label": label } : {})}
          {...aria}
          disabled={disabled}
          id={id}
          onChange={(selected) =>
            onChange?.(selected ? { id: selected } : null)
          }
          previewUrl={videoUrl}
          selectOnly={selectOnly}
          value={value?.id}
        />
      )}
      {value?.url ? (
        <Typography.Text
          style={{ minWidth: 0, overflowWrap: "anywhere" }}
          type="secondary"
        >
          {value.url}
        </Typography.Text>
      ) : null}
    </Flex>
  );
};
