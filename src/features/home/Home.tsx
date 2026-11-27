import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Flex,
  Form,
  type FormProps,
  Input,
  Row,
  Spin,
} from "antd";
import { useTranslation } from "react-i18next";

import {
  ManagedImagePicker,
  type VideoSource,
  VideoSourcePicker,
} from "@/features/files";
import { useUploadActivity } from "@/shared/hooks";
import { ErrorFallback } from "@/shared/ui/error-boundary";

import type { HomeContent, HomeInput } from "./types";
import { useHome } from "./useHome";

type HomeDraft = Omit<HomeInput, "aboutPoster" | "aboutVideo" | "heroVideo"> & {
  heroVideo: VideoSource | null;
};

const approachCount = 4;

const initialApproach = (cards: HomeContent["approach"] = []) =>
  Array.from({ length: approachCount }, (_, index) => ({
    title: cards[index]?.title ?? "",
    image: { imageId: cards[index]?.image.imageId ?? "" },
  }));

const toVideoSource = (source: HomeContent["heroVideo"]): VideoSource =>
  typeof source.id === "string" ? { id: source.id } : { url: source.url };

const initialHome = (content?: HomeContent): HomeDraft => ({
  aboutDescription: content?.aboutDescription ?? "",
  aboutSubtitle: content?.aboutSubtitle ?? "",
  aboutTitle: content?.aboutTitle ?? "",
  approach: initialApproach(content?.approach),
  heroDescription: content?.heroDescription ?? "",
  heroPoster: { imageId: content?.heroPoster.imageId ?? "" },
  heroVideo: content ? toVideoSource(content.heroVideo) : null,
  whyDescription: content?.whyDescription ?? "",
  whyImage: { imageId: content?.whyImage.imageId ?? "" },
  whySubtitle: content?.whySubtitle ?? "",
  whyTitle: content?.whyTitle ?? "",
});

