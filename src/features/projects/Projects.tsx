import { Button, Flex, FloatButton, type TableProps, Tooltip } from "antd";
import { isCancel } from "axios";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router";

import { routeTree } from "@/app/config";
import { useAntd } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import type { DefaultLayoutContext } from "@/layouts/default";
import { modalKeys } from "@/shared/config";
import { useAbortController, useGoBack, useLock } from "@/shared/hooks";
import { ErrorFallback } from "@/shared/ui/error-boundary";
import { ImageThumbnail } from "@/shared/ui/ImageThumbnail";
import { SortableTable } from "@/shared/ui/sortable-table";

import { deleteProject, fetchProjects, sortProjects } from "./api";
import { ProjectForm } from "./components/project-form/ProjectForm";
import type { ProjectRecord } from "./types";

type ProjectRow = ProjectRecord & { id: string };

export const ProjectsPage = () => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ProjectRow[]>();
  const [loading, setLoading] = useState<boolean | undefined>(true);
  const [submitting, setSubmitting] = useState(false);
  const { cancel: cancelRead, start: startRead } = useAbortController();
  const { cancel: cancelMutation, start: startMutation } = useAbortController();
  const { messageAPI, modalAPI } = useAntd();
  const goBack = useGoBack();
  const { hash } = useLocation();
  const { slug: selectedSlug } = useParams<"slug">();
  const { lock, unlock } = useLock();
  const navigate = useNavigate();
  const { currentUser } =
    useOutletContext<
      DefaultLayoutContext<{ permissions: readonly string[] }>
    >();
  const { canCreate, canDelete, canUpdate } = getRoutePermissions(
    "projects",
    currentUser,
  );
  const drawerOpen = Boolean(selectedSlug) || hash === modalKeys.create;
  const tableLocked =
    loading || submitting || drawerOpen || projects === undefined;

  const fetchData = useCallback(async () => {
    const signal = startRead();
    setLoading(true);
    try {
      const result = await fetchProjects(signal);
      if (signal.aborted) return;

      setProjects(result.map((project) => ({ ...project, id: project.slug })));
      setLoading(false);
    } catch (failure) {
      if (!signal.aborted) setLoading(isCancel(failure) ? undefined : false);
    }
  }, [startRead]);

  const closeEditor = useCallback(() => {
    if (selectedSlug) {
      void navigate(routeTree.projects.path, { replace: true });
    } else {
      goBack();
    }
  }, [goBack, navigate, selectedSlug]);

  const saved = () => {
    void fetchData();
    closeEditor();
  };

  const mutateProjects = async (
    mutate: (signal: AbortSignal) => Promise<void>,
    success: string,
  ) => {
    if (tableLocked || !lock()) return;

    const signal = startMutation();
    setSubmitting(true);
    try {
      await mutate(signal);
      if (signal.aborted) return;

      void messageAPI.success(success);
      await fetchData();
    } catch (failure) {
      if (signal.aborted || isCancel(failure)) return;
      void messageAPI.error(
        failure instanceof Error ? failure.message : t("unexpectedError"),
      );
      throw failure;
    } finally {
      if (!signal.aborted) {
        unlock();
        setSubmitting(false);
      }
    }
  };

  const remove = (record: ProjectRecord) => {
    if (tableLocked || !canDelete) return;

    modalAPI.confirm({
      cancelText: t("no"),
      okButtonProps: { danger: true },
      okText: t("yes"),
      onOk: () =>
        mutateProjects(
          (signal) => deleteProject(record.slug, signal),
          t("deleted"),
        ),
      title: t("deleteConfirm"),
    });
  };

  const reorder = async (items: ProjectRow[]) => {
    if (!canUpdate || tableLocked) return;

    try {
      await mutateProjects(
        (signal) =>
          sortProjects(
            items.map(({ slug }) => slug),
            signal,
          ),
        t("contentSaved"),
      );
    } catch {
      await fetchData();
    }
  };

  const columns: TableProps<ProjectRow>["columns"] = [
    {
      align: "center",
      key: "poster",
      render: (_, { poster, title }) => (
        <ImageThumbnail
          label={t("poster") + " · " + title}
          src={poster.url}
          thumbnailSrc={poster.thumb ?? poster.url}
        />
      ),
      title: t("poster"),
      width: 64,
    },
    {
      align: "center",
      key: "index",
      render: (_, _record, index) => index + 1,
      title: t("row"),
      width: 60,
    },
    { dataIndex: "title", title: t("title") },
    {
      align: "center",
      key: "service",
      render: (_, { service }) => service.name,
      title: t("projectService"),
    },
    ...(canUpdate || canDelete
      ? ([
          {
            align: "center",
            key: "actions",
            title: t("action"),
            width: 100,
            render: (_, record) => (
              <Flex justify="center" wrap="wrap">
                {canUpdate && (
                  <Tooltip title={t("update")}>
                    <Button
                      aria-label={t("update")}
                      disabled={tableLocked}
                      icon={<Pencil aria-hidden size="1em" />}
                      onClick={() =>
                        void navigate(routeTree.projects.link(record.slug))
                      }
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
                      onClick={() => remove(record)}
                      type="text"
                    />
                  </Tooltip>
                )}
              </Flex>
            ),
          },
        ] satisfies TableProps<ProjectRow>["columns"])
      : []),
  ];

  useEffect(() => {
    void fetchData();
    return cancelRead;
  }, [cancelRead, fetchData]);
  useEffect(() => cancelMutation, [cancelMutation]);

  return (
    <>
      {loading === false && projects === undefined ? (
        <ErrorFallback onRetry={fetchData} />
      ) : (
        <SortableTable<ProjectRow>
          columns={columns}
          data={projects ?? []}
          sortable={canUpdate}
          disabled={tableLocked}
          dragLabel={t("order")}
          onReorder={reorder}
          loading={loading}
          size="small"
        />
      )}
      {canCreate && (
        <FloatButton
          aria-label={t("create")}
          disabled={tableLocked}
          icon={<Plus aria-hidden size="1em" />}
          onClick={() =>
            void navigate(
              {
                hash: modalKeys.create,
                pathname: routeTree.projects.path,
              },
              { state: true },
            )
          }
          tooltip={t("create")}
          type="primary"
        />
      )}
      <ProjectForm
        busy={submitting}
        slug={selectedSlug}
        onClose={closeEditor}
        onFinish={saved}
      />
    </>
  );
};
