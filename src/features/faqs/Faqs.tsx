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

import { deleteFaq, fetchFaqs, sortFaqs } from "./api";
import { FaqForm } from "./components/faq-form/FaqForm";
import type { Faq } from "./types";

export const FaqsPage = () => {
  const { t } = useTranslation();
  const [faqs, setFaqs] = useState<Faq[]>();
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
    "faqs",
    currentUser,
  );
  const busy = loading || submitting;
  const drawerOpen = hash === modalKeys.create || hash === modalKeys.update;
  const tableLocked = busy || drawerOpen || faqs === undefined;

  const fetchData = useCallback(async () => {
    const signal = startRead();
    setLoading(true);

    try {
      const { items } = await fetchFaqs(signal);
      if (signal.aborted) return;

      setFaqs(items);
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
    options?: {
      refreshOnFailure?: boolean;
      keepConfirmationOnFailure?: boolean;
    },
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
      if (options?.refreshOnFailure) await fetchData();
      if (options?.keepConfirmationOnFailure) throw error;
    } finally {
      if (!signal.aborted) {
        setSubmitting(false);
        unlock();
      }
    }
  };

  const handleDelete = ({ id }: Faq) => {
    if (!canDelete || tableLocked) return;

    modalAPI.confirm({
      cancelText: t("no"),
      okText: t("yes"),
      okButtonProps: { danger: true },
      title: t("deleteConfirm"),
      onOk: () =>
        runMutation((signal) => deleteFaq(id, signal), t("deleted"), {
          keepConfirmationOnFailure: true,
        }),
    });
  };

  const handleUpdate = ({ id }: Faq) => {
    if (!canUpdate || tableLocked) return;

    void navigate(
      { hash: modalKeys.update, pathname, search },
      { state: { id } },
    );
  };

  const handleOrder = async (items: Faq[]) => {
    if (!canUpdate || tableLocked) return;

    await runMutation(
      (signal) => sortFaqs({ ids: items.map(({ id }) => id) }, signal),
      t("contentSaved"),
      { refreshOnFailure: true },
    );
  };

  const columns: TableProps<Faq>["columns"] = [
    {
      align: "center",
      key: "index",
      render: (_, _record, index) => index + 1,
      title: t("row"),
      width: 60,
    },
    Table.EXPAND_COLUMN,
    {
      dataIndex: "question",
      title: t("question"),
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
        ] satisfies TableProps<Faq>["columns"])
      : []),
  ];

  useEffect(() => {
    void fetchData();
    return cancelRead;
  }, [cancelRead, fetchData]);
  useEffect(() => cancelMutation, [cancelMutation]);

  return (
    <>
      {loading === false && faqs === undefined ? (
        <ErrorFallback onRetry={fetchData} />
      ) : (
        <SortableTable<Faq>
          columns={columns}
          data={faqs ?? []}
          sortable={canUpdate}
          disabled={tableLocked}
          dragLabel={t("order")}
          expandable={{
            columnTitle: (
              <span
                style={{
                  clipPath: "inset(50%)",
                  height: 1,
                  overflow: "hidden",
                  position: "absolute",
                  whiteSpace: "nowrap",
                  width: 1,
                }}
              >
                {t("answer")}
              </span>
            ),
            expandedRowRender: ({ answer }) => (
              <span
                style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}
              >
                {answer}
              </span>
            ),
          }}
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
      <FaqForm
        busy={busy}
        id={getDrawerId(state)}
        onClose={goBack}
        onFinish={handleFormFinish}
      />
    </>
  );
};
