import { Card, Col, ColorPicker, Divider, Form, InputNumber, Row } from "antd";
import { useTranslation } from "react-i18next";

import { useAntd } from "@/app/hooks";
import { ManagedImagePicker } from "@/features/files";
import { defaultLogoUrl } from "@/shared/config";
import { themeColorFields } from "@/shared/contracts";

import type { AdminSettings, AdminSettingsInput } from "./types";

type AppearanceFieldsProps = {
  disabled: boolean;
  logos: Pick<AdminSettings, "lightLogo" | "darkLogo">;
  onLogoLoadingChange: (theme: "light" | "dark", active: boolean) => void;
};

export const AppearanceFields = ({
  disabled,
  logos,
  onLogoLoadingChange,
}: AppearanceFieldsProps) => {
  const { t } = useTranslation();
  const { token } = useAntd();
  const logoReferences = [logos.lightLogo, logos.darkLogo].filter(
    (logo) => logo !== null,
  );

  return (
    <>
      <Card size="small" title={t("appearance")}>
        <Row gutter={[16, 16]}>
          {(["light", "dark"] as const).map((theme) => (
            <Col key={theme} lg={12} xs={24}>
              <Divider titlePlacement="start">
                {t(theme === "light" ? "lightMode" : "darkMode")}
              </Divider>
              <Form.Item<AdminSettingsInput>
                label={t(theme === "light" ? "lightLogo" : "darkLogo")}
                name={theme === "light" ? "lightLogoId" : "darkLogoId"}
              >
                <ManagedImagePicker
                  context="logo"
                  disabled={disabled}
                  fallbackUrl={defaultLogoUrl}
                  imageReferences={logoReferences}
                  label={t(theme === "light" ? "lightLogo" : "darkLogo")}
                  onLoadingChange={(active) =>
                    onLogoLoadingChange(theme, active)
                  }
                />
              </Form.Item>
              {themeColorFields.map((field) => (
                <Form.Item<AdminSettingsInput>
                  getValueFromEvent={(color) => color.toHexString()}
                  key={field}
                  label={t(field)}
                  name={[theme === "light" ? "lightTheme" : "darkTheme", field]}
                  rules={[
                    {
                      validator: (_, value: unknown) =>
                        typeof value === "string" &&
                        /^#[0-9a-f]{6}$/i.test(value)
                          ? Promise.resolve()
                          : Promise.reject(new Error(t("requiredField"))),
                    },
                  ]}
                >
                  <ColorPicker
                    disabledAlpha
                    format="hex"
                    showText
                    style={{ width: "100%" }}
                    styles={{ description: { color: token.colorText } }}
                  />
                </Form.Item>
              ))}
            </Col>
          ))}
        </Row>
      </Card>
      <Card size="small" title={t("imageProfiles")}>
        {(
          [
            ["article", "article"],
            ["content", "content"],
            ["project", "project"],
            ["service", "service"],
            ["logo", "logo"],
            ["video", "video"],
          ] as const
        ).map(([profile, label]) => (
          <div aria-label={t(label)} key={profile} role="group">
            <Divider titlePlacement="start">{t(label)}</Divider>
            <Row gutter={16}>
              {(
                [
                  ["width", "imageWidth", 1, 8192],
                  ["height", "imageHeight", 1, 8192],
                  ["size", "imageMaxBytes", 1024, 10_485_760],
                ] as const
              ).map(([field, key, min, max]) => (
                <Col key={field} md={8} xs={24}>
                  <Form.Item<AdminSettingsInput>
                    dependencies={
                      field === "height"
                        ? [["profiles", profile, "width"]]
                        : undefined
                    }
                    label={t(key)}
                    name={["profiles", profile, field]}
                    rules={[
                      { max, min, required: true, type: "integer" },
                      ({ getFieldValue }) => ({
                        validator(_, value: number | null) {
                          if (field !== "height" || value == null)
                            return Promise.resolve();

                          const width = getFieldValue([
                            "profiles",
                            profile,
                            "width",
                          ]);
                          if (typeof width !== "number")
                            return Promise.resolve();
                          if (profile === "content" && width <= value)
                            return Promise.reject(
                              new Error(t("imageLandscapeRequired")),
                            );
                          return width * value > 16_000_000
                            ? Promise.reject(new Error(t("imagePixelLimit")))
                            : Promise.resolve();
                        },
                      }),
                    ]}
                  >
                    <InputNumber
                      max={max}
                      min={min}
                      precision={0}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </div>
        ))}
        <div aria-label={t("imageThumbnail")} role="group">
          <Divider titlePlacement="start">{t("imageThumbnail")}</Divider>
          <Row gutter={16}>
            {(
              [
                ["width", "imageWidth"],
                ["height", "imageHeight"],
              ] as const
            ).map(([dimension, label]) => (
              <Col key={dimension} md={8} xs={24}>
                <Form.Item<AdminSettingsInput>
                  label={t(label)}
                  name={["profiles", "thumbnail", dimension]}
                  rules={[
                    { max: 1024, min: 1, required: true, type: "integer" },
                  ]}
                >
                  <InputNumber
                    max={1024}
                    min={1}
                    precision={0}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              </Col>
            ))}
          </Row>
        </div>
      </Card>
    </>
  );
};
