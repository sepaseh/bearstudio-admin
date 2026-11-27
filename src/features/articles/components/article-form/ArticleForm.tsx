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

import { useAntd, useCore } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import { ManagedImagePicker } from "@/features/files";
import type { DefaultLayoutContext } from "@/layouts/default";
import { modalKeys } from "@/shared/config";
import { useAbortController, useLock, useUploadActivity } from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";
import { ErrorFallback } from "@/shared/ui/error-boundary";
import { RichTextEditor } from "@/shared/ui/rich-text-editor";

import { createArticle, fetchArticle, updateArticle } from "../../api";
import type { Article, ArticleRequest } from "../../types";

type CategoryOption = { name: string; slug: string };
type ArticleFormValues = Omit<ArticleRequest, "cover"> & {
  cover: { id: string | null };
};

type ArticleFormProps = {
  busy?: boolean;
  id?: string;
  onClose: () => void;
  onFinish: () => void;
  options: { categories: CategoryOption[] };
};

const trimText = (value?: string) => value?.trim();
const normalizeSlug = (value?: string) => value?.trim().toLowerCase();

export const ArticleForm = ({
  busy = false,
  id,
  onClose,
  onFinish,
  options: { categories },
}: ArticleFormProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<ArticleFormValues>();
  const [data, setData] = useState<Article>();
  const [loading, setLoading] = useState<boolean>();
  const [shown, setShown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI } = useAntd();
  const { settings } = useCore();
  const { hash, key } = useLocation();
  const { lock, unlock } = useLock();
  const { uploading, trackUpload, hasUploads } = useUploadActivity();
  const { currentUser } =
    useOutletContext<
      DefaultLayoutContext<{ permissions: readonly string[] }>
    >();
  const { canCreate, canUpdate } = getRoutePermissions("articles", currentUser);
  const isCreate = hash === modalKeys.create;
  const isUpdate = hash === modalKeys.update;
  const open = (isCreate && canCreate) || (isUpdate && canUpdate);
  const ready = !isUpdate || (data !== undefined && data.id === id);
  const showLoadFallback = open && !ready && loading === false;
  const disabled = !shown || !ready || submitting;
  const canSubmit = open && !busy && !disabled;

  const handleClose = () => {
    if (submitting) return;

    cancel();
    onClose();
  };

  const handleSubmit: FormProps<ArticleFormValues>["onFinish"] = async ({
    body,
    category,
    cover,
    excerpt,
    slug,
    title,
  }) => {
    const coverId = cover?.id;
    if (!canSubmit || !coverId || hasUploads() || !lock()) return;

    const signal = start();
    setSubmitting(true);

    try {
      const metadata = {
        title: title.trim(),
        slug: slug.trim().toLowerCase(),
        excerpt: excerpt.trim(),
        category,
        cover: { id: coverId },
      };
      if (isUpdate && data) {
        const changes = body === data.body ? metadata : { ...metadata, body };
        await updateArticle(data.id, changes, signal);
      } else {
        await createArticle({ ...metadata, body }, signal);
      }
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
    if (id === undefined) return;

    const signal = start();
    setData(undefined);
    setLoading(true);

    try {
      const article = await fetchArticle(id, signal);
      if (signal.aborted) return;
      if (article.id === id) setData(article);
      setLoading(false);
    } catch (error) {
      if (!signal.aborted) setLoading(isCancel(error) ? undefined : false);
    }
  }, [id, start]);

  useLayoutEffect(() => {
    setData(undefined);
    setLoading(undefined);
    if (!open) setShown(false);
    return cancel;
  }, [cancel, id, isCreate, isUpdate, key, open]);

  useLayoutEffect(() => {
    if (!open || !shown || !ready) return;

    form.resetFields();
    if (isUpdate && data) {
      form.setFieldsValue({
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        body: data.body,
        category: { slug: data.category.slug },
        cover: { id: data.cover.id },
      });
    }
    const frame = requestAnimationFrame(() => form.focusField("title"));
    return () => cancelAnimationFrame(frame);
  }, [data, form, isUpdate, key, open, ready, shown]);

  useEffect(() => {
    setSubmitting(false);
    unlock();

    if (open && isUpdate && id !== undefined) {
      void load();
      return;
    }

    if (isUpdate || (isCreate && !open)) onClose();
  }, [id, isCreate, isUpdate, key, load, onClose, open, unlock]);

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
      <Form<ArticleFormValues>
        disabled={disabled}
        form={form}
        hidden={open && (!shown || !ready)}
        layout="vertical"
        name="article-form"
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
              pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label={t("category")}
          name={["category", "slug"]}
          rules={[{ required: true }]}
        >
          <Select
            options={categories.map(({ name, slug }) => ({
              label: name,
              value: slug,
            }))}
          />
        </Form.Item>
        <Form.Item
          label={t("excerpt")}
          name="excerpt"
          rules={[{ required: true, transform: trimText, max: 1000 }]}
        >
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
        </Form.Item>
        {open && (
          <Form.Item
            label={t("coverImage")}
            name={["cover", "id"]}
            rules={[{ required: true }]}
          >
            <ManagedImagePicker
              context="article"
              disabled={disabled}
              imageReferences={data?.cover.id ? [data.cover] : undefined}
              label={t("coverImage")}
              onLoadingChange={(active) => trackUpload("cover", active)}
              selectOnly
            />
          </Form.Item>
        )}
        <Form.Item
          label={t("body")}
          name="body"
          getValueFromEvent={(
            html: string,
            _changes: unknown,
            source: string,
          ) => (source === "user" ? html : form.getFieldValue("body"))}
          rules={[
            { max: 100_000 },
            {
              required: true,
              validator: (_, value: string | undefined) => {
                const document = new DOMParser().parseFromString(
                  value ?? "",
                  "text/html",
                );
                document
                  .querySelectorAll("script, style")
                  .forEach((node) => node.remove());
                const text = document.body.textContent?.replace(
                  /[\s\u200b-\u200f\ufeff]/g,
                  "",
                );
                return text
                  ? Promise.resolve()
                  : Promise.reject(new Error(t("bodyRequired")));
              },
            },
          ]}
        >
          <RichTextEditor
            direction={settings.language.direction}
            disabled={disabled}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
};
