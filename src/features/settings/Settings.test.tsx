// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";

import { fetchAdminSettings, saveAdminSettings } from "./api";
import { SettingsPage } from "./Settings";
import type { AdminSettings, AdminSettingsInput } from "./types";

const { messages, setAppearance } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
  setAppearance: vi.fn(),
}));
vi.mock("./api", () => ({
  fetchAdminSettings: vi.fn(),
  saveAdminSettings: vi.fn(),
}));
vi.mock("@/features/files", () => ({
  ManagedImagePicker: ({
    disabled,
    id,
    onChange,
    value,
  }: {
    disabled?: boolean;
    id?: string;
    onChange?: (value: string | null) => void;
    value?: string | null;
  }) => (
    <input
      disabled={disabled}
      id={id}
      onChange={(event) => onChange?.(event.target.value || null)}
      value={value ?? ""}
    />
  ),
}));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: messages, token: { colorText: "#111111" } }),
  useCore: () => ({ setAppearance }),
}));

const palette = {
  colorBgBase: "#ffffff",
  colorBgContainer: "#ffffff",
  colorBorder: "#cccccc",
  colorLink: "#0055aa",
  colorPrimary: "#0055aa",
  colorTextBase: "#111111",
  colorTextDescription: "#333333",
};

const site = {
  brandName: "Synthetic Studio",
  description: "Independent studio.",
  contactEmail: "hello@example.test",
  contactTitle: "Contact",
  contactDescription: "Get in touch.",
  socialLinks: [{ label: "Portfolio", url: "https://example.test/" }],
  contact: {
    phone: "+989120000001",
    whatsAppNumber: "+989120000002",
  },
} satisfies AdminSettingsInput["site"];

const input: AdminSettingsInput = {
  site,
  lightTheme: palette,
  darkTheme: palette,
  lightLogoId: "81000000-0000-4000-8000-000000000001",
  darkLogoId: null,
  profiles: {
    logo: { width: 512, height: 512, size: 2097152 },
    article: { width: 1024, height: 1536, size: 2097152 },
    content: { width: 1600, height: 900, size: 5242880 },
    project: { width: 1024, height: 1536, size: 5242880 },
    service: { width: 1200, height: 1200, size: 5242880 },
    thumbnail: { width: 200, height: 200 },
    video: { width: 200, height: 200, size: 2097152 },
  },
};

const settings: AdminSettings = {
  ...input,
  lightLogo: {
    id: input.lightLogoId!,
    url: "/media-test/logo",
    thumb: "/media-test/logo-small",
  },
  darkLogo: null,
};

const renderPage = (permissions = ["settings.read", "settings.write"]) =>
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={{ currentUser: { permissions } }} />}>
          <Route path="*" element={<SettingsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(fetchAdminSettings).mockResolvedValue(settings);
  vi.mocked(saveAdminSettings).mockImplementation(async (value) => ({
    ...settings,
    ...value,
    lightLogo: value.lightLogoId ? settings.lightLogo : null,
  }));
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

it("preserves saved phone and WhatsApp numbers when clearing email or a logo", async () => {
  renderPage();
  await screen.findByDisplayValue(site.brandName);
  expect(
    screen.queryByLabelText(
      /^(address|latitude|longitude|map zoom|phone number|whatsapp number)$/i,
    ),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(i18n.t("contactEmail")), {
    target: { value: "" },
  });
  fireEvent.change(screen.getByLabelText(i18n.t("lightLogo")), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: i18n.t("submit") }));

  await waitFor(() =>
    expect(saveAdminSettings).toHaveBeenCalledExactlyOnceWith(
      {
        ...input,
        site: {
          ...site,
          contactEmail: null,
        },
        lightLogoId: null,
      },
      expect.any(AbortSignal),
    ),
  );
  expect(setAppearance).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ lightLogo: null, darkTheme: palette }),
  );
});

it("keeps site and appearance settings read-only for a settings reader", async () => {
  renderPage(["settings.read"]);
  expect(await screen.findByDisplayValue(site.brandName)).toBeDisabled();
  expect(screen.getByLabelText(i18n.t("lightLogo"))).toBeDisabled();
  const content = within(
    screen.getByRole("group", { name: i18n.t("content") }),
  );
  expect(content.getByLabelText(i18n.t("imageWidth"))).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: i18n.t("submit") }),
  ).not.toBeInTheDocument();
  expect(saveAdminSettings).not.toHaveBeenCalled();
});

