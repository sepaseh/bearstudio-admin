import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/shared/api";

import {
  fetchAdminSettings,
  fetchLanguages,
  fetchSettings,
  saveAdminSettings,
  updateSettings,
} from "./api";
import type { AdminSettingsInput, SettingsRequest } from "./types";

vi.mock("@/shared/api", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("settings HTTP contract", () => {
  it("reads and replaces admin settings", async () => {
    const { signal } = new AbortController();
    const colors = {
      colorBgBase: "#ffffff",
      colorBgContainer: "#ffffff",
      colorBorder: "#cccccc",
      colorLink: "#0000ff",
      colorPrimary: "#0000ff",
      colorTextBase: "#111111",
      colorTextDescription: "#333333",
    };
    const profile = { width: 512, height: 512, size: 1048576 };
    const input: AdminSettingsInput = {
      darkTheme: colors,
      lightTheme: colors,
      darkLogoId: null,
      lightLogoId: null,
      profiles: {
        logo: profile,
        article: profile,
        content: { width: 1600, height: 900, size: 5242880 },
        project: profile,
        service: profile,
        thumbnail: { width: 200, height: 200 },
        video: profile,
      },
      site: {
        brandName: "Synthetic Studio",
        contactEmail: null,
        contactDescription: "",
        contactTitle: "",
        description: "",
        socialLinks: [],
        contact: {
          phone: null,
          whatsAppNumber: null,
        },
      },
    };
    await fetchAdminSettings(signal);
    await saveAdminSettings(input, signal);

    expect(apiClient.get).toHaveBeenCalledWith("/admin/settings", { signal });
    expect(apiClient.put).toHaveBeenCalledWith("/admin/settings", input, {
      signal,
    });
  });

  it("bounds settings reads while forwarding cancellation to both read owners", async () => {
    const controller = new AbortController();
    await fetchSettings(controller.signal);
    await fetchLanguages(controller.signal);

    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/settings", {
      signal: controller.signal,
      timeout: 15_000,
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/languages", {
      signal: controller.signal,
    });
  });

  it("persists palettes, image limits, API language and uploaded logo identifiers together", async () => {
    const colors = {
      colorBgBase: "#fff",
      colorBgContainer: "#fff",
      colorBorder: "#ccc",
      colorLink: "#05a",
      colorPrimary: "#05a",
      colorTextBase: "#111",
      colorTextDescription: "#333",
    };
    const request: SettingsRequest = {
      darkTheme: colors,
      lightTheme: colors,
      profiles: {
        logo: { width: 100, height: 100, size: 1024 },
        contents: { width: 400, height: 200, size: 4096 },
      },
      languageCode: "fa",
      darkLogoId: "synthetic-dark",
      lightLogoId: "synthetic-light",
    };
    const response = {
      ...request,
      language: { code: "fa", calendar: "jalali", direction: "rtl" },
    };
    vi.mocked(apiClient.put).mockResolvedValue(response);
    const controller = new AbortController();

    await expect(updateSettings(request, controller.signal)).resolves.toBe(
      response,
    );
    expect(apiClient.put).toHaveBeenCalledWith("/settings", request, {
      signal: controller.signal,
    });
  });

  it("propagates a rejected settings read without substituting local settings", async () => {
    const error = new Error("Synthetic settings conflict");
    vi.mocked(apiClient.get).mockRejectedValue(error);

    await expect(fetchSettings()).rejects.toBe(error);
  });
});
