import { isCancel } from "axios";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOutletContext } from "react-router";

import { useAntd } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import type { DefaultLayoutContext } from "@/layouts/default";
import { AdminApiError } from "@/shared/api";
import { useAbortController, useLock } from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";

import { fetchHome, saveHome } from "./api";
import type { HomeInput, HomeRecord } from "./types";

export const useHome = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HomeRecord | null>();
  const [submitting, setSubmitting] = useState(false);
  const { messageAPI } = useAntd();
  const { cancel, start } = useAbortController();
  const { lock, unlock } = useLock();
  const { currentUser } =
    useOutletContext<
      DefaultLayoutContext<{ permissions: readonly string[] }>
    >();
  const { canUpdate: canEdit } = getRoutePermissions("home", currentUser);
  const busy = loading || submitting;

  const load = useCallback(async () => {
    const signal = start();
    setLoading(true);
    try {
      const value = await fetchHome(signal);
      if (signal.aborted) return;

      setData(value);
    } catch (failure) {
      if (signal.aborted || isCancel(failure)) return;

      if (
        failure instanceof AdminApiError &&
        failure.status === 404 &&
        failure.code === "NOT_FOUND"
      )
        setData(null);
    }

    setLoading(false);
  }, [start]);

  const save = async (values: HomeInput) => {
    if (!canEdit || busy || !lock()) return;

    const signal = start();
    setSubmitting(true);
    try {
      const saved = await saveHome(values, signal);
      if (signal.aborted) return;

      setData(saved);
      void messageAPI.success(t("contentSaved"));
      return saved;
    } catch (failure) {
      if (!signal.aborted && !isCancel(failure))
        void messageAPI.error(getErrorMessage(failure));
    } finally {
      if (!signal.aborted) setSubmitting(false);
      unlock();
    }
  };

  useEffect(() => {
    void load();
    return cancel;
  }, [cancel, load]);

  return {
    busy,
    canEdit,
    data,
    load,
    loading,
    save,
    submitting,
  };
};
