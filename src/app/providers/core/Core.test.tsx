// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { theme as antdTheme } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCore } from "@/app/hooks";
import { AntdProvider } from "@/app/providers/antd";
import type { PanelAppearance } from "@/features/settings/types";
import { deferred } from "@/test/deferred";

import { CoreProvider } from "./Core";

const { fetchPanelAppearance } = vi.hoisted(() => ({
  fetchPanelAppearance: vi.fn(),
}));
vi.mock("@/features/settings/api", () => ({ fetchPanelAppearance }));

const appearance = (colorPrimary: string, logo: string): PanelAppearance => {
  const palette = {
    colorPrimary,
    colorBgBase: "#111111",
    colorBgContainer: "#333333",
    colorBorder: "#555555",
    colorLink: "#6699ff",
    colorTextBase: "#ffffff",
    colorTextDescription: "#cccccc",
  };
  return {
    darkLogo: { id: "synthetic", url: logo },
    darkTheme: palette,
    lightLogo: null,
    lightTheme: palette,
  };
};

const Consumer = () => {
  const { compact, settings, setAppearance, setCompact, setTheme, theme } =
    useCore();
  const { token } = antdTheme.useToken();

  return (
    <>
      <output>
        {settings.language.code}/{settings.language.direction}/{theme}/
        {String(compact)}
      </output>
      <output aria-label="Primary color">{token.colorPrimary}</output>
      <output aria-label="Primary hover color">
        {token.colorPrimaryHover}
      </output>
      <output aria-label="Configured logo">{settings.darkLogo?.url}</output>
      <button
        onClick={() => {
          setTheme("light");
          setCompact(true);
        }}
      >
        Change appearance
      </button>
      <button onClick={() => setAppearance(appearance("#bb2233", "/new-logo"))}>
        Apply saved appearance
      </button>
    </>
  );
};

beforeEach(() => {
  fetchPanelAppearance.mockReset();
  fetchPanelAppearance.mockRejectedValue(new Error("No appearance fixture"));
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("dir");
  document.documentElement.removeAttribute("lang");
  localStorage.clear();
});

describe("core appearance", () => {
  it("uses Ant Design's dark colors while remote appearance is unavailable", () => {
    render(
      <CoreProvider>
        <AntdProvider>
          <Consumer />
        </AntdProvider>
      </CoreProvider>,
    );

    const { colorPrimary, colorPrimaryHover } = antdTheme.getDesignToken({
      algorithm: antdTheme.darkAlgorithm,
    });
    expect(screen.getByText("en/ltr/dark/false")).toBeDefined();
    expect(screen.getByLabelText("Primary color").textContent).toBe(
      colorPrimary,
    );
    expect(screen.getByLabelText("Primary hover color").textContent).toBe(
      colorPrimaryHover,
    );
    expect(fetchPanelAppearance).toHaveBeenCalledExactlyOnceWith(
      expect.any(AbortSignal),
    );
  });

  it("uses Ant Design's light compact colors and persists the preferences", () => {
    render(
      <CoreProvider>
        <AntdProvider>
          <Consumer />
        </AntdProvider>
      </CoreProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Change appearance" }));

    const { colorPrimary, colorPrimaryHover } = antdTheme.getDesignToken({
      algorithm: [antdTheme.defaultAlgorithm, antdTheme.compactAlgorithm],
    });
    expect(screen.getByText("en/ltr/light/true")).toBeDefined();
    expect(screen.getByLabelText("Primary color").textContent).toBe(
      colorPrimary,
    );
    expect(screen.getByLabelText("Primary hover color").textContent).toBe(
      colorPrimaryHover,
    );
    expect(localStorage.getItem("theme")).toBe('"light"');
    expect(localStorage.getItem("compact")).toBe("true");
    expect(localStorage).toHaveLength(2);
  });

  it("applies the remote palette and logo after startup", async () => {
    const pending = deferred<PanelAppearance>();
    const saved = appearance("#228855", "/old-logo");
    fetchPanelAppearance.mockReturnValue(pending.promise);
    render(
      <CoreProvider>
        <AntdProvider>
          <Consumer />
        </AntdProvider>
      </CoreProvider>,
    );
    await act(async () => pending.resolve(saved));
    const { colorPrimary } = antdTheme.getDesignToken({
      algorithm: antdTheme.darkAlgorithm,
      token: saved.darkTheme,
    });
    expect(screen.getByLabelText("Primary color").textContent).toBe(
      colorPrimary,
    );
    expect(screen.getByLabelText("Configured logo").textContent).toBe(
      "/old-logo",
    );
  });

  it("keeps freshly saved appearance when the startup request resolves later", async () => {
    const pending = deferred<PanelAppearance>();
    fetchPanelAppearance.mockReturnValue(pending.promise);
    render(
      <CoreProvider>
        <AntdProvider>
          <Consumer />
        </AntdProvider>
      </CoreProvider>,
    );
    const signal = fetchPanelAppearance.mock.calls[0][0] as AbortSignal;
    fireEvent.click(
      screen.getByRole("button", { name: "Apply saved appearance" }),
    );
    expect(signal.aborted).toBe(true);
    await act(async () =>
      pending.resolve(appearance("#228855", "/stale-logo")),
    );
    const { colorPrimary } = antdTheme.getDesignToken({
      algorithm: antdTheme.darkAlgorithm,
      token: appearance("#bb2233", "/new-logo").darkTheme,
    });
    expect(screen.getByLabelText("Primary color").textContent).toBe(
      colorPrimary,
    );
    expect(screen.getByLabelText("Configured logo").textContent).toBe(
      "/new-logo",
    );
  });
});
