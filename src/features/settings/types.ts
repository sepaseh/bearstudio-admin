import type {
  FileContext,
  ImageProfiles,
  ImageReference,
  StoredFile,
} from "@/features/files";
import type { ThemePalettes } from "@/shared/contracts";
import type { LocaleCode } from "@/shared/i18n";

export type ImageSettings = {
  height: number;
  size: number;
  width: number;
};

export type Settings = {
  darkLogo?: StoredFile;
  darkTheme: ThemePalettes["dark"];
  profiles: Record<FileContext, ImageSettings>;
  language: {
    calendar: "gregory" | "jalali";
    code: LocaleCode;
    direction: "ltr" | "rtl";
    name: string;
    nativeName: string;
  };
  lightLogo?: StoredFile;
  lightTheme: ThemePalettes["light"];
};

export type SettingsRequest = Pick<
  Settings,
  "darkTheme" | "profiles" | "lightTheme"
> & {
  darkLogoId?: NonNullable<Settings["darkLogo"]>["id"];
  languageCode?: Settings["language"]["code"];
  lightLogoId?: NonNullable<Settings["lightLogo"]>["id"];
};

export type SiteInformation = {
  brandName: string;
  description: string;
  contactEmail: string | null;
  contactTitle: string;
  contactDescription: string;
  socialLinks: { label: string; url: string }[];
  contact: {
    phone: string | null;
    whatsAppNumber: string | null;
  };
};

export type AdminSettingsInput = {
  site: SiteInformation;
  lightTheme: ThemePalettes["light"];
  darkTheme: ThemePalettes["dark"];
  profiles: ImageProfiles;
  lightLogoId: string | null;
  darkLogoId: string | null;
};

export type AdminSettings = AdminSettingsInput & {
  lightLogo: ImageReference | null;
  darkLogo: ImageReference | null;
};

export type PanelAppearance = Pick<
  AdminSettings,
  "darkLogo" | "darkTheme" | "lightLogo" | "lightTheme"
> & { profiles?: ImageProfiles };

export type PanelSettings = Omit<Settings, "darkLogo" | "lightLogo"> & {
  uploadProfiles?: ImageProfiles;
  darkLogo?: ImageReference;
  lightLogo?: ImageReference;
};
