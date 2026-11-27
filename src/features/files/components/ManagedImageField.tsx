import { Alert, Flex, Image } from "antd";
import { type ComponentProps, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOutletContext } from "react-router";

import { useOptionalCore } from "@/app/hooks/useCore";
import type { DefaultLayoutContext } from "@/layouts/default";
import { getErrorMessage } from "@/shared/lib";
import { ImageUpload } from "@/shared/ui/image-upload";

import { uploadImage } from "../api";
import type { ImageRecord, ImageReference } from "../types";
import { ManagedImagePicker } from "./MediaPicker";

type ManagedImageFieldProps = ComponentProps<typeof ManagedImagePicker> & {
  fallbackUrl?: string;
  fullImagePreview?: boolean;
  imageReferences?: readonly ImageReference[];
  label?: string;
  onLoadingChange?: (loading: boolean) => void;
};

type MediaContext = DefaultLayoutContext<{ permissions: readonly string[] }>;

const squarePreviewSize = 80;

export const ManagedImageField = (props: ManagedImageFieldProps) => {
  const { t } = useTranslation();
  const {
    fallbackUrl,
    fullImagePreview = false,
    imageReferences,
    label = t("image"),
    onLoadingChange,
    ...pickerProps
  } = props;
  const { context, disabled, id, multiple, maxCount, value } = pickerProps;
  const [activeSlot, setActiveSlot] = useState<number>();
  const profiles = useOptionalCore()?.settings.uploadProfiles;
  const [uploadError, setUploadError] = useState<string>();
  const [knownImages, setKnownImages] = useState<
    Record<string, ImageReference>
  >({});
  const active = useRef<number | undefined>(undefined);
  const permissions = useOutletContext<MediaContext>()?.currentUser.permissions;
  const canBrowse = permissions?.includes("media.read") === true;
  const canUpload = permissions?.includes("media.write") === true;
  const uploadContext = context === "editorial" ? "project" : context;
  const profile =
    profiles?.[uploadContext === "approach" ? "service" : uploadContext];
  const squarePreview = context === "service" || context === "approach";
  const showPicker = !canUpload && canBrowse;

  const ids = multiple ? (value ?? []) : value ? [value] : [];
  const findImage = (imageId?: string | null) =>
    imageId
      ? (knownImages[imageId] ??
        imageReferences?.find(({ id }) => id === imageId))
      : undefined;

  if (showPicker && !(squarePreview && multiple)) {
    const picker = (
      <ManagedImagePicker
        {...pickerProps}
        previewUrl={findImage(ids[0])?.url}
      />
    );
    return fallbackUrl && !value ? (
      <Flex gap={8} vertical>
        <Image alt={label} src={fallbackUrl} width={104} />
        {picker}
      </Flex>
    ) : (
      picker
    );
  }

  const editable = canUpload && !disabled;
  const stackSlots = editable && squarePreview;
  const slots: (string | null)[] = multiple ? [...ids] : [ids[0] ?? null];
  if (multiple && editable && (maxCount === undefined || ids.length < maxCount))
    slots.push(null);
  const notifyLoading = (index: number, loading: boolean) => {
    if (!loading && active.current !== index) return;

    active.current = loading ? index : undefined;
    setActiveSlot(active.current);
    if (loading) setUploadError(undefined);
    onLoadingChange?.(loading);
  };

  const acceptImage = (index: number, image: ImageReference) => {
    const imageId = image.id;
    setKnownImages((current) => ({ ...current, [imageId]: image }));
    if (!props.multiple) {
      props.onChange?.(imageId);
      return;
    }
    const current = props.value ?? [];
    props.onChange?.(
      index < current.length
        ? current.map((value, position) =>
            position === index ? imageId : value,
          )
        : [...current, imageId],
    );
  };

  const rememberSelections = (images: ImageRecord[]) => {
    setKnownImages((current) => ({
      ...current,
      ...Object.fromEntries(
        images.map(({ id, previewUrl, thumbnailUrl, thumb }) => [
          id,
          { id, url: previewUrl, thumb: thumbnailUrl ?? thumb },
        ]),
      ),
    }));
  };

  const removeImage = (index: number) => {
    setUploadError(undefined);
    if (!props.multiple) {
      props.onChange?.(null);
      return;
    }
    props.onChange?.(
      (props.value ?? []).filter((_, position) => position !== index),
    );
  };

  return (
    <Flex gap={8} vertical>
      <Flex
        align={stackSlots ? "stretch" : "start"}
        gap={12}
        vertical={stackSlots}
        wrap={!stackSlots}
      >
        {slots.map((imageId, index) => {
          const reference = findImage(imageId);
          const imageUrl = reference?.url;
          const url =
            (squarePreview ? reference?.thumb : undefined) ??
            imageUrl ??
            fallbackUrl;
          const labelForSlot = multiple ? `${label} ${index + 1}` : label;
          return (
            <Flex
              gap={4}
              key={`${index}:${imageId ?? "new"}`}
              style={
                stackSlots || (editable && !multiple)
                  ? { minWidth: 0, width: "100%" }
                  : undefined
              }
              vertical
            >
              {editable && profile ? (
                <ImageUpload
                  aria-describedby={pickerProps["aria-describedby"]}
                  aria-invalid={pickerProps["aria-invalid"]}
                  aria-required={pickerProps["aria-required"]}
                  disabled={activeSlot !== undefined && activeSlot !== index}
                  fallbackUrl={fallbackUrl}
                  fullPreviewUrl={
                    squarePreview || fullImagePreview ? imageUrl : undefined
                  }
                  id={index === 0 ? id : undefined}
                  label={labelForSlot}
                  onChange={(uploaded) => acceptImage(index, uploaded)}
                  onError={(error) => setUploadError(getErrorMessage(error))}
                  onLoadingChange={(loading) => notifyLoading(index, loading)}
                  onRemove={
                    imageId && props.onChange
                      ? () => removeImage(index)
                      : undefined
                  }
                  settings={profile}
                  upload={async (file, progress, signal) => {
                    const uploaded = await uploadImage(
                      { context: uploadContext, file },
                      progress,
                      signal,
                    );
                    return {
                      id: uploaded.id,
                      url: uploaded.previewUrl,
                      thumb: uploaded.thumbnailUrl ?? uploaded.thumb,
                    };
                  }}
                  value={imageId && url ? { id: imageId, url } : undefined}
                />
              ) : url ? (
                <Image
                  alt={labelForSlot}
                  height={squarePreview ? squarePreviewSize : undefined}
                  preview={
                    squarePreview && imageUrl ? { src: imageUrl } : undefined
                  }
                  src={url}
                  width={squarePreview ? squarePreviewSize : 104}
                />
              ) : null}
            </Flex>
          );
        })}
      </Flex>
      {showPicker && (
        <ManagedImagePicker
          {...pickerProps}
          onSelectImages={rememberSelections}
        />
      )}
      {editable && !profile && (
        <Alert message={t("unexpectedError")} type="error" />
      )}
      {uploadError && <Alert message={uploadError} type="error" />}
    </Flex>
  );
};