export const HomePage = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm<HomeDraft>();
  const { uploading, trackUpload, hasUploads } = useUploadActivity();
  const { busy, canEdit, data, load, loading, save, submitting } = useHome();
  const content = data?.content;
  const approachCountConflict = (content?.approach.length ?? 0) > approachCount;
  const disabled = !canEdit || busy || approachCountConflict;

  const imageRules = [{ required: true, message: t("requiredField") }];
  const validateVideo = (_: unknown, value?: VideoSource | null) =>
    value?.id || value?.url
      ? Promise.resolve()
      : Promise.reject(new Error(t("requiredField")));

  const handleSubmit: FormProps<HomeDraft>["onFinish"] = async ({
    heroVideo,
    ...values
  }) => {
    if (
      approachCountConflict ||
      values.approach?.length !== approachCount ||
      !heroVideo ||
      hasUploads()
    )
      return;

    const aboutVideo = content?.aboutVideo;
    const aboutPoster = content?.aboutPoster;
    const saved = await save({
      ...values,
      heroVideo,
      aboutVideo: aboutVideo ? toVideoSource(aboutVideo) : null,
      aboutPoster: aboutPoster
        ? { imageId: aboutPoster.imageId, alt: aboutPoster.alt }
        : null,
    });
    if (saved) form.setFieldsValue(initialHome(saved.content));
  };

  if (data === undefined)
    return loading ? (
      <Spin aria-label={t("loading")} />
    ) : (
      <ErrorFallback onRetry={load} />
    );

  const imageReferences = content
    ? [
        content.heroPoster,
        ...content.approach.map(({ image }) => image),
        content.whyImage,
      ].map(({ imageId, url, thumb }) => ({ id: imageId, url, thumb }))
    : undefined;

  return (
    <Row>
      <Col lg={12} xl={8} xs={24} xxl={6}>
        <Flex gap={12} vertical>
          <Form<HomeDraft>
            disabled={disabled}
            form={form}
            initialValues={initialHome(content)}
            layout="vertical"
            name="home-form"
            onFinish={handleSubmit}
            scrollToFirstError={{ focus: true }}
          >
            <Flex gap={12} vertical>
              <Card
                aria-label={t("hero")}
                role="group"
                size="small"
                title={t("hero")}
              >
                <Form.Item<HomeDraft>
                  label={t("description")}
                  name="heroDescription"
                  rules={[{ required: true, whitespace: true, max: 10_000 }]}
                >
                  <Input.TextArea autoSize maxLength={10_000} />
                </Form.Item>
                <Form.Item<HomeDraft>
                  label={t("video")}
                  name="heroVideo"
                  required
                  rules={[{ validator: validateVideo }]}
                >
                  <VideoSourcePicker
                    disabled={disabled}
                    label={t("video")}
                    onLoadingChange={(active) =>
                      trackUpload("heroVideo", active)
                    }
                    selectOnly
                    videoReference={content?.heroVideo}
                  />
                </Form.Item>
                <Form.Item<HomeDraft>
                  label={t("poster")}
                  name={["heroPoster", "imageId"]}
                  rules={imageRules}
                >
                  <ManagedImagePicker
                    context="content"
                    disabled={disabled}
                    fullImagePreview
                    imageReferences={imageReferences}
                    label={t("poster")}
                    onLoadingChange={(active) =>
                      trackUpload("heroPoster", active)
                    }
                  />
                </Form.Item>
              </Card>

              <Card size="small" title={t("about")}>
                <Form.Item<HomeDraft>
                  label={t("title")}
                  name="aboutTitle"
                  rules={[{ required: true, whitespace: true, max: 200 }]}
                >
                  <Input maxLength={200} />
                </Form.Item>
                <Form.Item<HomeDraft>
                  label={t("subtitle")}
                  name="aboutSubtitle"
                >
                  <Input maxLength={1000} />
                </Form.Item>
                <Form.Item<HomeDraft>
                  label={t("description")}
                  name="aboutDescription"
                  rules={[{ required: true, whitespace: true, max: 10_000 }]}
                >
                  <Input.TextArea autoSize maxLength={10_000} />
                </Form.Item>
              </Card>

              <Card
                aria-label={t("approach")}
                role="group"
                size="small"
                title={t("approach")}
              >
                {approachCountConflict && (
                  <Alert
                    showIcon
                    title={t("homeApproachCountConflict")}
                    type="warning"
                  />
                )}
                <Form.List name="approach">
                  {(cards) =>
                    cards.map(({ key, name }, index) => (
                      <div
                        aria-label={`${t("approach")} ${index + 1}`}
                        key={key}
                        role="group"
                      >
                        {index > 0 && <Divider />}
                        <Form.Item<HomeDraft["approach"]>
                          label={t("title")}
                          name={[name, "title"]}
                          rules={[
                            { required: true, whitespace: true, max: 200 },
                          ]}
                        >
                          <Input maxLength={200} />
                        </Form.Item>
                        <Form.Item<HomeDraft["approach"]>
                          label={t("images")}
                          name={[name, "image", "imageId"]}
                          rules={imageRules}
                        >
                          <ManagedImagePicker
                            context="approach"
                            disabled={disabled}
                            imageReferences={imageReferences}
                            label={t("image")}
                            onLoadingChange={(active) =>
                              trackUpload(`approach-${key}`, active)
                            }
                          />
                        </Form.Item>
                      </div>
                    ))
                  }
                </Form.List>
              </Card>

              <Card
                aria-label={t("why")}
                role="group"
                size="small"
                title={t("why")}
              >
                <Form.Item<HomeDraft>
                  label={t("title")}
                  name="whyTitle"
                  rules={[{ required: true, whitespace: true, max: 200 }]}
                >
                  <Input maxLength={200} />
                </Form.Item>
                <Form.Item<HomeDraft> label={t("subtitle")} name="whySubtitle">
                  <Input maxLength={1000} />
                </Form.Item>
                <Form.Item<HomeDraft>
                  label={t("description")}
                  name="whyDescription"
                  rules={[{ required: true, whitespace: true, max: 10_000 }]}
                >
                  <Input.TextArea autoSize maxLength={10_000} />
                </Form.Item>
                <Form.Item<HomeDraft>
                  label={t("images")}
                  name={["whyImage", "imageId"]}
                  rules={imageRules}
                >
                  <ManagedImagePicker
                    context="project"
                    disabled={disabled}
                    fullImagePreview
                    imageReferences={imageReferences}
                    label={t("image")}
                    onLoadingChange={(active) =>
                      trackUpload("whyImage", active)
                    }
                  />
                </Form.Item>
              </Card>

              {canEdit && (
                <Button
                  disabled={uploading || approachCountConflict}
                  htmlType="submit"
                  loading={submitting}
                  type="primary"
                >
                  {t("submit")}
                </Button>
              )}
            </Flex>
          </Form>
        </Flex>
      </Col>
    </Row>
  );
};