it("shows all upload profiles and saves changed thumbnail dimensions with the complete settings", async () => {
  renderPage(["settings.read", "settings.write", "media.read", "media.write"]);
  await screen.findByDisplayValue(site.brandName);
  expect(
    screen.queryByRole("tab", { name: i18n.t("images") }),
  ).not.toBeInTheDocument();
  for (const label of [
    "article",
    "content",
    "project",
    "service",
    "logo",
    "video",
  ] as const) {
    expect(screen.getByRole("group", { name: i18n.t(label) })).toBeVisible();
  }
  expect(screen.queryByRole("group", { name: "Contents" })).toBeNull();
  expect(
    screen.queryByRole("group", { name: i18n.t("approach") }),
  ).not.toBeInTheDocument();
  const thumbnail = within(
    screen.getByRole("group", { name: i18n.t("imageThumbnail") }),
  );
  const width = thumbnail.getByRole("spinbutton", {
    name: i18n.t("imageWidth"),
  });
  const height = thumbnail.getByRole("spinbutton", {
    name: i18n.t("imageHeight"),
  });
  expect(width).toHaveValue("200");
  expect(height).toHaveValue("200");
  fireEvent.change(width, { target: { value: "280" } });
  fireEvent.change(height, { target: { value: "240" } });
  fireEvent.click(screen.getByRole("button", { name: i18n.t("submit") }));

  await waitFor(() =>
    expect(saveAdminSettings).toHaveBeenCalledExactlyOnceWith(
      {
        ...input,
        profiles: {
          ...input.profiles,
          thumbnail: { width: 280, height: 240 },
        },
      },
      expect.any(AbortSignal),
    ),
  );
});

it("validates, saves and resets the landscape Content image profile", async () => {
  renderPage();
  await screen.findByDisplayValue(site.brandName);
  const content = within(
    screen.getByRole("group", { name: i18n.t("content") }),
  );
  const field = (key: "imageWidth" | "imageHeight" | "imageMaxBytes") =>
    content.getByRole("spinbutton", { name: i18n.t(key) });
  const submit = screen.getByRole("button", { name: i18n.t("submit") });
  const reset = screen.getByRole("button", { name: i18n.t("reset") });
  expect(field("imageWidth")).toHaveValue("1600");
  expect(field("imageHeight")).toHaveValue("900");
  expect(field("imageMaxBytes")).toHaveValue("5242880");

  fireEvent.change(field("imageWidth"), { target: { value: "900" } });
  fireEvent.click(submit);
  await waitFor(() =>
    expect(content.getByText(i18n.t("imageLandscapeRequired"))).toBeVisible(),
  );
  expect(saveAdminSettings).not.toHaveBeenCalled();

  fireEvent.click(reset);
  expect(field("imageWidth")).toHaveValue("1600");
  await waitFor(() =>
    expect(
      content.queryByText(i18n.t("imageLandscapeRequired")),
    ).not.toBeInTheDocument(),
  );

  fireEvent.change(field("imageWidth"), { target: { value: "1920" } });
  fireEvent.change(field("imageHeight"), { target: { value: "1080" } });
  fireEvent.change(field("imageMaxBytes"), { target: { value: "6291456" } });
  fireEvent.click(submit);

  await waitFor(() =>
    expect(saveAdminSettings).toHaveBeenCalledExactlyOnceWith(
      {
        ...input,
        profiles: {
          ...input.profiles,
          content: { width: 1920, height: 1080, size: 6291456 },
        },
      },
      expect.any(AbortSignal),
    ),
  );
  await waitFor(() => expect(messages.success).toHaveBeenCalledOnce());
  fireEvent.change(field("imageWidth"), { target: { value: "2048" } });
  fireEvent.click(reset);
  expect(field("imageWidth")).toHaveValue("1920");
});

it("retries a failed read without editing provisional settings", async () => {
  vi.mocked(fetchAdminSettings).mockRejectedValueOnce(
    new Error("Synthetic storage failure"),
  );
  renderPage();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    i18n.t("unexpectedError"),
  );
  expect(
    screen.queryByText("Synthetic storage failure"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: i18n.t("submit") }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: i18n.t("retry") }));
  expect(await screen.findByDisplayValue(site.brandName)).toBeInTheDocument();
});

it("cancels a settings read when leaving its screen", () => {
  vi.mocked(fetchAdminSettings).mockReturnValue(
    deferred<AdminSettings>().promise,
  );
  const { unmount } = renderPage();
  const [signal] = vi.mocked(fetchAdminSettings).mock.calls[0];
  unmount();
  expect(signal?.aborted).toBe(true);
});
