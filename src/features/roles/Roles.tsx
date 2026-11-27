import { Button, Flex, FloatButton, type TableProps, Tooltip } from "antd";
import { isCancel } from "axios";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useOutletContext } from "react-router";

import { useAntd } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import type { DefaultLayoutContext } from "@/layouts/default";
import { modalKeys } from "@/shared/config";
import {
  getDrawerId,
  useAbortController,
  useGoBack,
  useLock,
} from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";
import { ErrorFallback } from "@/shared/ui/error-boundary";
import { SortableTable } from "@/shared/ui/sortable-table";

import { deleteRole, fetchRoles, sortRoles } from "./api";
import { RoleForm } from "./components/role-form/RoleForm";
import type { ManagedRole } from "./types";

export const RolesPage = () => {
  const { t } = useTranslation();
  const [loadState, setLoadState] = useState<"idle" | "loading" | "settled">(
    "loading",
  );
  const [roles, setRoles] = useState<ManagedRole[]>();
  const [submitting, setSubmitting] = useState(false);
  const { cancel: cancelRead, start: startRead } = useAbortController();
  const { cancel: cancelMutation, start: startMutation } = useAbortController();
  const { messageAPI, modalAPI } = useAntd();
  const goBack = useGoBack();
  const { hash, pathname, search, state } = useLocation();
  const { lock, unlock } = useLock();
  const navigate = useNavigate();
  const { currentUser, handleAccessError } =
    useOutletContext<
      DefaultLayoutContext<{ permissions: readonly string[] }>
    >();
  const { canCreate, canDelete, canUpdate } = getRoutePermissions(
    "roles",
    currentUser,
  );
  const loading = loadState === "loading";
  const busy = loading || submitting || roles === undefined;
  const drawerOpen = hash === modalKeys.create || hash === modalKeys.update;
  const tableLocked = busy || drawerOpen;

  const fetchData = useCallback(async () => {
    const signal = startRead();
    setLoadState("loading");

    try {
      const items = await fetchRoles(signal);
      if (signal.aborted) return;

      setRoles(items);
      setLoadState("settled");
    } catch (error) {
      if (!signal.aborted) setLoadState(isCancel(error) ? "idle" : "settled");
    }
  }, [startRead]);

  const handleFormFinish = () => {
    void fetchData();
    goBack();
  };

  const withinScope = (role: ManagedRole) =>
    role.permissions.every((permission) =>
      currentUser.permissions.includes(permission),
    );
  const canSort = canUpdate && (roles?.every(withinScope) ?? true);

  const runMutation = async (
    mutate: (signal: AbortSignal) => Promise<void>,
    success: string,
    refreshOnFailure = false,
  ) => {
    if (tableLocked || !lock()) return;

    const signal = startMutation();
    setSubmitting(true);

    try {
      await mutate(signal);
      if (signal.aborted) return;

      void messageAPI.success(success);
      await fetchData();
    } catch (error) {
      if (signal.aborted || isCancel(error) || handleAccessError?.(error))
        return;

      void messageAPI.error(getErrorMessage(error));
      if (refreshOnFailure) await fetchData();
    } finally {
      if (!signal.aborted) {
        setSubmitting(false);
        unlock();
      }
    }
  };

  const handleDelete = (role: ManagedRole) => {
    if (!canDelete || !withinScope(role) || tableLocked) return;

    modalAPI.confirm({
      cancelText: t("no"),
      okText: t("yes"),
      okButtonProps: { danger: true },
      title: t("deleteRoleConfirm"),
      onOk: () =>
        runMutation((signal) => deleteRole(role.id, signal), t("roleDeleted")),
    });
  };

  const handleUpdate = (role: ManagedRole) => {
    if (!canUpdate || !withinScope(role) || tableLocked) return;

    void navigate(
      { hash: modalKeys.update, pathname, search },
      { state: { id: role.id } },
    );
  };

  const handleOrder = async (items: ManagedRole[]) => {
    if (!canSort) return;

    await runMutation(
      (signal) => sortRoles({ ids: items.map(({ id }) => id) }, signal),
      t("contentSaved"),
      true,
    );
  };

  const columns: TableProps<ManagedRole>["columns"] = [
    {
      align: "center",
      key: "index",
      render: (_, _record, index) => index + 1,
      title: t("row"),
      width: 60,
    },
    {
      dataIndex: "name",
      title: t("name"),
    },
    {
      align: "center",
      dataIndex: "permissions",
      render: (_, role) => role.permissions.length,
      title: t("permissions"),
      width: 120,
    },
    ...(canUpdate || canDelete
      ? ([
          {
            align: "center",
            key: "actions",
            title: t("action"),
            width: 90,
            render: (_, role) =>
              withinScope(role) && (
                <Flex justify="center">
                  {canUpdate && (
                    <Tooltip title={t("update")}>
                      <Button
                        aria-label={t("update")}
                        disabled={tableLocked}
                        icon={<Pencil aria-hidden size="1em" />}
                        onClick={() => handleUpdate(role)}
                        type="text"
                      />
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip title={t("delete")}>
                      <Button
                        aria-label={t("delete")}
                        disabled={tableLocked}
                        icon={<Trash2 aria-hidden size="1em" />}
                        onClick={() => handleDelete(role)}
                        type="text"
                      />
                    </Tooltip>
                  )}
                </Flex>
              ),
          },
        ] satisfies TableProps<ManagedRole>["columns"])
      : []),
  ];

  useEffect(() => {
    void fetchData();
    return cancelRead;
  }, [cancelRead, fetchData]);
  useEffect(() => cancelMutation, [cancelMutation]);

  return (
    <>
      {loadState === "settled" && roles === undefined && (
        <ErrorFallback onRetry={fetchData} />
      )}
      <SortableTable<ManagedRole>
        columns={columns}
        data={roles ?? []}
        disabled={tableLocked || (roles?.length ?? 0) < 2}
        dragLabel={t("order")}
        loading={loading}
        onReorder={handleOrder}
        size="small"
        sortable={canSort}
      />
      {canCreate && (
        <FloatButton
          aria-label={t("create")}
          disabled={tableLocked}
          icon={<Plus aria-hidden size="1em" />}
          onClick={() =>
            void navigate(
              { hash: modalKeys.create, pathname, search },
              { state: true },
            )
          }
          tooltip={t("create")}
          type="primary"
        />
      )}
      <RoleForm
        busy={busy}
        id={getDrawerId(state)}
        onClose={goBack}
        onFinish={handleFormFinish}
      />
    </>
  );
};
