import { Avatar, Flex, Image, Pagination, Select } from "antd";
import { isCancel } from "axios";
import { type AriaAttributes, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOutletContext } from "react-router";

import type { DefaultLayoutContext } from "@/layouts/default";
import { defaultPageSize } from "@/shared/config";
import { useAbortController } from "@/shared/hooks";
import { ErrorFallback } from "@/shared/ui/error-boundary";

import { fetchImages, fetchVideos } from "../api";
import type { ImageFilter, ImageRecord, VideoRecord } from "../types";

export type PickerProps = AriaAttributes & {
  disabled?: boolean;
  id?: string;
  previewUrl?: string;
  selectOnly?: boolean;
};

type SingleSelectionProps = PickerProps & {
  maxCount?: never;
  multiple?: false;
  onChange?: (id: string | null) => void;
  value?: string | null;
};

type MultipleSelectionProps = PickerProps & {
  maxCount?: number;
  multiple: true;
  onChange?: (ids: string[]) => void;
  value?: string[];
};

type SelectionProps = SingleSelectionProps | MultipleSelectionProps;

type ImagePickerProps = SelectionProps & {
  context: ImageFilter;
  onSelectImages?: (images: ImageRecord[]) => void;
};

type MediaPickerProps = SelectionProps & {
  context?: ImageFilter;
  kind: "image" | "video";
  onSelectImages?: (images: ImageRecord[]) => void;
};

type MediaReadContext = DefaultLayoutContext<{
  permissions: readonly string[];
}>;

const useCanReadMedia = () =>
  useOutletContext<MediaReadContext>()?.currentUser.permissions.includes(
    "media.read",
  ) ?? false;

