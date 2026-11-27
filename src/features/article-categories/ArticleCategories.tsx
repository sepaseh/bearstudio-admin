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
import { ErrorFallback } from "@/shared/ui/error-boundary";
import { SortableTable } from "@/shared/ui/sortable-table";

import {
  deleteArticleCategory,
  fetchArticleCategories,
  sortArticleCategories,
} from "./api";
import { ArticleCategoryForm } from "./components/article-category-form/ArticleCategoryForm";
import type { ArticleCategory } from "./types";

type CatalogRow = ArticleCategory & { id: string };

export const ArticleCategoriesPage = () => {
  const { t } = useTranslation();
  const [categories, setRows] = useState<CatalogRow[]>();
  const [loading, setLoading] = useState<boolean | undefined>(true);
  const [submitting, setSubmitting] = useState(false);
  const { cancel: cancelRead, start: startRead } = useAbortController();
  const { cancel: cancelMutation, start: startMutation } = useAbortController();
  const { messageAPI, modalAPI } = useAntd();
  const goBack = useGoBack();
  const { hash, pathname, search, state } = useLocation();
  const { lock, unlock } = useLock();
  const navigate = useNavigate();
  const { currentUser } =
    useOutletContext<
      DefaultLayoutContext<{ permissions: readonly string[] }>
    >();
  const { canCreate, canDelete, canUpdate } = getRoutePermissions(
    "articleCategories",
    currentUser,
  );
  const busy = loading || submitting;
  const drawerOpen = hash === modalKeys.create || hash === modalKeys.update;
  const tableLocked = busy || drawerOpen || categories === undefined;

  const fetchData = useCallback(async () => {
    const signal = startRead();
    setLoading(true);

    try {
      const { items } = await fetchArticleCategories(signal);
      if (signal.aborted) return;

      setRows(items.map((item) => ({ ...item, id: item.slug })));
      setLoading(false);
    } catch (error) {
      if (!signal.aborted) setLoading(isCancel(error) ? undefined : false);
    }
  }, [startRead]);

  const handleFormFinish = () => {
    void fetchData();
    goBack();
  };

  const runMutation = async (
    mutate: (signal: AbortSignal) => Promise<unknown>,
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
      if (signal.aborted || isCancel(error)) return;

      void messageAPI.error(
        error instanceof Error ? error.message : t("unexpectedError"),
      );
      if (refreshOnFailure) await fetchData();
    } finally {
      if (!signal.aborted) {
        setSubmitting(false);
        unlock();
      }
    }
  };

  const handleDelete = ({ id }: CatalogRow) => {
    if (!canDelete || tableLocked) return;

    modalAPI.confirm({
      cancelText: t("no"),
      okText: t("yes"),
      okButtonProps: { danger: true },
      title: t("deleteConfirm"),
      onOk: () =>
        runMutation(
          (signal) => deleteArticleCategory(id, signal),
          t("deleted"),
        ),
    });
  };

  const handleUpdate = ({ id }: CatalogRow) => {
    if (!canUpdate || tableLocked) return;

    void navigate(
      { hash: modalKeys.update, pathname, search },
      { state: { id } },
    );
  };

  const handleOrder = async (items: CatalogRow[]) => {
    if (!canUpdate || tableLocked) return;

    await runMutation(
      (signal) =>
        sortArticleCategories({ slugs: items.map(({ slug }) => slug) }, signal),
      t("contentSaved"),
      true,
    );
  };

  const columns: TableProps<CatalogRow>["columns"] = [
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
      dataIndex: "slug",
      title: t("slug"),
    },
    ...(canUpdate || canDelete
      ? ([
          {
            align: "center",
            key: "actions",
            title: t("action"),
            width: 100,
            render: (_, item) => (
              <Flex justify="center" wrap="wrap">
                {canUpdate && (
                  <Tooltip title={t("update")}>
                    <Button
                      aria-label={t("update")}
                      disabled={tableLocked}
                      icon={<Pencil aria-hidden size="1em" />}
                      onClick={() => handleUpdate(item)}
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
                      onClick={() => handleDelete(item)}
                      type="text"
                    />
                  </Tooltip>
                )}
              </Flex>
            ),
          },
        ] satisfies TableProps<CatalogRow>["columns"])
      : []),
  ];

  useEffect(() => {
    void fetchData();
    return cancelRead;
  }, [cancelRead, fetchData]);
  useEffect(() => cancelMutation, [cancelMutation]);

  return (
    <>
      {loading === false && categories === undefined ? (
        <ErrorFallback onRetry={fetchData} />
      ) : (
        <SortableTable<CatalogRow>
          columns={columns}
          data={categories ?? []}
          sortable={canUpdate}
          disabled={tableLocked}
          dragLabel={t("order")}
          onReorder={handleOrder}
          loading={loading}
          scroll={{ x: 560 }}
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
              { hash: modalKeys.create, pathname, search },
              { state: true },
            )
          }
          tooltip={t("create")}
          type="primary"
        />
      )}
      <ArticleCategoryForm
        busy={busy}
        slug={getDrawerId(state)}
        onClose={goBack}
        onFinish={handleFormFinish}
      />
    </>
  );
};
