import {
  Button,
  Flex,
  FloatButton,
  Table,
  type TableProps,
  Tooltip,
} from "antd";
import { isCancel } from "axios";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useOutletContext } from "react-router";

import { useAntd } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import {
  type ArticleCategory,
  fetchArticleCategories,
} from "@/features/article-categories";
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
import { ImageThumbnail } from "@/shared/ui/ImageThumbnail";

import { deleteArticle, fetchArticles } from "./api";
import { ArticleForm } from "./components/article-form/ArticleForm";
import type { ArticleSummary } from "./types";

export const ArticlesPage = () => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<ArticleCategory[]>();
  const [categoriesLoading, setCategoriesLoading] = useState<
    boolean | undefined
  >(true);
  const [articles, setArticles] = useState<ArticleSummary[]>();
  const [loading, setLoading] = useState<boolean | undefined>(true);
  const [submitting, setSubmitting] = useState(false);
  const { cancel: cancelList, start: startList } = useAbortController();
  const { cancel: cancelCategories, start: startCategories } =
    useAbortController();
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
    "articles",
    currentUser,
  );
  const drawerOpen = hash === modalKeys.create || hash === modalKeys.update;
  const tableLocked =
    loading || submitting || drawerOpen || articles === undefined;
  const editorBusy =
    categoriesLoading || categories === undefined || submitting;
  const categoryOptions = categories ?? [];

  const fetchData = useCallback(async () => {
    const signal = startList();
    setLoading(true);

    try {
      const items = await fetchArticles(signal);
      if (signal.aborted) return;

      setArticles(items);
      setLoading(false);
    } catch (error) {
      if (!signal.aborted) setLoading(isCancel(error) ? undefined : false);
    }
  }, [startList]);

  const loadCategories = useCallback(async () => {
    const signal = startCategories();
    setCategoriesLoading(true);

    try {
      const { items } = await fetchArticleCategories(signal);
      if (signal.aborted) return;

      setCategories(items);
      setCategoriesLoading(false);
    } catch (error) {
      if (!signal.aborted)
        setCategoriesLoading(isCancel(error) ? undefined : false);
    }
  }, [startCategories]);

  const handleFormFinish = () => {
    void fetchData();
    goBack();
  };

  const removeArticle = async (id: string) => {
    if (tableLocked || !lock()) return;

    const signal = startMutation();
    setSubmitting(true);
    try {
      await deleteArticle(id, signal);
      if (signal.aborted) return;

      void messageAPI.success(t("deleted"));
      await fetchData();
    } catch (error) {
      if (signal.aborted || isCancel(error)) return;

      void messageAPI.error(getErrorMessage(error));
    } finally {
      if (!signal.aborted) {
        setSubmitting(false);
        unlock();
      }
    }
  };

  const handleDelete = ({ id }: ArticleSummary) => {
    if (!canDelete || tableLocked) return;

    modalAPI.confirm({
      cancelText: t("no"),
      okButtonProps: { danger: true },
      okText: t("yes"),
      title: t("deleteConfirm"),
      onOk: () => removeArticle(id),
    });
  };

  const handleUpdate = ({ id }: ArticleSummary) => {
    if (!canUpdate || tableLocked || editorBusy) return;

    void navigate(
      { hash: modalKeys.update, pathname, search },
      { state: { id } },
    );
  };

  const columns: TableProps<ArticleSummary>["columns"] = [
    {
      align: "center",
      key: "image",
      render: (_, { cover, title }) =>
        cover.url ? (
          <ImageThumbnail
            label={t("image") + " · " + title}
            src={cover.url}
            thumbnailSrc={cover.thumb ?? cover.url + "/thumbnail"}
          />
        ) : (
          "-"
        ),
      title: t("image"),
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
    { align: "center", dataIndex: "slug", title: t("slug") },
    {
      align: "center",
      key: "category",
      render: (_, { category }) => category.name,
      title: t("category"),
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
                      disabled={tableLocked || editorBusy}
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
        ] satisfies TableProps<ArticleSummary>["columns"])
      : []),
  ];

  useEffect(() => {
    void loadCategories();
    return cancelCategories;
  }, [cancelCategories, loadCategories]);
  useEffect(() => {
    void fetchData();
    return cancelList;
  }, [cancelList, fetchData]);
  useEffect(() => cancelMutation, [cancelMutation]);

  return (
    <>
      {categoriesLoading === false && categories === undefined && (
        <section aria-label={t("articleCategories")}>
          <ErrorFallback onRetry={loadCategories} />
        </section>
      )}
      {loading === false && articles === undefined ? (
        <section aria-label={t("articles")}>
          <ErrorFallback onRetry={fetchData} />
        </section>
      ) : (
        <Table<ArticleSummary>
          columns={columns}
          dataSource={articles}
          loading={loading}
          pagination={false}
          rowKey="id"
          scroll={{ x: 720 }}
          size="small"
        />
      )}
      {canCreate && (
        <FloatButton
          aria-label={t("create")}
          disabled={tableLocked || editorBusy}
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
      <ArticleForm
        busy={editorBusy}
        id={getDrawerId(state)}
        onClose={goBack}
        onFinish={handleFormFinish}
        options={{ categories: categoryOptions }}
      />
    </>
  );
};