const MediaPicker = ({
  context,
  disabled,
  id,
  kind,
  maxCount,
  multiple,
  onChange,
  onSelectImages,
  previewUrl,
  selectOnly = false,
  value,
  ...aria
}: MediaPickerProps) => {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<{
    context?: ImageFilter;
    items: (ImageRecord | VideoRecord)[];
    kind: MediaPickerProps["kind"];
    page: number;
    total: number;
  }>();
  const [loading, setLoading] = useState<boolean>();
  const [selectedMedia, setSelectedMedia] = useState<
    ImageRecord | VideoRecord
  >();
  const [page, setPage] = useState(1);
  const [requested, setRequested] = useState(false);
  const { cancel, start } = useAbortController();
  const canRead = useCanReadMedia();
  const currentCatalog =
    catalog?.kind === kind && catalog.context === context ? catalog : undefined;
  const canLoadNextPage =
    selectOnly &&
    canRead &&
    !disabled &&
    !loading &&
    currentCatalog?.page === page &&
    page * defaultPageSize < currentCatalog.total;
  const canRemoveSavedImages = multiple && !canRead && Boolean(value?.length);
  const singleSelectionPreview =
    !selectOnly && !multiple && value
      ? selectedMedia?.id === value
        ? selectedMedia.previewUrl
        : previewUrl
      : undefined;

  const fetchChoices = useCallback(async () => {
    if (!canRead || !requested) {
      setLoading(undefined);
      return;
    }

    const signal = start();
    setLoading(true);
    try {
      const response =
        kind === "image"
          ? await fetchImages({ page, context }, signal)
          : await fetchVideos({ page }, signal);
      if (signal.aborted) return;

      const nextCatalog = { ...response, context, kind, page };
      setCatalog((previous) => {
        if (
          !selectOnly ||
          previous?.page !== page - 1 ||
          previous.kind !== kind ||
          previous.context !== context
        )
          return nextCatalog;

        const items = new Map(
          [...previous.items, ...response.items].map((item) => [item.id, item]),
        );
        return { ...nextCatalog, items: [...items.values()] };
      });
      setLoading(false);
    } catch (failure) {
      if (!signal.aborted) setLoading(isCancel(failure) ? undefined : false);
    }
  }, [canRead, context, kind, page, requested, selectOnly, start]);

  useEffect(() => {
    void fetchChoices();
    return cancel;
  }, [cancel, fetchChoices]);

  return (
    <Flex gap="small" vertical>
      <Select<string | string[]>
        allowClear
        aria-label={id ? undefined : t(kind === "image" ? "images" : "videos")}
        {...aria}
        disabled={disabled || (!canRead && !canRemoveSavedImages)}
        id={id}
        loading={loading === true}
        maxCount={maxCount}
        mode={multiple ? "multiple" : undefined}
        onChange={(selected) => {
          if (multiple) {
            const selectedIds = Array.isArray(selected) ? selected : [];
            onSelectImages?.(
              currentCatalog?.items.filter(
                (item): item is ImageRecord =>
                  "context" in item && selectedIds.includes(item.id),
              ) ?? [],
            );
            onChange?.(selectedIds);
          } else {
            const selectedId = typeof selected === "string" ? selected : null;
            setSelectedMedia(
              currentCatalog?.items.find((item) => item.id === selectedId),
            );
            onChange?.(selectedId);
          }
        }}
        onOpenChange={(open) => {
          if (open && canRead) setRequested(true);
        }}
        onPopupScroll={({ currentTarget }) => {
          if (!canLoadNextPage) return;
          const { clientHeight, scrollHeight, scrollTop } = currentTarget;
          if (scrollHeight - scrollTop - clientHeight <= 32)
            setPage((current) => (current === page ? page + 1 : current));
        }}
        open={canRemoveSavedImages ? false : undefined}
        optionRender={(option) => {
          if (kind === "video") return option.label;
          const src = option.data.previewUrl;
          return (
            <Flex align="center" gap={8}>
              {multiple || selectOnly ? (
                <Avatar
                  alt=""
                  shape="square"
                  size={32}
                  src={src}
                  style={{ flexShrink: 0 }}
                />
              ) : (
                <img
                  alt=""
                  height={32}
                  loading="lazy"
                  src={src}
                  width={48}
                  style={{ objectFit: "contain" }}
                />
              )}
              <span>{option.label}</span>
            </Flex>
          );
        }}
        options={
          canRead && (selectOnly || !loading)
            ? (currentCatalog?.items ?? []).map((item) => ({
                value: item.id,
                label:
                  kind === "image"
                    ? item.id
                    : item.id +
                      " · " +
                      Math.ceil(item.sizeBytes / 1024) +
                      " KiB",
                previewUrl:
                  "context" in item
                    ? (item.thumbnailUrl ?? item.thumb ?? item.previewUrl)
                    : undefined,
              }))
            : []
        }
        showSearch={canRemoveSavedImages ? false : undefined}
        suffix={canRemoveSavedImages ? null : undefined}
        value={value ?? undefined}
      />
      {canRead &&
        requested &&
        loading === false &&
        (currentCatalog === undefined ||
          (selectOnly && currentCatalog.page !== page)) && (
          <ErrorFallback onRetry={fetchChoices} />
        )}
      {!selectOnly &&
        canRead &&
        (currentCatalog?.total ?? 0) > defaultPageSize && (
          <Pagination
            current={page}
            disabled={disabled || loading}
            onChange={setPage}
            pageSize={defaultPageSize}
            showSizeChanger={false}
            size="small"
            total={currentCatalog?.total}
          />
        )}
      {singleSelectionPreview &&
        (kind === "image" ? (
          <Image
            alt={t("mediaPreview")}
            src={singleSelectionPreview}
            width={120}
          />
        ) : (
          <video
            aria-label={t("mediaPreview")}
            controls
            preload="metadata"
            src={singleSelectionPreview}
            width={220}
          />
        ))}
    </Flex>
  );
};

export const ManagedImagePicker = (props: ImagePickerProps) => (
  <MediaPicker {...props} kind="image" />
);

export const ManagedVideoPicker = (props: SingleSelectionProps) => (
  <MediaPicker {...props} kind="video" />
);
