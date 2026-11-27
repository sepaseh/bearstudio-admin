import { Button, Card, Col, Flex, Form, Input, Row } from "antd";
import { useTranslation } from "react-i18next";

import type { AdminSettingsInput } from "./types";

type SiteFieldsProps = { disabled: boolean };

export const SiteFields = ({ disabled }: SiteFieldsProps) => {
  const { t } = useTranslation();

  return (
    <>
      <Card size="small" title={t("siteInformation")}>
        <Form.Item<AdminSettingsInput>
          label={t("brandName")}
          name={["site", "brandName"]}
          rules={[{ required: true, whitespace: true, max: 500 }]}
        >
          <Input maxLength={500} />
        </Form.Item>
        <Form.Item<AdminSettingsInput>
          label={t("description")}
          name={["site", "description"]}
        >
          <Input.TextArea autoSize maxLength={10_000} />
        </Form.Item>
      </Card>
      <Card size="small" title={t("contactInformation")}>
        <Form.Item<AdminSettingsInput>
          label={t("contactEmail")}
          name={["site", "contactEmail"]}
        >
          <Input inputMode="email" maxLength={254} />
        </Form.Item>
        <Form.Item<AdminSettingsInput>
          label={t("contactTitle")}
          name={["site", "contactTitle"]}
        >
          <Input maxLength={500} />
        </Form.Item>
        <Form.Item<AdminSettingsInput>
          label={t("contactDescription")}
          name={["site", "contactDescription"]}
        >
          <Input.TextArea autoSize maxLength={10_000} />
        </Form.Item>
      </Card>
      <Card size="small" title={t("socialLinks")}>
        <Form.List name={["site", "socialLinks"]}>
          {(links, { add, remove }) => (
            <Flex align="start" gap={12} vertical>
              {links.map(({ key, name }) => (
                <Row
                  align="middle"
                  gutter={12}
                  key={key}
                  style={{ width: "100%" }}
                >
                  <Col md={8} xs={24}>
                    <Form.Item<AdminSettingsInput["site"]["socialLinks"]>
                      label={t("linkLabel")}
                      name={[name, "label"]}
                      rules={[{ required: true, whitespace: true, max: 120 }]}
                    >
                      <Input maxLength={120} />
                    </Form.Item>
                  </Col>
                  <Col md={12} xs={24}>
                    <Form.Item<AdminSettingsInput["site"]["socialLinks"]>
                      label={t("linkUrl")}
                      name={[name, "url"]}
                      rules={[{ required: true, whitespace: true, max: 2048 }]}
                    >
                      <Input maxLength={2048} type="url" />
                    </Form.Item>
                  </Col>
                  {!disabled && (
                    <Col md={4} xs={24}>
                      <Button onClick={() => remove(name)}>
                        {t("remove")}
                      </Button>
                    </Col>
                  )}
                </Row>
              ))}
              {!disabled && (
                <Button
                  disabled={links.length >= 20}
                  onClick={() => add({ label: "", url: "" })}
                >
                  {t("create")}
                </Button>
              )}
            </Flex>
          )}
        </Form.List>
      </Card>
    </>
  );
};
