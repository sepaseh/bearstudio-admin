// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { CanceledError } from "axios";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchRoles } from "@/features/roles";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";

import { fetchUsers } from "./api";
import type { ManagedUser } from "./types";
import { UsersPage } from "./Users";

const userForm = vi.hoisted(() =>
  vi.fn<(props: { onFinish: () => void }) => void>(),
);

vi.mock("./api", () => ({
  fetchUsers: vi.fn(),
}));
vi.mock("./components/user-form", () => ({
  UserForm: (props: { onFinish: () => void }) => {
    userForm(props);
    return null;
  },
}));
vi.mock("./components/user-role-form", () => ({ UserRoleForm: () => null }));
vi.mock("@/features/roles", () => ({ fetchRoles: vi.fn() }));

const operator: ManagedUser = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Ada Lovelace",
  mobile: "9120000000",
  isActive: true,
  roles: [{ id: "22222222-2222-4222-8222-222222222222", name: "Reader" }],
};
const currentUser = { id: operator.id, permissions: ["users.read"] };
const renderPage = (entry = "/users") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<Outlet context={{ currentUser }} />}>
          <Route path="/users" element={<UsersPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  vi.resetAllMocks();
  currentUser.permissions = ["users.read"];
  vi.mocked(fetchUsers).mockResolvedValue([operator]);
  vi.mocked(fetchRoles).mockResolvedValue([]);
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

describe("users listing", () => {
  it("shows the complete ordered list and hides privileged actions for a read-only account", async () => {
    const users = [
      operator,
      ...Array.from({ length: 24 }, (_, index) => ({
        ...operator,
        id: `user-${index + 1}`,
        name: `User ${String(index + 1).padStart(2, "0")}`,
      })),
    ];
    vi.mocked(fetchUsers).mockResolvedValue(users);
    renderPage("/users?name=Ada&mobile=912&page=2");

    await screen.findByText("User 24");
    expect(fetchUsers).toHaveBeenCalledExactlyOnceWith(expect.any(AbortSignal));
    const [, ...rows] = screen.getAllByRole("row");
    expect(rows).toHaveLength(users.length);
    expect(rows[0]).toHaveTextContent(operator.name);
    expect(rows.at(-1)).toHaveTextContent("User 24");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /next page/i }),
    ).not.toBeInTheDocument();
    expect(fetchRoles).not.toHaveBeenCalled();
    for (const action of [
      "create",
      "update",
      "delete",
      "password",
      "roles",
    ] as const) {
      expect(screen.queryByRole("button", { name: i18n.t(action) })).toBeNull();
    }
  });

  it("shows each assigned role separately and a dash for an empty assignment", async () => {
    vi.mocked(fetchUsers).mockResolvedValue([
      {
        ...operator,
        roles: [...operator.roles, { id: "editor-role", name: "Editor" }],
      },
      { ...operator, id: "without-roles", name: "Grace Hopper", roles: [] },
    ]);
    renderPage();

    const assigned = within(await screen.findByRole("row", { name: /Ada/ }));
    expect(assigned.getByText("Reader")).toBeVisible();
    expect(assigned.getByText("Editor")).toBeVisible();
    const unassigned = within(screen.getByRole("row", { name: /Grace/ }));
    expect(unassigned.getByRole("cell", { name: "-" })).toBeVisible();
  });

  it("offers a generic retry after the initial list fails and accepts an empty list", async () => {
    const initial = deferred<ManagedUser[]>();
    const retry = deferred<ManagedUser[]>();
    vi.mocked(fetchUsers)
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(retry.promise);
    renderPage();
    expect(screen.queryByText(i18n.t("unexpectedError"))).toBeNull();

    await act(async () => initial.reject(new Error("Synthetic read failure")));

    expect(screen.getByText(i18n.t("unexpectedError"))).toBeVisible();
    expect(screen.queryByText("Synthetic read failure")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("retry") }));
    expect(fetchUsers).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(i18n.t("unexpectedError"))).toBeNull();

    await act(async () => retry.resolve([]));

    expect(screen.getByRole("table")).toBeVisible();
    expect(screen.queryByText(i18n.t("unexpectedError"))).toBeNull();
  });

  it("does not show the initial error after a canceled read", async () => {
    const initial = deferred<ManagedUser[]>();
    vi.mocked(fetchUsers).mockReturnValueOnce(initial.promise);
    renderPage();

    await act(async () => initial.reject(new CanceledError()));

    expect(screen.queryByText(i18n.t("unexpectedError"))).toBeNull();
  });

  it("keeps accepted rows and their actions usable after a failed refresh", async () => {
    currentUser.permissions = ["users.read", "users.write"];
    const refresh = deferred<ManagedUser[]>();
    vi.mocked(fetchUsers)
      .mockResolvedValueOnce([operator])
      .mockReturnValueOnce(refresh.promise);
    renderPage();
    await screen.findByText(operator.name);
    act(() => userForm.mock.lastCall![0].onFinish());
    expect(
      screen.getByRole("button", { name: i18n.t("update") }),
    ).toBeDisabled();

    await act(async () =>
      refresh.reject(new Error("Synthetic refresh failure")),
    );

    expect(screen.getByText(operator.name)).toBeVisible();
    expect(
      screen.getByRole("button", { name: i18n.t("update") }),
    ).toBeEnabled();
    expect(screen.queryByText(i18n.t("unexpectedError"))).toBeNull();
  });

  it("aborts a superseded refresh and keeps the latest rows", async () => {
    const stale = deferred<ManagedUser[]>();
    vi.mocked(fetchUsers)
      .mockResolvedValueOnce([operator])
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce([{ ...operator, name: "Grace Lovelace" }]);
    currentUser.permissions = ["users.read", "users.write"];
    renderPage();
    await screen.findByText(operator.name);
    act(() => userForm.mock.lastCall![0].onFinish());
    const oldSignal = vi.mocked(fetchUsers).mock.lastCall![0]!;
    act(() => userForm.mock.lastCall![0].onFinish());
    await screen.findByText("Grace Lovelace");
    expect(oldSignal.aborted).toBe(true);

    await act(async () => {
      stale.resolve([operator]);
    });

    expect(screen.queryByText("Ada Lovelace")).toBeNull();
    expect(screen.getByText("Grace Lovelace")).toBeDefined();
  });

  it("offers account edits and managed password without a roles privilege or unsupported actions", async () => {
    currentUser.permissions = ["users.read", "users.write"];
    renderPage();
    await screen.findByText("Ada Lovelace");

    expect(screen.getByText("Reader")).toBeVisible();
    expect(
      screen.getByRole("button", { name: i18n.t("create") }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: i18n.t("update") }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: i18n.t("password") }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: i18n.t("roles") }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: i18n.t("delete") }),
    ).not.toBeInTheDocument();
    expect(fetchRoles).not.toHaveBeenCalled();
  });
});
