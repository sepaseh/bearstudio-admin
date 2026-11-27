import {
  Button,
  Drawer,
  Form,
  type FormProps,
  Input,
  Select,
  Space,
} from "antd";
import { isCancel } from "axios";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useOutletContext } from "react-router";

import { useAntd } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import { ManagedImagePicker } from "@/features/files";
import type { DefaultLayoutContext } from "@/layouts/default";
import { modalKeys } from "@/shared/config";
import { useAbortController, useLock, useUploadActivity } from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";
import { ErrorFallback } from "@/shared/ui/error-boundary";

import { createService, fetchService, updateService } from "../../api";
import type { ServiceGroup, ServiceRequest } from "../../types";

type TagSelection = { label: string; value: string | number };

type ServiceFormProps = {
  busy?: boolean;
  slug?: string;
  onClose: () => void;
  onFinish: () => void;
};

const trimText = (value?: string) => value?.trim();
const normalizeSlug = (value?: string) => value?.trim().toLowerCase();
const maximumImages = 3;
const maximumTags = 20;

const getTagPickerValue = (tags: string[] = []) => {
  const seen = new Set<string>();
  return {
    value: tags.map((label, index) => {
      // Give repeated saved tags separate identities without reserving any text values.
      const value = seen.has(label) ? index : label;
      seen.add(label);
      return { label, value };
    }),
  };
};

const normalizeTags = (tags: TagSelection[], previousTags: string[] = []) =>
  tags
    .map(({ value }) =>
      typeof value === "number" ? previousTags[value] : value.trim(),
    )
    .filter(Boolean);

export const ServiceForm = ({
  busy = false,
  slug,
  onClose,
  onFinish,
}: ServiceFormProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<ServiceRequest>();
  const [data, setData] = useState<ServiceGroup>();
  const [loading, setLoading] = useState<boolean>();
  const [shown, setShown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI } = useAntd();
  const { hash, key } = useLocation();
  const { lock, unlock } = useLock();
  const { uploading, trackUpload, hasUploads } = useUploadActivity();
  const { currentUser } =
    useOutletContext<
      DefaultLayoutContext<{ permissions: readonly string[] }>
    >();
  const { canCreate, canUpdate } = getRoutePermissions("services", currentUser);
  const isCreate = hash === modalKeys.create;
  const isUpdate = hash === modalKeys.update;
  const open = (isCreate && canCreate) || (isUpdate && canUpdate);
  const ready = !isUpdate || (data !== undefined && data.slug === slug);
  const showLoadFallback = open && !ready && loading === false;
  const disabled = !shown || !ready || submitting;
  const canSubmit = open && !busy && !disabled;

  const handleClose = () => {
    if (submitting) return;

    cancel();
    onClose();
  };

  const handleSubmit: FormProps<ServiceRequest>["onFinish"] = async ({
    description,
    imageIds,
    slug,
    tags,
    title,
  }) => {
    if (!canSubmit || hasUploads() || !lock()) return;

    const signal = start();
    setSubmitting(true);

    try {
      const input = {
        title: title.trim(),
        slug: slug.trim().toLowerCase(),
        description: description.trim(),
        tags: tags.map((value) => value.trim()),
        imageIds,
      };
      if (isUpdate && data) await updateService(data.slug, input, signal);
      else await createService(input, signal);
      if (signal.aborted) return;

      void messageAPI.success(t("contentSaved"));
      onFinish();
    } catch (error) {
      if (signal.aborted || isCancel(error)) return;

      void messageAPI.error(getErrorMessage(error));
    } finally {
      if (!signal.aborted) {
        setSubmitting(false);
        unlock();
      }
    }
  };

  const load = useCallback(async () => {
    if (slug === undefined) return;

    const signal = start();
    setData(undefined);
    setLoading(true);

    try {
      const service = await fetchService(slug, signal);
      if (signal.aborted) return;
      if (service.slug === slug) setData(service);
      setLoading(false);
    } catch (error) {
      if (!signal.aborted) setLoading(isCancel(error) ? undefined : false);
    }
  }, [slug, start]);

  useLayoutEffect(() => {
    setData(undefined);
    setLoading(undefined);
    if (!open) setShown(false);
    return cancel;
  }, [cancel, isCreate, isUpdate, key, open, slug]);

  useLayoutEffect(() => {
    if (!open || !shown || !ready) return;

    form.resetFields();
    if (isUpdate && data) {
      form.setFieldsValue({
        title: data.title,
        slug: data.slug,
        description: data.description,
        tags: data.tags,
        imageIds: data.images.map(({ id }) => id),
      });
    }
    const frame = requestAnimationFrame(() => form.focusField("title"));
    return () => cancelAnimationFrame(frame);
  }, [data, form, isUpdate, key, open, ready, shown]);

  useEffect(() => {
    setSubmitting(false);
    unlock();

    if (open && isUpdate && slug !== undefined) {
      void load();
      return;
    }

    if (isUpdate || (isCreate && !open)) onClose();
  }, [isCreate, isUpdate, key, load, onClose, open, slug, unlock]);

  return (
    <Drawer
      afterOpenChange={setShown}
      closeIcon={false}
      footer={
        <Space>
          <Button loading={submitting} onClick={handleClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!canSubmit || uploading}
            loading={submitting}
            onClick={() => form.submit()}
            type="primary"
          >
            {t("submit")}
          </Button>
        </Space>
      }
      keyboard={!submitting}
      loading={open && isUpdate && (!shown || loading === true)}
      mask={{ closable: false }}
      onClose={handleClose}
      open={open}
      size="large"
      styles={{ footer: { textAlign: "end" } }}
      title={t(isUpdate ? "update" : "create")}
    >
      {showLoadFallback && <ErrorFallback onRetry={load} />}
      <Form<ServiceRequest>
        disabled={disabled}
        form={form}
        hidden={open && (!shown || !ready)}
        initialValues={{
          imageIds: [],
          tags: [],
        }}
        layout="vertical"
        name="service-form"
        onFinish={handleSubmit}
        scrollToFirstError={{ focus: true }}
      >
        <Form.Item
          label={t("title")}
          name="title"
          rules={[{ required: true, transform: trimText, max: 200 }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label={t("slug")}
          name="slug"
          rules={[
            {
              required: true,
              transform: normalizeSlug,
              max: 160,
              pattern: /^(?!sort$)[a-z0-9]+(?:-[a-z0-9]+)*$/,
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label={t("description")}
          name="description"
          rules={[{ required: true, transform: trimText, max: 5000 }]}
        >
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
        </Form.Item>
        <Form.Item
          getValueProps={getTagPickerValue}
          label={t("serviceTags")}
          name="tags"
          normalize={normalizeTags}
          rules={[
            {
              type: "array",
              max: maximumTags,
              defaultField: { type: "string", required: true, max: 80 },
            },
          ]}
        >
          <Select<TagSelection[]>
            labelInValue
            maxCount={maximumTags}
            mode="tags"
            open={false}
            suffix={null}
          />
        </Form.Item>
        {open && (
          <Form.Item
            label={t("images")}
            name="imageIds"
            rules={[{ type: "array", max: maximumImages }]}
          >
            <ManagedImagePicker
              context="service"
              disabled={disabled}
              imageReferences={data?.images}
              label={t("images")}
              maxCount={maximumImages}
              multiple
              onLoadingChange={(active) => trackUpload("images", active)}
            />
          </Form.Item>
        )}
      </Form>
    </Drawer>
  );
};
