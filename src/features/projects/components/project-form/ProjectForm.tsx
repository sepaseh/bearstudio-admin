import {
  Button,
  Checkbox,
  Drawer,
  Flex,
  Form,
  type FormProps,
  Input,
  Select,
  Space,
  Typography,
} from "antd";
import { isCancel } from "axios";
import {
  type AriaAttributes,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useOutletContext } from "react-router";

import { useAntd } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import {
  ManagedImagePicker,
  type MediaSource,
  parseHttpsAddress,
  type VideoSource,
  VideoSourcePicker,
} from "@/features/files";
import { fetchServices } from "@/features/services";
import type { DefaultLayoutContext } from "@/layouts/default";
import { modalKeys } from "@/shared/config";
import { useAbortController, useLock, useUploadActivity } from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";
import { ErrorFallback } from "@/shared/ui/error-boundary";

import { createProject, fetchProject, updateProject } from "../../api";
import type { ProjectInput, ProjectPatch, ProjectRecord } from "../../types";

type ProjectFormProps = {
  busy?: boolean;
  slug?: string;
  onClose: () => void;
  onFinish: () => void;
};

type Fields = Omit<ProjectInput, "poster" | "video" | "preview" | "watch"> & {
  poster?: MediaSource | null;
  preview?: VideoSource | null;
  video?: VideoSource | null;
  watchLabel?: string;
  watchUrl?: string;
};
type ProjectSubmission = Required<ProjectInput>;

const trim = (value?: string) => value?.trim();
const normalizeSlug = (value?: string) => trim(value)?.toLowerCase();

type PosterSourcePickerProps = AriaAttributes & {
  disabled?: boolean;
  id?: string;
  label: string;
  onChange?: (source: MediaSource | null) => void;
  onLoadingChange: (active: boolean) => void;
  reference?: ProjectRecord["poster"];
  value?: MediaSource | null;
};

const PosterSourcePicker = ({
  disabled,
  id,
  label,
  onChange,
  onLoadingChange,
  reference,
  value,
  ...aria
}: PosterSourcePickerProps) => (
  <Flex gap="small" vertical>
    <ManagedImagePicker
      {...aria}
      context="project"
      disabled={disabled}
      id={id}
      imageReferences={
        reference?.id ? [{ ...reference, id: reference.id }] : undefined
      }
      label={label}
      onChange={(selected) => onChange?.(selected ? { id: selected } : null)}
      onLoadingChange={onLoadingChange}
      selectOnly
      value={value?.id}
    />
    {value?.url && (
      <Typography.Text style={{ overflowWrap: "anywhere" }} type="secondary">
        {value.url}
      </Typography.Text>
    )}
  </Flex>
);

const formSource = (source: ProjectRecord["video"]): MediaSource | null => {
  if (source?.id) return { id: source.id };
  return source?.url ? { url: source.url } : null;
};

const toInput = (values: Fields): ProjectSubmission | undefined => {
  const { poster, preview, video } = values;
  const description = trim(values.description);
  const watchLabel = trim(values.watchLabel);
  const watchUrl = trim(values.watchUrl);
  if (!description || !poster || !preview || !video || !watchLabel || !watchUrl)
    return undefined;

  return {
    title: values.title.trim(),
    slug: values.slug.trim().toLowerCase(),
    serviceSlug: values.serviceSlug,
    isFeatured: values.isFeatured ?? false,
    description,
    poster,
    preview,
    video,
    watch: { label: watchLabel, url: watchUrl },
  };
};

const sameSource = (previous: ProjectRecord["video"], next: MediaSource) => {
  const source = formSource(previous);
  return source?.id === next.id && source?.url === next.url;
};

const toPatch = (
  previous: ProjectRecord,
  input: ProjectSubmission,
): ProjectPatch => {
  const patch: ProjectPatch = {};
  if (previous.title !== input.title) patch.title = input.title;
  if (previous.slug !== input.slug) patch.slug = input.slug;
  if (previous.service.slug !== input.serviceSlug)
    patch.serviceSlug = input.serviceSlug;
  if (previous.isFeatured !== input.isFeatured)
    patch.isFeatured = input.isFeatured;
  if (previous.description !== input.description)
    patch.description = input.description;
  if (!sameSource(previous.poster, input.poster)) patch.poster = input.poster;
  if (!sameSource(previous.video, input.video)) patch.video = input.video;
  if (!sameSource(previous.preview, input.preview))
    patch.preview = input.preview;
  if (
    previous.watch?.label !== input.watch.label ||
    previous.watch?.url !== input.watch.url
  )
    patch.watch = input.watch;
  return patch;
};

