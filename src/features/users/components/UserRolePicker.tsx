import { Checkbox, Empty, Flex, Spin } from "antd";
import { isCancel } from "axios";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAbortController } from "@/shared/hooks";
import { ErrorFallback } from "@/shared/ui/error-boundary";

import type { LoadUserRoles, UserRole } from "../types";

type UserRolePickerProps = {
  disabled?: boolean;
  id?: string;
  loadRoles: LoadUserRoles;
  onChange?: (ids: string[]) => void;
  permissions: readonly string[];
  selectedRoles?: UserRole[];
  value?: string[];
};

const maxRoles = 20;

export const UserRolePicker = ({
  disabled = false,
  id,
  loadRoles,
  onChange,
  permissions,
  selectedRoles = [],
  value = [],
}: UserRolePickerProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<boolean | undefined>(true);
  const [roles, setRoles] = useState<Awaited<ReturnType<LoadUserRoles>>>();
  const { cancel, start } = useAbortController();

  const load = useCallback(async () => {
    const signal = start();
    setLoading(true);

    try {
      const found = await loadRoles(signal);
      if (signal.aborted) return;

      setRoles(found);
      setLoading(false);
    } catch (failure) {
      if (!signal.aborted) setLoading(isCancel(failure) ? undefined : false);
    }
  }, [loadRoles, start]);

  const chooseRole = (roleId: string, checked: boolean) => {
    if (disabled) return;

    if (checked) {
      if (value.length < maxRoles && !value.includes(roleId))
        onChange?.([...value, roleId]);
    } else {
      onChange?.(value.filter((id) => id !== roleId));
    }
  };

  useEffect(() => {
    void load();
    return cancel;
  }, [cancel, load]);

  const catalogIds = new Set(roles?.map(({ id }) => id));
  const selectedNames = new Map(
    selectedRoles.map(({ id, name }) => [id, name]),
  );
  const choices = [
    ...(roles ?? []),
    ...value
      .filter((id) => !catalogIds.has(id))
      .map((id) => ({
        id,
        name: selectedNames.get(id) ?? id,
        permissions: [],
      })),
  ];

  return (
    <Flex aria-label={t("roles")} gap="small" id={id} role="group" vertical>
      {loading === false && roles === undefined && (
        <ErrorFallback onRetry={load} />
      )}
      <Spin spinning={loading === true}>
        {choices.length > 0 ? (
          <Flex gap="small" vertical>
            {choices.map(({ id: roleId, name, permissions: grants }) => {
              const checked = value.includes(roleId);
              const cannotAdd =
                !checked &&
                (value.length >= maxRoles ||
                  grants.some((grant) => !permissions.includes(grant)));

              return (
                <Checkbox
                  checked={checked}
                  disabled={disabled || loading || cannotAdd}
                  key={roleId}
                  onChange={(event) => chooseRole(roleId, event.target.checked)}
                >
                  {name}
                </Checkbox>
              );
            })}
          </Flex>
        ) : !loading && roles !== undefined ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : null}
      </Spin>
    </Flex>
  );
};
