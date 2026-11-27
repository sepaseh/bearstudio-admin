import { createContext } from "react";

import type { RouteKey } from "@/app/config";
import type { PanelAppearance, PanelSettings } from "@/features/settings/types";
import type { Theme } from "@/shared/contracts";

export type CoreContextValue = {
  compact: boolean;
  currentRoute: RouteKey;
  setAppearance: (appearance: PanelAppearance) => void;
  setCompact: (compact: boolean) => void;
  setCurrentRoute: (route: RouteKey) => void;
  setSettings: (settings: PanelSettings) => void;
  setTheme: (theme: Theme) => void;
  settings: PanelSettings;
  theme: Theme;
};

export const CoreContext = createContext<CoreContextValue | undefined>(
  undefined,
);

export const applyPanelAppearance = (
  settings: PanelSettings,
  appearance: PanelAppearance,
): PanelSettings => ({
  ...settings,
  uploadProfiles: appearance.profiles ?? settings.uploadProfiles,
  darkLogo: appearance.darkLogo ?? undefined,
  darkTheme: appearance.darkTheme,
  lightLogo: appearance.lightLogo ?? undefined,
  lightTheme: appearance.lightTheme,
});
