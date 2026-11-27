import { Button, Flex, Form, type FormProps, Input, Typography } from "antd";
import { isCancel } from "axios";
import { useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { routeTree } from "@/app/config";
import { useAntd, useCore } from "@/app/hooks";
import { login, type LoginParams } from "@/features/auth";
import { defaultLogoUrl } from "@/shared/config";
import { useAbortController, useLock } from "@/shared/hooks";
import { getErrorMessage, normalizeMobile } from "@/shared/lib";

export const LoginPage = () => {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI } = useAntd();
  const { settings, theme } = useCore();
  const { lock, unlock } = useLock();
  const navigate = useNavigate();
  const logo = settings[`${theme}Logo`]?.url ?? defaultLogoUrl;

  const handleSubmit: FormProps<LoginParams>["onFinish"] = async (values) => {
    if (!lock()) return;

    const signal = start();
    setSubmitting(true);

    try {
      await login(
        { mobile: normalizeMobile(values.mobile), password: values.password },
        signal,
      );
      if (signal.aborted) return;

      void navigate(routeTree.root.path, { replace: true });
    } catch (error) {
      if (signal.aborted || isCancel(error)) return;

      void messageAPI.error(getErrorMessage(error));
    } finally {
      if (!signal.aborted) {
        unlock();
        setSubmitting(false);
      }
    }
  };

  useLayoutEffect(() => cancel, [cancel]);

  return (
    <Flex gap={32} vertical>
      <Flex align="center" gap={8} vertical>
        <img
          alt={t("logo")}
          src={logo}
          style={{ display: "block", height: 40, width: "auto" }}
        />
        <Typography.Title level={1} style={{ fontSize: 16 }}>
          {t("login")}
        </Typography.Title>
      </Flex>
      <Form<LoginParams>
        disabled={submitting}
        layout="vertical"
        name="login-form"
        onFinish={handleSubmit}
        requiredMark={false}
        scrollToFirstError={{ focus: true }}
      >
        <Form.Item<LoginParams>
          label={t("mobile")}
          name="mobile"
          rules={[
            { required: true },
            {
              message: "Use ten digits starting with 9, without a prefix.",
              pattern: /^9[0-9]{9}$/,
              transform: normalizeMobile,
            },
          ]}
        >
          <Input
            autoComplete="username"
            inputMode="numeric"
            placeholder="9120000000"
            size="large"
            style={{ direction: "ltr" }}
          />
        </Form.Item>
        <Form.Item<LoginParams>
          label={t("password")}
          name="password"
          rules={[{ required: true, max: 128 }]}
        >
          <Input.Password
            autoComplete="current-password"
            placeholder={t("password")}
            size="large"
            styles={{ input: { direction: "ltr" } }}
          />
        </Form.Item>
        <Button
          block
          htmlType="submit"
          loading={submitting}
          size="large"
          style={{ marginTop: 32 }}
          type="primary"
        >
          {t("login")}
        </Button>
      </Form>
    </Flex>
  );
};
