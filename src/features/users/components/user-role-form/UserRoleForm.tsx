import { Button, Drawer, Form, type FormProps, Space } from "antd";
import { isCancel } from "axios";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useOutletContext } from "react-router";

import { useAntd } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import type { DefaultLayoutContext } from "@/layouts/default";
import { modalKeys } from "@/shared/config";
import { useAbortController, useLock } from "@/shared/hooks";
import { ErrorFallback } from "@/shared/ui/error-boundary";

import { fetchUser, updateUserRoles } from "../../api";
import type {
  LoadUserRoles,
  ManagedUser,
  UserRoleRequest,
  UserViewer,
} from "../../types";
import { UserRolePicker } from "../UserRolePicker";

type UserRoleFormProps = {
  id?: string;
  loadRoles: LoadUserRoles;
  onClose: () => void;
  onFinish: () => void;
};

export const UserRoleForm = ({
  id,
  loadRoles,
  onClose,
  onFinish,
}: UserRoleFormProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<UserRoleRequest>();
  const [data, setData] = useState<Pick<ManagedUser, "id" | "roles">>();
  const [loading, setLoading] = useState<boolean>();
  const [shown, setShown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI } = useAntd();
  const { hash, key } = useLocation();
  const { lock, unlock } = useLock();
  const { currentUser, handleAccessError } =
    useOutletContext<DefaultLayoutContext<UserViewer>>();
  const { canUpdate } = getRoutePermissions("users", currentUser);
  const isRoles = hash === modalKeys.roles;
  const open =
    isRoles && canUpdate && currentUser.permissions.includes("roles.read");
  const shouldLoad = open && id !== undefined;
  const ready = shouldLoad && data !== undefined && data.id === id;
  const canSubmit = shown && ready && !submitting;
  const showLoadFallback = shouldLoad && loading === false && !ready;

  const handleClose = () => {
    if (submitting) return;

    cancel();
    onClose();
  };

  const handleSubmit: FormProps<UserRoleRequest>["onFinish"] = async ({
    roleIds,
  }) => {
    if (!canSubmit || !lock()) return;

    const signal = start();
    setSubmitting(true);

    try {
      const unchanged =
        roleIds.length === data.roles.length &&
        data.roles.every(({ id }) => roleIds.includes(id));
      if (unchanged) {
        onClose();
        return;
      }

      await updateUserRoles(data.id, { roleIds }, signal);
      if (signal.aborted) return;

      void messageAPI.success(t("rolesUpdated"));
      onFinish();
    } catch (error) {
      if (signal.aborted || isCancel(error) || handleAccessError?.(error))
        return;

      if (error instanceof Error) void messageAPI.error(error.message);
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
      if (user.id === id) setData({ id: user.id, roles: user.roles });

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
    if (!shown || !ready) return;

    form.setFieldsValue({ roleIds: data.roles.map(({ id }) => id) });
  }, [data, form, key, ready, shown]);

  useEffect(() => {
    setSubmitting(false);
    unlock();

    if (shouldLoad) {
      void load();
      return;
    }

    if (isRoles) onClose();
  }, [isRoles, key, load, onClose, shouldLoad, unlock]);

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
      title={t("roles")}
    >
      {showLoadFallback && <ErrorFallback onRetry={load} />}
      <Form<UserRoleRequest>
        disabled={!canSubmit}
        form={form}
        hidden={open && (!shown || !ready)}
        initialValues={{ roleIds: [] }}
        layout="vertical"
        name="user-role-form"
        onFinish={handleSubmit}
      >
        {ready && (
          <Form.Item<UserRoleRequest> name="roleIds">
            <UserRolePicker
              disabled={submitting}
              loadRoles={loadRoles}
              permissions={currentUser.permissions}
              selectedRoles={data.roles}
            />
          </Form.Item>
        )}
      </Form>
    </Drawer>
  );
};
