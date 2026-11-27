import {
  Button,
  Flex,
  FloatButton,
  Table,
  type TableProps,
  Tag,
  Tooltip,
} from "antd";
import { isCancel } from "axios";
import { KeyRound, LockKeyhole, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useOutletContext } from "react-router";

import { getRoutePermissions } from "@/app/lib";
import { fetchRoles } from "@/features/roles";
import type { DefaultLayoutContext } from "@/layouts/default";
import { modalKeys } from "@/shared/config";
import { getDrawerId, useAbortController, useGoBack } from "@/shared/hooks";
import { ErrorFallback } from "@/shared/ui/error-boundary";

import { fetchUsers } from "./api";
import { UserForm } from "./components/user-form";
import { UserRoleForm } from "./components/user-role-form";
import { passwordDrawerHash } from "./constants";
import type { ManagedUser, UserViewer } from "./types";

export const UsersPage = () => {
  const { t } = useTranslation();
  const [loadState, setLoadState] = useState<"idle" | "loading" | "settled">(
    "loading",
  );
  const [users, setUsers] = useState<ManagedUser[]>();
  const { cancel, start } = useAbortController();
  const goBack = useGoBack();
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useOutletContext<DefaultLayoutContext<UserViewer>>();
  const { canCreate, canSetPassword, canUpdate } = getRoutePermissions(
    "users",
    currentUser,
  );
  const canManageRoles =
    canUpdate && currentUser.permissions.includes("roles.read");
  const selectedId = getDrawerId(state);
  const loading = loadState === "loading";
  const disabled = loading || users === undefined;

  const fetchData = useCallback(async () => {
    const signal = start();
    setLoadState("loading");

    try {
      const data = await fetchUsers(signal);
      if (signal.aborted) return;

      setUsers(data);
      setLoadState("settled");
    } catch (failure) {
      if (!signal.aborted) setLoadState(isCancel(failure) ? "idle" : "settled");
    }
  }, [start]);

  const handleFormFinish = () => {
    void fetchData();
    goBack();
  };

  const openDrawer = (hash: string, id?: string) => {
    void navigate({ hash, pathname }, { state: id ? { id } : true });
  };

  const columns: TableProps<ManagedUser>["columns"] = [
    {
      align: "center",
      key: "index",
      render: (_, _record, index) => index + 1,
      title: t("row"),
      width: 60,
    },
    { dataIndex: "name", title: t("name") },
    { align: "center", dataIndex: "mobile", title: t("mobile") },
    {
      align: "center",
      key: "roles",
      render: (_, { roles }) =>
        roles.length === 0 ? (
          "-"
        ) : (
          <Flex gap="small" justify="center" wrap>
            {roles.map(({ id, name }) => (
              <Tag key={id} style={{ marginInlineEnd: 0 }}>
                {name}
              </Tag>
            ))}
          </Flex>
        ),
      title: t("roles"),
    },
    {
      align: "center",
      key: "status",
      render: (_, { isActive }) => (
        <Tag
          color={isActive ? "green" : undefined}
          style={{ marginInlineEnd: 0 }}
        >
          {t(isActive ? "active" : "inactive")}
        </Tag>
      ),
      title: t("status"),
      width: 100,
    },
    ...(canUpdate || canSetPassword
      ? ([
          {
            align: "center",
            key: "actions",
            title: t("action"),
            width: 125,
            render: (_, { id }) => (
              <Flex justify="center">
                {canUpdate && (
                  <Tooltip title={t("update")}>
                    <Button
                      aria-label={t("update")}
                      disabled={disabled}
                      type="text"
                      icon={<Pencil aria-hidden size="1em" />}
                      onClick={() => openDrawer(modalKeys.update, id)}
                    />
                  </Tooltip>
                )}
                {canManageRoles && (
                  <Tooltip title={t("roles")}>
                    <Button
                      aria-label={t("roles")}
                      disabled={disabled}
                      type="text"
                      icon={<KeyRound aria-hidden size="1em" />}
                      onClick={() => openDrawer(modalKeys.roles, id)}
                    />
                  </Tooltip>
                )}
                {canSetPassword && (
                  <Tooltip title={t("password")}>
                    <Button
                      aria-label={t("password")}
                      disabled={disabled}
                      type="text"
                      icon={<LockKeyhole aria-hidden size="1em" />}
                      onClick={() => openDrawer(passwordDrawerHash, id)}
                    />
                  </Tooltip>
                )}
              </Flex>
            ),
          },
        ] satisfies TableProps<ManagedUser>["columns"])
      : []),
  ];

  useEffect(() => {
    void fetchData();
    return cancel;
  }, [cancel, fetchData]);

  return (
    <>
      {loadState === "settled" && users === undefined && (
        <ErrorFallback onRetry={fetchData} />
      )}
      <Table<ManagedUser>
        columns={columns}
        dataSource={users ?? []}
        loading={loading}
        pagination={false}
        rowKey="id"
        scroll={{ x: 640 }}
        size="small"
      />
      {canCreate && (
        <FloatButton
          aria-label={t("create")}
          disabled={disabled}
          type="primary"
          icon={<Plus aria-hidden size="1em" />}
          onClick={() => openDrawer(modalKeys.create)}
          tooltip={t("create")}
        />
      )}
      <UserForm id={selectedId} onClose={goBack} onFinish={handleFormFinish} />
      <UserRoleForm
        id={selectedId}
        loadRoles={fetchRoles}
        onClose={goBack}
        onFinish={handleFormFinish}
      />
    </>
  );
};
