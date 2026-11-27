// @vitest-environment jsdom
import { act, fireEvent, waitFor, within } from "@testing-library/react";
import type * as ReactI18next from "react-i18next";
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useOutletContext,
} from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type AdministratorSession,
  fetchSession,
  login,
  logout,
} from "@/features/auth";
import type * as SharedApi from "@/shared/api";
import {
  AdminApiError,
  advanceSession,
  setUnauthorizedHandler,
} from "@/shared/api";
import { deferred } from "@/test/deferred";
import { render, screen } from "@/test/render";

import { DefaultLayout } from "./Default";
import type { DefaultLayoutContext } from "./types";

const mocks = vi.hoisted(() => {
  const account: AdministratorSession = {
    id: "user-1",
    name: "Ada Lovelace",
    mobile: "9120000000",
    permissions: ["users.read"],
    roles: [],
  };

  return {
    account,
    messages: { error: vi.fn() },
    reloadFinished: vi.fn(),
    core: {
      compact: false,
      currentRoute: "root",
      settings: {
        darkLogo: { url: "/dark-logo.svg" },
        lightLogo: { url: "/light-logo.svg" },
        language: { direction: "ltr" },
      },
      setCompact: vi.fn(),
      setTheme: vi.fn(),
      theme: "light",
    },
  };
});

vi.mock("@/features/auth", () => ({
  fetchSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    advanceSession: vi.fn(
      (...args: Parameters<typeof SharedApi.advanceSession>) =>
        actual.advanceSession(...args),
    ),
    setUnauthorizedHandler: vi.fn(),
  };
});

vi.mock("@/app/hooks", () => ({
  useCore: () => mocks.core,
  useAntd: () => ({
    messageAPI: mocks.messages,
    token: {
      colorBgLayout: "#f5f5f5",
      marginMD: 16,
      paddingMD: 16,
      paddingSM: 8,
      paddingXS: 4,
      size: 16,
      screenXXXL: 1920,
    },
  }),
}));

vi.mock("@/app/lib", () => ({
  getAllowedNavigation: () => [
    { route: "root" },
    {
      children: [{ route: "users" }, { route: "roles" }],
      key: "userManagement",
      label: "userManagement",
    },
  ],
}));

