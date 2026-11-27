import {
  Alert,
  Button,
  Checkbox,
  Divider,
  Drawer,
  Flex,
  Form,
  type FormProps,
  Input,
  Space,
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
import { getErrorMessage } from "@/shared/lib";
import { ErrorFallback } from "@/shared/ui/error-boundary";

import { createRole, fetchPermissions, fetchRole, updateRole } from "../../api";
import type {
  ManagedRole,
  PermissionDefinition,
  RoleRequest,
} from "../../types";

type RoleFormProps = {
  busy?: boolean;
  id?: ManagedRole["id"];
  onClose: () => void;
  onFinish: () => void;
};

const initialFocusField = "name" satisfies keyof RoleRequest;
const trimText = (value?: string) => value?.trim();

const roleChanges = (
  role: ManagedRole,
  desired: RoleRequest,
): Partial<RoleRequest> => {
  const changes: Partial<RoleRequest> = {};
  if (role.name !== desired.name) changes.name = desired.name;
  if (
    role.permissions.length !== desired.permissions.length ||
    desired.permissions.some(
      (permission) => !role.permissions.includes(permission),
    )
  ) {
    changes.permissions = desired.permissions;
  }
  return changes;
};

export const RoleForm = ({
  busy = false,
  id,
  onClose,
  onFinish,
}: RoleFormProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<RoleRequest>();
  const [data, setData] = useState<{
    permissions: PermissionDefinition[];
    role?: ManagedRole;
  }>();
  const [loading, setLoading] = useState<boolean>();
  const [shown, setShown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI } = useAntd();
  const { hash, key } = useLocation();
  const { lock, unlock } = useLock();
  const { currentUser, handleAccessError } =
    useOutletContext<
      DefaultLayoutContext<{ permissions: readonly string[] }>
    >();
  const { canCreate, canUpdate } = getRoutePermissions("roles", currentUser);
  const isCreate = hash === modalKeys.create;
  const isUpdate = hash === modalKeys.update;
  const open = (isCreate && canCreate) || (isUpdate && canUpdate);
  const roleId = isUpdate ? id : undefined;
  const shouldLoad = open && (!isUpdate || roleId !== undefined);
  const ready = shouldLoad && data !== undefined && data.role?.id === roleId;
  const role = ready ? data.role : undefined;
  const showLoadFallback = shouldLoad && loading === false && !ready;
  const withinScope =
    role?.permissions.every((permission) =>
      currentUser.permissions.includes(permission),
    ) ?? true;
  const disabled = !shown || !ready || !withinScope || submitting;
  const canSubmit = !busy && !disabled;
  const groups = new Map<string, PermissionDefinition[]>();
  for (const permission of ready ? data.permissions : []) {
    if (!currentUser.permissions.includes(permission.id)) continue;

    const group = groups.get(permission.group) ?? [];
    group.push(permission);
    groups.set(permission.group, group);
  }

  const handleClose = () => {
    if (submitting) return;

    cancel();
    onClose();
  };

  const handleGroupToggle = (
    ids: string[],
    checked: boolean,
    selected: string[],
  ) => {
    const next = new Set(selected);
    for (const id of ids) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    form.setFieldValue("permissions", [...next]);
  };

  const handleSubmit: FormProps<RoleRequest>["onFinish"] = async (values) => {
    if (!canSubmit || !lock()) return;

    const signal = start();
    setSubmitting(true);

    try {
      const desired: RoleRequest = {
        name: values.name.trim(),
        permissions: [...new Set(values.permissions)],
      };
      if (
        desired.permissions.some(
          (permission) => !currentUser.permissions.includes(permission),
        )
      ) {
        void messageAPI.error("You can only grant permissions you hold.");
        return;
      }

      const payload = role ? roleChanges(role, desired) : desired;
      if (payload.name === undefined && payload.permissions === undefined) {
        onClose();
        return;
      }

      if (role) await updateRole(role.id, payload, signal);
      else await createRole(desired, signal);
      if (signal.aborted) return;

      void messageAPI.success(t(role ? "roleUpdated" : "roleCreated"));
      onFinish();
    } catch (error) {
      if (signal.aborted || isCancel(error) || handleAccessError?.(error))
        return;

      void messageAPI.error(getErrorMessage(error));
    } finally {
      if (!signal.aborted) {
        unlock();
        setSubmitting(false);
      }
    }
  };

  const load = useCallback(async () => {
    if (!shouldLoad) return;

    const signal = start();
    setData(undefined);
    setLoading(true);

    try {
      const [permissions, role] = await Promise.all([
        fetchPermissions(signal),
        roleId === undefined ? undefined : fetchRole(roleId, signal),
      ]);
      if (signal.aborted) return;
      if (role?.id === roleId) setData({ permissions, role });

      setLoading(false);
    } catch (error) {
      if (!signal.aborted) setLoading(isCancel(error) ? undefined : false);
    }
  }, [roleId, shouldLoad, start]);

  useLayoutEffect(() => {
    setData(undefined);
    setLoading(undefined);
    if (!open) setShown(false);
    return cancel;
  }, [cancel, hash, key, open, roleId]);

  useLayoutEffect(() => {
    if (!shown || !ready) return;

    form.resetFields();
    if (role)
      form.setFieldsValue({
        name: role.name,
        permissions: role.permissions,
      });
    const frame = requestAnimationFrame(() =>
      form.focusField(initialFocusField),
    );
    return () => cancelAnimationFrame(frame);
  }, [data, form, key, ready, role, shown]);

  useEffect(() => {
    setSubmitting(false);
    unlock();

    if (shouldLoad) {
      void load();
      return;
    }

    if (isCreate || isUpdate) onClose();
  }, [isCreate, isUpdate, key, load, onClose, shouldLoad, unlock]);

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
      title={t(isUpdate ? "update" : "create")}
    >
      {showLoadFallback && <ErrorFallback onRetry={load} />}
      {!withinScope && (
        <Alert
          showIcon
          title="You can only manage roles whose permissions you hold."
          type="error"
        />
      )}
      <Form<RoleRequest>
        disabled={disabled}
        form={form}
        hidden={open && (!shown || !ready)}
        initialValues={{ permissions: [] }}
        layout="vertical"
        name="role-form"
        onFinish={handleSubmit}
      >
        <Form.Item<RoleRequest>
          label={t("name")}
          name="name"
          rules={[{ required: true, transform: trimText, max: 120 }]}
        >
          <Input />
        </Form.Item>
        <Form.Item<RoleRequest> label={t("permissions")} name="permissions">
          <Checkbox.Group
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            {Array.from(groups, ([group, definitions]) => {
              const ids = definitions.map(({ id }) => id);

              return (
                <Flex gap={8} key={group} vertical>
                  <Divider
                    ref={(node) =>
                      node?.nativeElement.setAttribute("role", "presentation")
                    }
                    styles={{
                      content: { fontSize: 14, fontWeight: 400 },
                      root: { margin: 0 },
                    }}
                    titlePlacement="start"
                    variant="dashed"
                  >
                    <Form.Item<RoleRequest>
                      noStyle
                      shouldUpdate={(previous, next) =>
                        previous.permissions !== next.permissions
                      }
                    >
                      {({ getFieldsValue }) => {
                        const { permissions: selected = [] } = getFieldsValue();
                        const count = ids.filter((id) =>
                          selected.includes(id),
                        ).length;

                        return (
                          <Checkbox
                            checked={count === ids.length}
                            indeterminate={count > 0 && count < ids.length}
                            onChange={({ target: { checked } }) =>
                              handleGroupToggle(ids, checked, selected)
                            }
                            skipGroup
                          >
                            {group}
                          </Checkbox>
                        );
                      }}
                    </Form.Item>
                  </Divider>
                  {definitions.map(({ id, name }) => (
                    <Checkbox key={id} value={id}>
                      {name}
                    </Checkbox>
                  ))}
                </Flex>
              );
            })}
          </Checkbox.Group>
        </Form.Item>
      </Form>
    </Drawer>
  );
};