export const ProjectForm = ({
  busy = false,
  slug,
  onClose,
  onFinish,
}: ProjectFormProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<Fields>();
  const [data, setData] = useState<ProjectRecord>();
  const [loading, setLoading] = useState(false);
  const [serviceOptions, setServiceOptions] =
    useState<{ label: string; value: string }[]>();
  const [loadingServices, setLoadingServices] = useState(true);
  const [shown, setShown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { uploading, trackUpload, hasUploads } = useUploadActivity();
  const { cancel, start } = useAbortController();
  const { cancel: cancelServices, start: startServices } = useAbortController();
  const { messageAPI } = useAntd();
  const { hash, key } = useLocation();
  const { lock, unlock } = useLock();
  const { currentUser } =
    useOutletContext<
      DefaultLayoutContext<{ permissions: readonly string[] }>
    >();
  const { canCreate, canUpdate } = getRoutePermissions("projects", currentUser);
  const creating = !slug && hash === modalKeys.create;
  const createRouteKey = creating ? key : undefined;
  const editing = Boolean(slug);
  const open = (creating && canCreate) || (editing && canUpdate);
  const project = data?.slug === slug ? data : undefined;
  const ready = creating || project !== undefined;
  const disabled = !shown || !ready || loading || submitting;
  const servicesDisabled = disabled || busy || serviceOptions === undefined;
  const servicesFailed =
    open && shown && !loadingServices && serviceOptions === undefined;
  const canSubmit = open && !servicesDisabled;
  const requiredMedia = {
    required: true,
    validator: (_: unknown, value?: MediaSource | null) =>
      value?.id || value?.url
        ? Promise.resolve()
        : Promise.reject(new Error(t("requiredField"))),
  };

  const loadServices = useCallback(async () => {
    const signal = startServices();
    setServiceOptions(undefined);
    setLoadingServices(true);

    try {
      const { items } = await fetchServices(signal);
      if (signal.aborted) return;

      setServiceOptions(
        items.map(({ slug, title }) => ({
          label: title,
          value: slug,
        })),
      );
    } catch (failure) {
      if (signal.aborted || isCancel(failure)) return;
    }

    setLoadingServices(false);
  }, [startServices]);

  const close = () => {
    if (submitting) return;

    cancel();
    onClose();
  };

  const submit: FormProps<Fields>["onFinish"] = async (values) => {
    if (!canSubmit || hasUploads()) return;

    const input = toInput(values);
    if (!input || !lock()) return;

    const signal = start();
    setSubmitting(true);
    try {
      if (project) {
        const patch = toPatch(project, input);
        if (!Object.keys(patch).length) {
          onClose();
          return;
        }
        await updateProject(project.slug, patch, signal);
      } else {
        await createProject(input, signal);
      }
      if (signal.aborted) return;

      void messageAPI.success(t("contentSaved"));
      onFinish();
    } catch (failure) {
      if (signal.aborted || isCancel(failure)) return;

      void messageAPI.error(getErrorMessage(failure));
    } finally {
      if (!signal.aborted) {
        unlock();
        setSubmitting(false);
      }
    }
  };

  useLayoutEffect(() => {
    setData(undefined);
    setLoading(false);
    if (!open) setShown(false);
    return cancel;
  }, [cancel, hash, key, open, slug]);

  useLayoutEffect(() => {
    if (!open || !shown || !ready) return;

    form.resetFields();
    if (project) {
      form.setFieldsValue({
        title: project.title,
        slug: project.slug,
        serviceSlug: project.service.slug,
        isFeatured: project.isFeatured,
        poster: formSource(project.poster),
        description: project.description,
        video: formSource(project.video),
        preview: formSource(project.preview),
        watchUrl: project.watch?.url ?? "",
        watchLabel: project.watch?.label ?? "",
      });
    }
    const frame = requestAnimationFrame(() => form.focusField("title"));
    return () => cancelAnimationFrame(frame);
  }, [createRouteKey, form, open, project, ready, shown]);

  useLayoutEffect(() => {
    if (open) void loadServices();
    return cancelServices;
  }, [cancelServices, key, loadServices, open]);

  useEffect(() => {
    void (async () => {
      setSubmitting(false);
      unlock();

      if (!open) {
        if (creating || editing) onClose();
        return;
      }
      if (!slug) return;

      const signal = start();
      setLoading(true);
      try {
        const record = await fetchProject(slug, signal);
        if (signal.aborted) return;

        setData(record);
      } catch (failure) {
        if (signal.aborted || isCancel(failure)) return;
        if (failure instanceof Error) void messageAPI.error(failure.message);
        onClose();
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    })();
    return cancel;
  }, [
    cancel,
    creating,
    editing,
    hash,
    key,
    messageAPI,
    onClose,
    open,
    slug,
    start,
    unlock,
  ]);

  return (
    <Drawer
      afterOpenChange={setShown}
      closeIcon={false}
      footer={
        <Space>
          <Button loading={submitting} onClick={close}>
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
      loading={open && editing && (!shown || loading)}
      mask={{ closable: false }}
      onClose={close}
      open={open}
      styles={{ footer: { textAlign: "end" } }}
      title={t(editing ? "update" : "create")}
      size={640}
    >
      {servicesFailed && <ErrorFallback onRetry={loadServices} />}
      <Form<Fields>
        disabled={disabled}
        form={form}
        hidden={open && (!shown || !ready)}
        initialValues={{ isFeatured: false }}
        layout="vertical"
        name="project-form"
        onFinish={submit}
        scrollToFirstError={{ focus: true }}
      >
        <Form.Item<Fields>
          label={t("title")}
          name="title"
          rules={[{ required: true, transform: trim, max: 500 }]}
        >
          <Input />
        </Form.Item>
        <Form.Item<Fields>
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
        <Form.Item<Fields>
          label={t("projectService")}
          name="serviceSlug"
          rules={[{ required: true }]}
        >
          <Select
            disabled={servicesDisabled}
            loading={loadingServices}
            options={serviceOptions}
            showSearch={{ optionFilterProp: "label" }}
          />
        </Form.Item>
        <Form.Item<Fields>
          label={t("watchLabel")}
          name="watchLabel"
          rules={[{ required: true, transform: trim, max: 80 }]}
        >
          <Input />
        </Form.Item>
        <Form.Item<Fields>
          label={t("watchUrl")}
          name="watchUrl"
          rules={[
            { required: true, transform: trim },
            {
              validator: (_, value?: string) => {
                const address = trim(value);
                return !address || parseHttpsAddress(address)
                  ? Promise.resolve()
                  : Promise.reject(new Error(t("watchUrlInvalid")));
              },
            },
          ]}
        >
          <Input type="url" />
        </Form.Item>
        <Form.Item<Fields>
          label={t("description")}
          name="description"
          rules={[{ required: true, transform: trim, max: 2000 }]}
        >
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
        </Form.Item>
        <Form.Item<Fields> name="isFeatured" valuePropName="checked">
          <Checkbox>{t("featuredProject")}</Checkbox>
        </Form.Item>
        {open && (
          <>
            <Form.Item<Fields>
              label={t("poster")}
              name="poster"
              rules={[requiredMedia]}
            >
              <PosterSourcePicker
                disabled={disabled}
                label={t("poster")}
                onLoadingChange={(active) => trackUpload("poster", active)}
                reference={project?.poster}
              />
            </Form.Item>
            <Form.Item<Fields>
              label={t("video")}
              name="video"
              rules={[requiredMedia]}
            >
              <VideoSourcePicker
                disabled={disabled}
                label={t("video")}
                onLoadingChange={(active) => trackUpload("video", active)}
                selectOnly
                videoReference={project?.video}
              />
            </Form.Item>
            <Form.Item<Fields>
              label={t("mediaPreview")}
              name="preview"
              rules={[requiredMedia]}
            >
              <VideoSourcePicker
                disabled={disabled}
                label={t("mediaPreview")}
                onLoadingChange={(active) => trackUpload("preview", active)}
                selectOnly
                videoReference={project?.preview}
              />
            </Form.Item>
          </>
        )}
      </Form>
    </Drawer>
  );
};
