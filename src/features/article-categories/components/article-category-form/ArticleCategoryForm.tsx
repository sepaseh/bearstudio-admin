import { Button, Drawer, Form, type FormProps, Input, Space } from "antd";
import { isCancel } from "axios";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useOutletContext } from "react-router";

import { useAntd } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import type { DefaultLayoutContext } from "@/layouts/default";
import { modalKeys } from "@/shared/config";
import { useAbortController, useLock } from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";
import { ErrorFallback } from "@/shared/ui/error-boundary";

import {
  createArticleCategory,
  fetchArticleCategory,
  updateArticleCategory,
} from "../../api";
import type { ArticleCategory, ArticleCategoryRequest } from "../../types";

type ArticleCategoryFormProps = {
  busy?: boolean;
  slug?: string;
  onClose: () => void;
  onFinish: () => void;
};

const trimText = (value?: string) => value?.trim();
const normalizeSlug = (value?: string) => value?.trim().toLowerCase();

export const ArticleCategoryForm = ({
  busy = false,
  slug,
  onClose,
  onFinish,
}: ArticleCategoryFormProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<ArticleCategoryRequest>();
  const [data, setData] = useState<ArticleCategory>();
  const [loading, setLoading] = useState<boolean>();
  const [shown, setShown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI } = useAntd();
  const { hash, key } = useLocation();
  const { lock, unlock } = useLock();
  const { currentUser } =
    useOutletContext<
      DefaultLayoutContext<{ permissions: readonly string[] }>
    >();
  const { canCreate, canUpdate } = getRoutePermissions(
    "articleCategories",
    currentUser,
  );
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

  const handleSubmit: FormProps<ArticleCategoryRequest>["onFinish"] = async ({
    name,
    slug,
  }) => {
    if (!canSubmit || !lock()) return;

    const signal = start();
    setSubmitting(true);

    try {
      const input = {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
      };
      if (isUpdate && data)
        await updateArticleCategory(data.slug, input, signal);
      else await createArticleCategory(input, signal);
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
      const category = await fetchArticleCategory(slug, signal);
      if (signal.aborted) return;
      if (category.slug === slug) setData(category);
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
      form.setFieldsValue({ name: data.name, slug: data.slug });
    }
    const frame = requestAnimationFrame(() => form.focusField("name"));
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
            disabled={!canSubmit}
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
      styles={{ footer: { textAlign: "end" } }}
      title={t(isUpdate ? "update" : "create")}
    >
      {showLoadFallback && <ErrorFallback onRetry={load} />}
      <Form<ArticleCategoryRequest>
        disabled={disabled}
        form={form}
        hidden={open && (!shown || !ready)}
        layout="vertical"
        name="article-category-form"
        onFinish={handleSubmit}
        scrollToFirstError={{ focus: true }}
      >
        <Form.Item
          label={t("name")}
          name="name"
          rules={[{ required: true, transform: trimText, max: 120 }]}
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
      </Form>
    </Drawer>
  );
};
