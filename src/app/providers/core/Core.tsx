import { theme as antdTheme } from "antd";
import dayjs from "dayjs";
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  applyPanelAppearance,
  CoreContext,
  type CoreContextValue,
} from "@/app/contexts";
import { fetchPanelAppearance } from "@/features/settings/api";
import type { PanelSettings } from "@/features/settings/types";
import { storageKeys } from "@/shared/config";
import { useAbortController } from "@/shared/hooks";
import { dayjsLocaleName, i18n } from "@/shared/i18n";
import {
  getCompact,
  getTheme,
  setCompact as saveCompact,
  setTheme as saveTheme,
  useLocalStorageWatcher,
} from "@/shared/storage";

const getDefaultPalette = (
  algorithm: typeof antdTheme.defaultAlgorithm,
): PanelSettings["lightTheme"] => {
  const {
    colorBgBase,
    colorBgContainer,
    colorBorder,
    colorTextBase,
    colorTextDescription,
  } = antdTheme.getDesignToken({ algorithm });
  // AntdProvider derives the primary and link colors from these seed values.
  const { colorInfo, colorLink, colorPrimary } = antdTheme.defaultSeed;

  return {
    colorBgBase,
    colorBgContainer,
    colorBorder,
    colorLink: colorLink || colorInfo,
    colorPrimary,
    colorTextBase,
    colorTextDescription,
  };
};

const defaultSettings: PanelSettings = {
  darkTheme: getDefaultPalette(antdTheme.darkAlgorithm),
  profiles: {
    contents: { height: 900, size: 5242880, width: 1600 },
    logo: { height: 128, size: 2097152, width: 512 },
  },
  language: {
    calendar: "gregory",
    code: "en",
    direction: "ltr",
    name: "English",
    nativeName: "English",
  },
  lightTheme: getDefaultPalette(antdTheme.defaultAlgorithm),
};

export const CoreProvider = ({ children }: PropsWithChildren) => {
  const [compact, setCompact] = useState(getCompact);
  const [currentRoute, setCurrentRoute] =
    useState<CoreContextValue["currentRoute"]>("root");
  const [settings, setSettings] = useState(defaultSettings);
  const [theme, setTheme] = useState(getTheme);
  const { cancel: cancelAppearance, start: startAppearance } =
    useAbortController();
  const { language } = settings;

  const setAppearance = useCallback<CoreContextValue["setAppearance"]>(
    (appearance) => {
      cancelAppearance();
      setSettings((current) => applyPanelAppearance(current, appearance));
    },
    [cancelAppearance],
  );

  const changeCompact: CoreContextValue["setCompact"] = (value) => {
    saveCompact(value);
    setCompact(value);
  };

  const changeTheme: CoreContextValue["setTheme"] = (value) => {
    saveTheme(value);
    setTheme(value);
  };

  useLocalStorageWatcher(storageKeys.compact, () => setCompact(getCompact()));
  useLocalStorageWatcher(storageKeys.theme, () => setTheme(getTheme()));

  useEffect(() => {
    const signal = startAppearance();
    void fetchPanelAppearance(signal).then(
      (appearance) => {
        if (!signal.aborted) setAppearance(appearance);
      },
      () => undefined,
    );
  }, [setAppearance, startAppearance]);

  useEffect(() => {
    void i18n.changeLanguage(language.code);
    dayjs.calendar(language.calendar);
    dayjs.locale(dayjsLocaleName(language.code));
  }, [language]);

  return (
    <CoreContext.Provider
      value={{
        compact,
        currentRoute,
        settings,
        setAppearance,
        setCompact: changeCompact,
        setCurrentRoute,
        setSettings,
        setTheme: changeTheme,
        theme,
      }}
    >
      {children}
    </CoreContext.Provider>
  );
};
