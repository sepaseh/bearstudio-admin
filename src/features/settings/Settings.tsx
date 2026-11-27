import { Button, Col, Flex, Form, type FormProps, Row, Spin } from "antd";
import { isCancel } from "axios";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOutletContext } from "react-router";

import { useAntd, useCore } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import type { DefaultLayoutContext } from "@/layouts/default";
import { useAbortController, useLock, useUploadActivity } from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";
import { ErrorFallback } from "@/shared/ui/error-boundary";

import { fetchAdminSettings, saveAdminSettings } from "./api";
import { AppearanceFields } from "./AppearanceFields";
import { SiteFields } from "./SiteFields";
import type {
  AdminSettings,
  AdminSettingsInput,
  SiteInformation,
} from "./types";

const toForm = ({
  site,
  lightTheme,
  darkTheme,
  profiles,
  lightLogoId,
  darkLogoId,
}: AdminSettings): AdminSettingsInput =>
  structuredClone({
    site,
    lightTheme,
    darkTheme,
    profiles,
    lightLogoId,
    darkLogoId,
  });

const toSiteInput = (
  site: Omit<SiteInformation, "contact">,
  contact: SiteInformation["contact"],
): SiteInformation => ({
  brandName: site.brandName,
  description: site.description,
  contactTitle: site.contactTitle,
  contactDescription: site.contactDescription,
  contactEmail: site.contactEmail?.trim() || null,
  socialLinks: site.socialLinks ?? [],
  contact,
});

export const SettingsPage = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm<AdminSettingsInput>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AdminSettings>();
  const [submitting, setSubmitting] = useState(false);
  const { messageAPI } = useAntd();
  const { setAppearance } = useCore();
  const { cancel, start } = useAbortController();
  const { lock, unlock } = useLock();
  const { uploading, trackUpload, hasUploads } = useUploadActivity();
  const { currentUser } =
    useOutletContext<
      DefaultLayoutContext<{ permissions: readonly string[] }>
    >();
  const { canUpdate } = getRoutePermissions("settings", currentUser);
  const disabled = !canUpdate || loading || submitting;

  const load = useCallback(async () => {
    const signal = start();
    setLoading(true);
    try {
      const value = await fetchAdminSettings(signal);
      if (signal.aborted) return;

      setData(value);
    } catch (failure) {
      if (signal.aborted || isCancel(failure)) return;
    }

    setLoading(false);
  }, [start]);

  const save: FormProps<AdminSettingsInput>["onFinish"] = async ({
    darkLogoId,
    lightLogoId,
    site,
    ...values
  }) => {
    if (!data || disabled || hasUploads() || !lock()) return;

    const signal = start();
    setSubmitting(true);
    try {
      const saved = await saveAdminSettings(
        {
          ...values,
          darkLogoId: darkLogoId ?? null,
          lightLogoId: lightLogoId ?? null,
          site: toSiteInput(site, data.site.contact),
        },
        signal,
      );
      if (signal.aborted) return;

      setData(saved);
      setAppearance(saved);
      form.setFieldsValue(toForm(saved));
      void messageAPI.success(t("settingsUpdated"));
    } catch (failure) {
      if (!signal.aborted && !isCancel(failure))
        void messageAPI.error(getErrorMessage(failure));
    } finally {
      if (!signal.aborted) setSubmitting(false);
      unlock();
    }
  };

  useEffect(() => {
    void load();
    return cancel;
  }, [cancel, load]);

  return (
    <Row>
      <Col lg={18} xl={16} xs={24} xxl={12}>
        {data === undefined ? (
          loading ? (
            <Spin aria-label={t("loading")} />
          ) : (
            <ErrorFallback onRetry={load} />
          )
        ) : (
          <Form<AdminSettingsInput>
            disabled={disabled}
            form={form}
            initialValues={toForm(data)}
            layout="vertical"
            name="settings-form"
            onFinish={save}
            scrollToFirstError={{ focus: true }}
          >
            <Flex gap={12} vertical>
              <AppearanceFields
                disabled={disabled}
                logos={data}
                onLogoLoadingChange={trackUpload}
              />
              <SiteFields disabled={disabled} />
              {canUpdate && (
                <Flex gap={8} justify="flex-end">
                  <Button
                    disabled={disabled || uploading}
                    onClick={() => form.resetFields()}
                  >
                    {t("reset")}
                  </Button>
                  <Button
                    disabled={uploading}
                    htmlType="submit"
                    loading={submitting}
                    type="primary"
                  >
                    {t("submit")}
                  </Button>
                </Flex>
              )}
            </Flex>
          </Form>
        )}
      </Col>
    </Row>
  );
};
