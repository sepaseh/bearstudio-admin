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

import { createFaq, fetchFaq, updateFaq } from "../../api";
import type { Faq, FaqRequest } from "../../types";

type FaqFormProps = {
  busy?: boolean;
  id?: Faq["id"];
  onClose: () => void;
  onFinish: () => void;
};

const trimText = (value?: string) => value?.trim();

export const FaqForm = ({
  busy = false,
  id,
  onClose,
  onFinish,
}: FaqFormProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<FaqRequest>();
  const [data, setData] = useState<Faq>();
  const [loading, setLoading] = useState(false);
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
  const { canCreate, canUpdate } = getRoutePermissions("faqs", currentUser);
  const isCreate = hash === modalKeys.create;
  const isUpdate = hash === modalKeys.update;
  const open = (isCreate && canCreate) || (isUpdate && canUpdate);
  const ready = !isUpdate || (data !== undefined && data.id === id);
  const disabled = !shown || !ready || loading || submitting;
  const canSubmit = open && !busy && !disabled;

  const handleClose = () => {
    if (submitting) return;

    cancel();
    onClose();
  };

  const handleSubmit: FormProps<FaqRequest>["onFinish"] = async ({
    answer,
    question,
  }) => {
    if (!canSubmit || !lock()) return;

    const signal = start();
    setSubmitting(true);

    try {
      const input = {
        question: question.trim(),
        answer: answer.trim(),
      };
      if (isUpdate && data) await updateFaq(data.id, input, signal);
      else await createFaq(input, signal);
      if (signal.aborted) return;

      void messageAPI.success(t("contentSaved"));
      onFinish();
    } catch (error) {
      if (signal.aborted || isCancel(error)) return;

      if (error instanceof Error) void messageAPI.error(error.message);
    } finally {
      if (!signal.aborted) {
        unlock();
        setSubmitting(false);
      }
    }
  };

  const load = useCallback(async () => {
    if (id === undefined) return;

    const signal = start();
    setData(undefined);
    setLoading(true);

    try {
      const faq = await fetchFaq(id, signal);
      if (signal.aborted) return;
      if (faq.id === id) setData(faq);
    } catch (error) {
      if (signal.aborted || isCancel(error)) return;

      if (error instanceof Error) void messageAPI.error(error.message);
      onClose();
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [id, messageAPI, onClose, start]);

  useLayoutEffect(() => {
    setData(undefined);
    setLoading(false);
    if (!open) setShown(false);
    return cancel;
  }, [cancel, id, isCreate, isUpdate, key, open]);

  useLayoutEffect(() => {
    if (!open || !shown || !ready) return;

    form.resetFields();
    if (isUpdate && data) {
      form.setFieldsValue({ question: data.question, answer: data.answer });
    }
    const frame = requestAnimationFrame(() => form.focusField("question"));
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
      loading={open && isUpdate && (!shown || loading)}
      mask={{ closable: false }}
      onClose={handleClose}
      open={open}
      size={640}
      styles={{ footer: { textAlign: "end" } }}
      title={t(isUpdate ? "update" : "create")}
    >
      <Form<FaqRequest>
        disabled={disabled}
        form={form}
        hidden={open && (!shown || !ready)}
        layout="vertical"
        name="faq-form"
        onFinish={handleSubmit}
      >
        <Form.Item<FaqRequest>
          label={t("question")}
          name="question"
          rules={[{ required: true, transform: trimText, max: 300 }]}
        >
          <Input />
        </Form.Item>
        <Form.Item<FaqRequest>
          label={t("answer")}
          name="answer"
          rules={[{ required: true, transform: trimText, max: 5000 }]}
        >
          <Input.TextArea autoSize={{ minRows: 6, maxRows: 14 }} />
        </Form.Item>
      </Form>
    </Drawer>
  );
};
