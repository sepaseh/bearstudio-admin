// @vitest-environment jsdom
import { act, fireEvent, waitFor } from "@testing-library/react";
import { CanceledError } from "axios";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { login } from "@/features/auth/api.ts";
import { AdminApiError } from "@/shared/api";
import { i18nInstance } from "@/shared/i18n/index.ts";
import { render, screen } from "@/test/render.tsx";

import { LoginPage } from "./Login.tsx";

const { appearance, messages } = vi.hoisted(() => ({
  appearance: { lightLogo: undefined as { url: string } | undefined },
  messages: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@/features/auth/api.ts", () => ({ login: vi.fn() }));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: messages }),
  useCore: () => ({
    settings: appearance,
    theme: "light",
  }),
}));

const Location = () => (
  <output aria-label="location">{useLocation().pathname}</output>
);
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/auth"]}>
      <Location />
      <Link to="/elsewhere">Leave</Link>
      <Routes>
        <Route element={<LoginPage />} path="/auth" />
        <Route element={<h1>Elsewhere</h1>} path="/elsewhere" />
        <Route element={<h1>Dashboard</h1>} path="/" />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  appearance.lightLogo = { url: "/custom-logo.svg" };
  await i18nInstance.changeLanguage("en");
  vi.mocked(login).mockReset().mockResolvedValue(undefined);
});

const fillCredentials = async (user: ReturnType<typeof render>["user"]) => {
  await user.type(
    screen.getByLabelText(i18nInstance.t("mobile")),
    "9120000000",
  );
  await user.type(
    screen.getByLabelText(i18nInstance.t("password"), { exact: true }),
    " secret ",
  );
};

describe("LoginPage", () => {
  it("shows the bundled React logo when no logo is configured", () => {
    appearance.lightLogo = undefined;
    renderPage();
    expect(
      screen.getByRole("img", { name: i18nInstance.t("logo") }),
    ).toHaveAttribute("src", "/logo.svg");
  });

  it("submits only the credentials and navigates after successful authentication", async () => {
    const { user } = renderPage();
    expect(
      screen.getByRole("img", { name: i18nInstance.t("logo") }),
    ).toHaveAttribute("src", "/custom-logo.svg");
    await fillCredentials(user);
    fireEvent.change(screen.getByLabelText(i18nInstance.t("mobile")), {
      target: { value: " ۹١۲۰۰۰۰۰۰۰ " },
    });
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("login") }),
    );
    await screen.findByRole("heading", { name: "Dashboard" });
    expect(login).toHaveBeenCalledWith(
      { mobile: "9120000000", password: " secret " },
      expect.any(AbortSignal),
    );
  });

  it.each(["09120000000", "+989120000000", "912 0000000"])(
    "rejects an unsupported mobile format %s",
    async (mobile) => {
      const { user } = renderPage();
      await fillCredentials(user);
      fireEvent.change(screen.getByLabelText(i18nInstance.t("mobile")), {
        target: { value: mobile },
      });
      await user.click(
        screen.getByRole("button", { name: i18nInstance.t("login") }),
      );
      await waitFor(() =>
        expect(screen.getByText(/Use ten digits/)).toBeVisible(),
      );
      expect(login).not.toHaveBeenCalled();
    },
  );

  it("prevents repeated form submissions while authentication is pending", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof login>>) => void;
    vi.mocked(login).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { container, user } = renderPage();
    await fillCredentials(user);
    const form = container.querySelector("form")!;
    fireEvent.submit(form);
    await waitFor(() => expect(login).toHaveBeenCalledOnce());

    await act(async () => {
      fireEvent.submit(form);
    });
    expect(login).toHaveBeenCalledOnce();
    expect(screen.getByLabelText(i18nInstance.t("mobile"))).toBeDisabled();
    await act(async () => {
      resolve(undefined);
    });
    await screen.findByRole("heading", { name: "Dashboard" });
    expect(login).toHaveBeenCalledOnce();
  });

  it("aborts an obsolete login and does not redirect after leaving the page", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof login>>) => void;
    vi.mocked(login).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { user } = renderPage();
    await fillCredentials(user);
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("login") }),
    );
    await waitFor(() => expect(login).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("link", { name: "Leave" }));
    await screen.findByRole("heading", { name: "Elsewhere" });
    await act(async () => {
      resolve(undefined);
    });
    expect(screen.getByLabelText("location")).toHaveTextContent("/elsewhere");
    expect(vi.mocked(login).mock.calls[0][1]?.aborted).toBe(true);
    expect(messages.error).not.toHaveBeenCalled();
  });

  it("shows a retryable server error and preserves entered credentials", async () => {
    vi.mocked(login).mockRejectedValueOnce(new Error("Temporarily offline"));
    const { user } = renderPage();
    await fillCredentials(user);
    const submit = screen.getByRole("button", {
      name: i18nInstance.t("login"),
    });
    await user.click(submit);
    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledWith("Temporarily offline"),
    );
    expect(screen.getByLabelText(i18nInstance.t("mobile"))).toHaveValue(
      "9120000000",
    );
    await user.click(submit);
    await screen.findByRole("heading", { name: "Dashboard" });
    expect(login).toHaveBeenCalledTimes(2);
  });

  it("shows an error notification for invalid credentials and leaves sign-in available", async () => {
    vi.mocked(login).mockRejectedValueOnce(
      new AdminApiError("The mobile number or password is incorrect.", 401, {
        code: "INVALID_CREDENTIALS",
      }),
    );
    const { user } = renderPage();
    await fillCredentials(user);
    const submit = screen.getByRole("button", {
      name: i18nInstance.t("login"),
    });
    await user.click(submit);

    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledExactlyOnceWith(
        "The mobile number or password is incorrect.",
      ),
    );
    expect(submit).toBeEnabled();
    expect(screen.getByLabelText("location")).toHaveTextContent("/auth");
  });

  it("uses the general sign-in error when the API also returns field details", async () => {
    const error = new AdminApiError("Check the supplied credentials.", 400, {
      code: "VALIDATION_FAILED",
      errors: { mobile: ["Enter the canonical mobile number."] },
    });
    vi.mocked(login).mockRejectedValueOnce(error);
    const { user } = renderPage();
    await fillCredentials(user);
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("login") }),
    );

    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledExactlyOnceWith(error.message),
    );
    expect(screen.queryByText("Enter the canonical mobile number.")).toBeNull();
    expect(screen.getByLabelText(i18nInstance.t("mobile"))).toHaveValue(
      "9120000000",
    );
  });

  it("does not show an error or navigate for a canceled login", async () => {
    vi.mocked(login).mockRejectedValueOnce(new CanceledError());
    const { user } = renderPage();
    await fillCredentials(user);
    await user.click(
      screen.getByRole("button", { name: i18nInstance.t("login") }),
    );
    await waitFor(() => expect(login).toHaveBeenCalledOnce());
    expect(messages.error).not.toHaveBeenCalled();
    expect(screen.getByLabelText("location")).toHaveTextContent("/auth");
  });
});
