import {
  Button,
  Drawer,
  Form,
  type FormProps,
  Input,
  Space,
  Switch,
  Typography,
} from "antd";
import { isCancel } from "axios";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useOutletContext } from "react-router";

import { useAntd } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import type { DefaultLayoutContext } from "@/layouts/default";
import { modalKeys } from "@/shared/config";
import { useAbortController, useLock } from "@/shared/hooks";
import { getErrorMessage, normalizeMobile } from "@/shared/lib";
import { ErrorFallback } from "@/shared/ui/error-boundary";

import {
  createUser,
  fetchUser,
  updateUser,
  updateUserPassword,
} from "../../api";
import { passwordDrawerHash } from "../../constants";
import type {
  ManagedUser,
  UserRequest,
  UserUpdateRequest,
  UserViewer,
} from "../../types";

type UserFormProps = {
  id?: string;
  onClose: () => void;
  onFinish: () => void;
};

type UserFormValues = UserRequest & {
  confirmPassword: string;
  isActive: boolean;
};

const trimName = (name?: string) => name?.trim();
const passwordCharacterClasses = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/];

export const UserForm = ({ id, onClose, onFinish }: UserFormProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<UserFormValues>();
  const [data, setData] =
    useState<Pick<ManagedUser, "id" | "isActive" | "mobile" | "name">>();
  const [loading, setLoading] = useState<boolean>();
  const [shown, setShown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI } = useAntd();
  const { hash, key } = useLocation();
  const { lock, unlock } = useLock();
  const { currentUser, handleAccessError } =
    useOutletContext<DefaultLayoutContext<UserViewer>>();
  const { canCreate, canSetPassword, canUpdate } = getRoutePermissions(
    "users",
    currentUser,
  );
  const isCreate = hash === modalKeys.create;
  const isUpdate = hash === modalKeys.update;
  const isPassword = hash === passwordDrawerHash;
  const needsRecord = isUpdate || isPassword;
  const open =
    (isCreate && canCreate) ||
    (isUpdate && canUpdate) ||
    (isPassword && canSetPassword);
  const shouldLoad = open && needsRecord && id !== undefined;
  const ready = !needsRecord || (shouldLoad && data?.id === id);
  const showLoadFallback = shouldLoad && loading === false && !ready;
  const disabled = !shown || !ready || submitting;
  const canSubmit = open && !disabled;
  const focusField = isPassword ? "password" : "name";

  const handleClose = () => {
    if (submitting) return;

    cancel();
    onClose();
  };

  const handleSubmit: FormProps<UserFormValues>["onFinish"] = async ({
    isActive,
    mobile,
    name,
    password,
  }) => {
    if (!canSubmit || !lock()) return;

    const signal = start();
    setSubmitting(true);

    try {
      if (isCreate || !data) {
        await createUser(
          {
            name: name.trim(),
            mobile: normalizeMobile(mobile),
            password,
          },
          signal,
        );
      } else if (isPassword) {
        await updateUserPassword(data.id, { newPassword: password }, signal);
      } else {
        const changes: UserUpdateRequest = {};
        const trimmedName = name.trim();
        if (trimmedName !== data.name) changes.name = trimmedName;
        if (data.id !== currentUser.id && isActive !== data.isActive)
          changes.isActive = isActive;
        if (changes.name === undefined && changes.isActive === undefined) {
          onClose();
          return;
        }

        await updateUser(data.id, changes, signal);
      }
      if (signal.aborted) return;

      if (isCreate || isPassword)
        form.resetFields(["password", "confirmPassword"]);
      void messageAPI.success(
        t(
          isCreate
            ? "userCreated"
            : isPassword
              ? "passwordChanged"
              : "userUpdated",
        ),
      );
      onFinish();
    } catch (error) {
      if (signal.aborted || isCancel(error) || handleAccessError?.(error))
        return;

      void messageAPI.error(getErrorMessage(error));
    } finally {
      if (!signal.aborted) {
        setSubmitting(false);
        unlock();
      }
    }
  };

  const load = useCallback(async () => {
    if (!shouldLoad) return;

    const signal = start();
    setData(undefined);
    setLoading(true);

    try {
      const user = await fetchUser(id, signal);
      if (signal.aborted) return;
      if (user.id === id)
        setData({
          id: user.id,
          isActive: user.isActive,
          mobile: user.mobile,
          name: user.name,
        });

      setLoading(false);
    } catch (error) {
      if (!signal.aborted) setLoading(isCancel(error) ? undefined : false);
    }
  }, [id, shouldLoad, start]);

  useLayoutEffect(() => {
    setData(undefined);
    setLoading(undefined);
    if (!open) setShown(false);
    return cancel;
  }, [cancel, hash, id, key, open]);

  useLayoutEffect(() => {
    if (!open || !shown || !ready) return;

    form.resetFields();
    if (needsRecord && data)
      form.setFieldsValue({
        name: data.name,
        mobile: data.mobile,
        isActive: data.isActive,
      });
    const frame = requestAnimationFrame(() => form.focusField(focusField));
    return () => cancelAnimationFrame(frame);
  }, [data, focusField, form, key, needsRecord, open, ready, shown]);

  useEffect(() => {
    setSubmitting(false);
    unlock();

    if (shouldLoad) {
      void load();
      return;
    }

    if (needsRecord || (isCreate && !open)) onClose();
  }, [
    hash,
    isCreate,
    key,
    load,
    needsRecord,
    onClose,
    open,
    shouldLoad,
    unlock,
  ]);

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
      loading={shouldLoad && (!shown || loading === true)}
      mask={{ closable: false }}
      onClose={handleClose}
      open={open}
      styles={{ footer: { textAlign: "end" } }}
      title={t(isPassword ? "changePassword" : isUpdate ? "update" : "create")}
    >
      {showLoadFallback && <ErrorFallback onRetry={load} />}
      {isPassword && shown && ready && (
        <Typography.Text>{data?.name}</Typography.Text>
      )}
      <Form<UserFormValues>
        disabled={disabled}
        form={form}
        hidden={open && (!shown || !ready)}
        initialValues={{ isActive: true }}
        layout="vertical"
        name="user-form"
        onFinish={handleSubmit}
        scrollToFirstError={{ focus: true }}
      >
        {!isPassword && (
          <>
            <Form.Item<UserFormValues>
              label={t("name")}
              name="name"
              rules={[{ required: true, transform: trimName, max: 120 }]}
            >
              <Input />
            </Form.Item>
            <Form.Item<UserFormValues>
              label={t("mobile")}
              name="mobile"
              rules={
                isCreate
                  ? [
                      {
                        required: true,
                        pattern: /^9[0-9]{9}$/,
                        transform: normalizeMobile,
                      },
                    ]
                  : []
              }
            >
              <Input inputMode="numeric" readOnly={!isCreate} />
            </Form.Item>
          </>
        )}
        {isUpdate && (
          <Form.Item<UserFormValues>
            label={t("status")}
            name="isActive"
            valuePropName="checked"
          >
            <Switch
              aria-label={t("status")}
              checkedChildren={t("active")}
              disabled={disabled || data?.id === currentUser.id}
              unCheckedChildren={t("inactive")}
            />
          </Form.Item>
        )}
        {(isCreate || isPassword) && (
          <>
            <Form.Item<UserFormValues>
              label={t(isPassword ? "newPassword" : "password")}
              name="password"
              preserve={false}
              rules={[
                { required: true },
                {
                  validator(_, value: string | undefined) {
                    if (
                      !value ||
                      (value.length >= 12 &&
                        value.length <= 128 &&
                        passwordCharacterClasses.every((pattern) =>
                          pattern.test(value),
                        ))
                    ) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error(t("passwordRequirements")));
                  },
                },
              ]}
              tooltip={t("passwordRequirements")}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item<UserFormValues>
              dependencies={["password"]}
              label={t("confirmPassword")}
              name="confirmPassword"
              preserve={false}
              rules={[
                { required: true },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    return !value || value === getFieldValue("password")
                      ? Promise.resolve()
                      : Promise.reject(new Error(t("passwordMismatch")));
                  },
                }),
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          </>
        )}
      </Form>
    </Drawer>
  );
};