vi.mock("antd-style", () => ({
  useResponsive: () => ({ lg: false }),
  useAntdToken: () => ({
    colorBgContainer: "#ffffff",
    colorBgLayout: "#f5f5f5",
    colorTextBase: "#222222",
    marginMD: 16,
    paddingMD: 16,
    paddingSM: 8,
    screenXXXL: 1920,
  }),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactI18next>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const Location = () => {
  const location = useLocation();
  return <output aria-label="location">{location.pathname}</output>;
};

const ContextConsumer = () => {
  const { clearSession, currentUser, fetchCurrentUser, handleAccessError } =
    useOutletContext<DefaultLayoutContext<AdministratorSession>>();

  return (
    <>
      <input aria-label="Unsaved child content" defaultValue="Draft" />
      <output aria-label="account identity">
        {currentUser.id}/{currentUser.name}
      </output>
      <button
        onClick={async () => {
          await fetchCurrentUser();
          mocks.reloadFinished();
        }}
        type="button"
      >
        Refresh account
      </button>
      <button onClick={clearSession} type="button">
        Clear session
      </button>
      <button
        onClick={() =>
          handleAccessError?.(
            new AdminApiError("Sign in again", 403, {
              code: "REAUTH_REQUIRED",
            }),
          )
        }
        type="button"
      >
        Require a fresh sign-in
      </button>
    </>
  );
};

const renderLayout = (content = <h1>Dashboard content</h1>) =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Location />
      <Routes>
        <Route element={<DefaultLayout />} path="/">
          <Route index element={content} />
          <Route element={<h1>Users content</h1>} path="users" />
        </Route>
        <Route element={<h1>Authentication</h1>} path="/auth" />
      </Routes>
    </MemoryRouter>,
  );

const renderLoadedLayout = async () => {
  const value = renderLayout();
  await screen.findByRole("heading", { name: "Dashboard content" });
  return value;
};

let navigationRouter: ReturnType<typeof createMemoryRouter> | undefined;
afterEach(() => {
  navigationRouter?.dispose();
  navigationRouter = undefined;
});

beforeEach(() => {
  advanceSession();
  vi.mocked(advanceSession).mockClear();
  mocks.core.compact = false;
  mocks.core.currentRoute = "root";
  mocks.core.theme = "light";
  vi.mocked(fetchSession).mockResolvedValue(mocks.account);
  vi.mocked(logout).mockResolvedValue(undefined);
});

describe("DefaultLayout", () => {
  it("signs in as the current operator and retains the open screen for explicit retry", async () => {
    vi.mocked(login).mockResolvedValueOnce(undefined);
    renderLayout(<ContextConsumer />);
    const draft = await screen.findByLabelText("Unsaved child content");
    fireEvent.change(draft, { target: { value: "Pending change" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Require a fresh sign-in" }),
    );

    const modal = await screen.findByRole("dialog", {
      name: "accessSignInAgain",
    });
    const username = within(modal).getByLabelText("mobile");
    expect(username).toHaveValue(mocks.account.mobile);
    expect(username).toHaveAttribute("readonly");
    const password = " synthetic password ";
    fireEvent.change(within(modal).getByLabelText("password"), {
      target: { value: password },
    });
    fireEvent.click(within(modal).getByRole("button", { name: "login" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(login).toHaveBeenCalledWith(
      { mobile: mocks.account.mobile, password },
      expect.any(AbortSignal),
    );
    expect(fetchSession).toHaveBeenCalledTimes(2);
    expect(draft).toHaveValue("Pending change");
    expect(screen.getByLabelText("location")).toHaveTextContent("/");
  });

  it("retries only the session read after sign-in succeeds and session loading fails", async () => {
    vi.mocked(login).mockResolvedValueOnce(undefined);
    vi.mocked(fetchSession)
      .mockResolvedValueOnce(mocks.account)
      .mockRejectedValueOnce(new Error("Session temporarily unavailable"))
      .mockResolvedValueOnce(mocks.account);
    renderLayout(<ContextConsumer />);
    const draft = await screen.findByLabelText("Unsaved child content");
    fireEvent.change(draft, { target: { value: "Pending change" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Require a fresh sign-in" }),
    );

    const modal = within(
      await screen.findByRole("dialog", { name: "accessSignInAgain" }),
    );
    fireEvent.change(modal.getByLabelText("password"), {
      target: { value: "synthetic temporary password" },
    });
    fireEvent.click(modal.getByRole("button", { name: "login" }));

    expect(
      await modal.findByText("Session temporarily unavailable"),
    ).toBeInTheDocument();
    expect(modal.queryByLabelText("password")).not.toBeInTheDocument();
    expect(modal.getByRole("button", { name: "cancel" })).toBeDisabled();
    fireEvent.click(modal.getByRole("button", { name: "retry" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(login).toHaveBeenCalledOnce();
    expect(fetchSession).toHaveBeenCalledTimes(3);
    expect(draft).toHaveValue("Pending change");
  });
  it("exposes the accepted account, awaited reload and session cleanup to its children", async () => {
    const response = deferred<AdministratorSession>();
    const updated = { ...mocks.account, name: "Updated" };
    vi.mocked(fetchSession)
      .mockResolvedValueOnce(mocks.account)
      .mockReturnValueOnce(response.promise);
    const { user } = renderLayout(<ContextConsumer />);

    expect(await screen.findByLabelText("account identity")).toHaveTextContent(
      mocks.account.id,
    );
    await user.click(screen.getByRole("button", { name: "Refresh account" }));
    expect(fetchSession).toHaveBeenCalledTimes(2);
    expect(mocks.reloadFinished).not.toHaveBeenCalled();

    response.resolve(updated);
    await waitFor(() =>
      expect(screen.getByLabelText("account identity")).toHaveTextContent(
        "Updated",
      ),
    );
    await waitFor(() => expect(mocks.reloadFinished).toHaveBeenCalledOnce());

    await user.click(screen.getByRole("button", { name: "Clear session" }));
    expect(advanceSession).toHaveBeenCalledOnce();
    await screen.findByRole("heading", { name: "Authentication" });
  });

  it.each(["pointer", "keyboard"])(
    "closes the mobile drawer after %s navigation without remounting the layout",
    async (interaction) => {
      navigationRouter = createMemoryRouter([
        {
          path: "/",
          element: <DefaultLayout />,
          children: [
            { index: true, element: <h1>Dashboard content</h1> },
            { path: "users", element: <h1>Users content</h1> },
          ],
        },
      ]);
      const { user } = render(<RouterProvider router={navigationRouter} />);
      await screen.findByRole("heading", { name: "Dashboard content" });
      await user.click(screen.getByRole("button", { name: "menu" }));
      const drawer = await screen.findByRole("dialog");
      await user.click(within(drawer).getByText("userManagement"));
      const link = within(drawer).getByRole("link", { name: "users" });

      if (interaction === "keyboard") {
        link.focus();
        await user.keyboard("{Enter}");
      } else {
        await user.click(link);
      }

      expect(
        await screen.findByRole("heading", { name: "Users content" }),
      ).toBeVisible();
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(fetchSession).toHaveBeenCalledOnce();
    },
  );

  it("closes the mobile drawer when selecting the current route", async () => {
    const { user } = await renderLoadedLayout();
    await user.click(screen.getByRole("button", { name: "menu" }));
    const drawer = await screen.findByRole("dialog");

    await user.click(within(drawer).getByRole("link", { name: "dashboard" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("heading", { name: "Dashboard content" }),
    ).toBeVisible();
    expect(fetchSession).toHaveBeenCalledOnce();
  });

  it("constrains the header and page content to the shared container", async () => {
    const { container } = await renderLoadedLayout();
    const headerContent = container.querySelector("header")?.firstElementChild;
    const main = container.querySelector("main");

    expect(headerContent).toHaveStyle({
      marginInline: "auto",
      maxWidth: "1920px",
    });
    expect(main).toHaveStyle({
      backgroundColor: "#f5f5f5",
      marginInline: "auto",
      maxWidth: "1920px",
    });
  });

  it("shows the active page hierarchy in a breadcrumb", async () => {
    mocks.core.currentRoute = "users";

    await renderLoadedLayout();

    const breadcrumb = screen.getByRole("navigation", { name: "breadcrumb" });
    expect(breadcrumb).toHaveTextContent("dashboard/userManagement/users");
    expect(
      within(breadcrumb).getByRole("link", { name: "dashboard" }),
    ).toHaveAttribute("href", "/");
  });

  it("loads the account, registers session handling, and logs out", async () => {
    const { unmount, user } = await renderLoadedLayout();

    expect(
      screen.getByRole("heading", { name: "Dashboard content" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "logo" })).toBeVisible();
    expect(screen.getByRole("img", { name: "logo" })).toHaveAttribute(
      "src",
      "/light-logo.svg",
    );
    await waitFor(() => expect(fetchSession).toHaveBeenCalledOnce());
    expect(setUnauthorizedHandler).toHaveBeenCalledWith(expect.any(Function));

    await user.click(screen.getByRole("button", { name: "account" }));
    await user.click(await screen.findByText("logout"));

    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(advanceSession).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.getByLabelText("location")).toHaveTextContent("/auth"),
    );

    unmount();
    expect(setUnauthorizedHandler).toHaveBeenLastCalledWith(null);
  });

  it("shows the account name beside the user icon as a tooltip", async () => {
    const { user } = await renderLoadedLayout();

    await user.hover(screen.getByRole("button", { name: "account" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Ada Lovelace",
    );
  });

  it("clears the session for a rejected authentication check", async () => {
    vi.mocked(fetchSession).mockRejectedValueOnce(
      new AdminApiError("Unauthorized", 401),
    );

    renderLayout();

    await waitFor(() =>
      expect(screen.getByLabelText("location")).toHaveTextContent("/auth"),
    );
    expect(advanceSession).toHaveBeenCalledOnce();
  });

  it("shows a loading state while the account is unavailable", () => {
    vi.mocked(fetchSession).mockReturnValueOnce(new Promise(() => undefined));

    const { container } = renderLayout();

    expect(container.querySelector(".ant-spin")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "logo" }),
    ).not.toBeInTheDocument();
  });

  it("changes theme from the account menu", async () => {
    const { user } = await renderLoadedLayout();

    await user.click(screen.getByRole("button", { name: "account" }));
    await user.click(await screen.findByText("darkMode"));

    expect(mocks.core.setTheme).toHaveBeenCalledWith("dark");
  });

  it("toggles compact mode from the item before logout", async () => {
    const { user } = await renderLoadedLayout();

    await user.click(screen.getByRole("button", { name: "account" }));
    const compactItem = await screen.findByText("compactMode");
    const logoutItem = await screen.findByText("logout");
    expect(
      compactItem.compareDocumentPosition(logoutItem) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await user.click(compactItem);

    expect(mocks.core.setCompact).toHaveBeenCalledWith(true);
  });

  it("offers normal mode when compact mode is active", async () => {
    mocks.core.compact = true;
    const { user } = await renderLoadedLayout();

    await user.click(screen.getByRole("button", { name: "account" }));
    await user.click(await screen.findByText("normalMode"));

    expect(mocks.core.setCompact).toHaveBeenCalledWith(false);
  });

  it("keeps the session and allows retry when remote logout fails", async () => {
    vi.mocked(logout).mockRejectedValueOnce(new Error("Offline"));
    const { user } = await renderLoadedLayout();

    await user.click(screen.getByRole("button", { name: "account" }));
    await user.click(await screen.findByText("logout"));

    await waitFor(() =>
      expect(mocks.messages.error).toHaveBeenCalledWith("Offline"),
    );
    expect(advanceSession).not.toHaveBeenCalled();
    expect(screen.getByLabelText("location")).toHaveTextContent(/^\/$/);

    await waitFor(() => expect(screen.queryByText("logout")).not.toBeVisible());
    await user.click(screen.getByRole("button", { name: "account" }));
    const retry = await screen.findByRole("menuitem", { name: "logout" });
    await user.click(retry);
    await screen.findByRole("heading", { name: "Authentication" });
    expect(advanceSession).toHaveBeenCalledOnce();
  });

  it("returns to sign-in when logout reports an expired session", async () => {
    vi.mocked(logout).mockRejectedValueOnce(
      new AdminApiError("Unauthorized", 401),
    );
    const { user } = await renderLoadedLayout();

    await user.click(screen.getByRole("button", { name: "account" }));
    await user.click(await screen.findByText("logout"));

    await screen.findByRole("heading", { name: "Authentication" });
    expect(advanceSession).toHaveBeenCalledOnce();
  });

  it("lets the user log out after an account permission denial", async () => {
    vi.mocked(fetchSession).mockRejectedValueOnce(
      new AdminApiError("Forbidden", 403),
    );
    const { user } = renderLayout();

    const logoutButton = await screen.findByRole("button", { name: "logout" });
    expect(advanceSession).not.toHaveBeenCalled();
    await user.click(logoutButton);

    await waitFor(() =>
      expect(screen.getByLabelText("location")).toHaveTextContent("/auth"),
    );
    expect(logout).toHaveBeenCalledOnce();
    expect(advanceSession).toHaveBeenCalledOnce();
  });

  it.each([
    new Error("Temporarily offline"),
    new AdminApiError("Forbidden", 403),
  ])("keeps the session and offers retry after $message", async (error) => {
    vi.mocked(fetchSession).mockRejectedValueOnce(error);
    const { user } = renderLayout();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "unexpectedError",
    );
    expect(screen.queryByText(error.message)).not.toBeInTheDocument();
    expect(advanceSession).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("heading", { name: "Dashboard content" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "retry" }));
    await screen.findByRole("heading", { name: "Dashboard content" });
    expect(fetchSession).toHaveBeenCalledTimes(2);
  });

  it("keeps accepted identity and child input mounted when a refresh fails", async () => {
    const pending = deferred<AdministratorSession>();
    vi.mocked(fetchSession)
      .mockResolvedValueOnce(mocks.account)
      .mockReturnValueOnce(pending.promise);
    const { user } = renderLayout(<ContextConsumer />);
    const input = await screen.findByLabelText("Unsaved child content");
    await user.type(input, " remains");
    await user.click(screen.getByRole("button", { name: "Refresh account" }));
    expect(screen.getByLabelText("Unsaved child content")).toBe(input);
    expect(input).toHaveValue("Draft remains");

    await act(async () => pending.reject(new Error("Refresh unavailable")));

    expect(screen.queryByText("Refresh unavailable")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "retry" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Unsaved child content")).toBe(input);
    expect(input).toHaveValue("Draft remains");
    expect(screen.getByLabelText("account identity")).toHaveTextContent(
      mocks.account.id,
    );
    expect(fetchSession).toHaveBeenCalledTimes(2);
  });

  it("aborts the owned current-user read and ignores its late rejection on unmount", async () => {
    const pending = deferred<AdministratorSession>();
    vi.mocked(fetchSession).mockReturnValueOnce(pending.promise);
    const { unmount } = renderLayout();
    const signal = vi.mocked(fetchSession).mock.calls[0][0]!;
    unmount();

    await act(async () => pending.reject(new Error("Obsolete current user")));

    expect(signal.aborted).toBe(true);
    expect(mocks.messages.error).not.toHaveBeenCalled();
    expect(advanceSession).not.toHaveBeenCalled();
    expect(setUnauthorizedHandler).toHaveBeenLastCalledWith(null);
  });

  it("ignores an earlier-session current-user failure after a new login", async () => {
    const pending = deferred<AdministratorSession>();
    vi.mocked(fetchSession)
      .mockResolvedValueOnce(mocks.account)
      .mockReturnValueOnce(pending.promise);
    const { user } = renderLayout(<ContextConsumer />);
    await screen.findByLabelText("account identity");
    await user.click(screen.getByRole("button", { name: "Refresh account" }));
    advanceSession();
    vi.mocked(advanceSession).mockClear();

    await act(async () =>
      pending.reject(new AdminApiError("Obsolete unauthorized", 401)),
    );

    expect(screen.getByLabelText("account identity")).toHaveTextContent(
      mocks.account.id,
    );
    expect(screen.queryByText("Obsolete unauthorized")).toBeNull();
    expect(advanceSession).not.toHaveBeenCalled();
    expect(screen.getByLabelText("location")).toHaveTextContent(/^\/$/);
  });

  it("rejects duplicate logout intent before its request settles", async () => {
    const pending = deferred<void>();
    vi.mocked(logout).mockReturnValueOnce(pending.promise);
    const { user } = await renderLoadedLayout();
    await user.click(screen.getByRole("button", { name: "account" }));
    const action = await screen.findByRole("menuitem", { name: "logout" });
    fireEvent.click(action);
    fireEvent.click(action);
    expect(logout).toHaveBeenCalledOnce();

    await act(async () => pending.resolve(undefined));

    await screen.findByRole("heading", { name: "Authentication" });
    expect(advanceSession).toHaveBeenCalledOnce();
  });

  it.each(["success", "failure"])(
    "keeps a newer login when an old logout finishes with %s",
    async (outcome) => {
      const pending = deferred<void>();
      vi.mocked(logout).mockReturnValueOnce(pending.promise);
      const { user } = await renderLoadedLayout();
      await user.click(screen.getByRole("button", { name: "account" }));
      await user.click(await screen.findByRole("menuitem", { name: "logout" }));
      advanceSession();
      vi.mocked(advanceSession).mockClear();

      await act(async () =>
        outcome === "success"
          ? pending.resolve(undefined)
          : pending.reject(new Error("Obsolete logout failure")),
      );

      expect(
        await screen.findByRole("heading", { name: "Dashboard content" }),
      ).toBeVisible();
      expect(advanceSession).not.toHaveBeenCalled();
      expect(mocks.messages.error).not.toHaveBeenCalled();
      expect(screen.getByLabelText("location")).toHaveTextContent(/^\/$/);
    },
  );
});
