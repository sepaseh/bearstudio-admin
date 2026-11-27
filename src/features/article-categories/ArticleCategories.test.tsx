import { act, fireEvent, waitFor, within } from "@testing-library/react";
import { CanceledError } from "axios";
import { MemoryRouter, Outlet, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdministratorSession } from "@/features/auth";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";
import { render, screen } from "@/test/render";

import {
  createArticleCategory,
  deleteArticleCategory,
  fetchArticleCategories,
  fetchArticleCategory,
  sortArticleCategories,
  updateArticleCategory,
} from "./api";
import { ArticleCategoriesPage } from "./ArticleCategories";
import type { ArticleCategory, ArticleCategoryCatalog } from "./types";

const { confirm, messages } = vi.hoisted(() => ({
  confirm: vi.fn<(options: { onOk: () => Promise<void> }) => void>(),
  messages: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("./api", () => ({
  createArticleCategory: vi.fn(),
  deleteArticleCategory: vi.fn(),
  fetchArticleCategories: vi.fn(),
  fetchArticleCategory: vi.fn(),
  sortArticleCategories: vi.fn(),
  updateArticleCategory: vi.fn(),
}));

vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: messages, modalAPI: { confirm } }),
}));

const guides: ArticleCategory = {
  slug: "guides",
  name: "Guides",
};
const releases: ArticleCategory = {
  ...guides,
  slug: "releases",
  name: "Release notes",
};
const categories = [guides, releases];
const catalog = (items = categories): ArticleCategoryCatalog => ({
  items,
});

const CategoryLocation = () => {
  const { hash, search } = useLocation();
  return <div aria-label="Category location">{search + hash}</div>;
};

const renderPage = (permissions: AdministratorSession["permissions"] = []) => {
  const currentUser: AdministratorSession = {
    id: "synthetic-category-editor",
    mobile: "9120000000",
    name: "Ada Lovelace",
    permissions: ["articles.read", ...permissions],
    roles: [],
  };

  return render(
    <MemoryRouter initialEntries={["/article-categories?view=list"]}>
      <Routes>
        <Route element={<Outlet context={{ currentUser }} />}>
          <Route
            path="/article-categories"
            element={
              <>
                <CategoryLocation />
                <ArticleCategoriesPage />
              </>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
};

const categoryNames = () =>
  screen
    .getAllByRole("cell", { name: /^(Guides|Release notes)$/ })
    .map((cell) => cell.textContent);

const requestDelete = async (user: ReturnType<typeof render>["user"]) => {
  const row = await screen.findByRole("row", { name: /Guides/ });
  await user.click(within(row).getByRole("button", { name: i18n.t("delete") }));
  expect(confirm).toHaveBeenCalledOnce();
  expect(deleteArticleCategory).not.toHaveBeenCalled();
  return confirm.mock.calls[0][0].onOk;
};

const startKeyboardReorder = async (
  user: ReturnType<typeof render>["user"],
) => {
  const originalRect = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      // Give the two draggable rows the geometry jsdom cannot calculate.
      const key =
        this.closest("tr[data-row-key]")?.getAttribute("data-row-key");
      const index = categories.findIndex(({ slug }) => slug === key);
      return index < 0
        ? originalRect.call(this)
        : new DOMRect(16, 48 + index * 48, 320, 48);
    },
  );
  const row = await screen.findByRole("row", { name: /Guides/ });
  const handle = within(row).getByRole("button", { name: i18n.t("order") });
  handle.focus();
  await user.keyboard("[Space]");
  await waitFor(() => expect(handle).toHaveAttribute("aria-pressed", "true"));
  await user.keyboard("[ArrowDown]");
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(releases.slug),
  );
  await user.keyboard("[Space]");
};

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(fetchArticleCategories).mockResolvedValue(catalog());
  vi.mocked(fetchArticleCategory).mockResolvedValue(guides);
  await i18n.changeLanguage("en");
});

describe("article categories page", () => {
  it("shows the server order and withholds write controls for readers", async () => {
    renderPage();

    const guidesRow = await screen.findByRole("row", { name: /Guides/ });
    expect(within(guidesRow).getByRole("cell", { name: "1" })).toBeVisible();
    expect(categoryNames()).toEqual([guides.name, releases.name]);
    for (const action of ["create", "update", "delete", "order"] as const) {
      expect(
        screen.queryByRole("button", { name: i18n.t(action) }),
      ).not.toBeInTheDocument();
    }
    expect(fetchArticleCategory).not.toHaveBeenCalled();
  });

  it("opens a blank create drawer and returns to the same category list on cancel", async () => {
    const { user } = renderPage(["articles.write"]);
    await screen.findByText(guides.name);
    await user.click(screen.getByRole("button", { name: i18n.t("create") }));

    const drawer = await screen.findByRole("dialog", {
      name: i18n.t("create"),
    });
    expect(
      await within(drawer).findByRole("textbox", { name: i18n.t("name") }),
    ).toHaveValue("");
    expect(screen.getByLabelText("Category location")).toHaveTextContent(
      "?view=list#create",
    );
    await user.click(
      within(drawer).getByRole("button", { name: i18n.t("cancel") }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Category location").textContent).toBe(
        "?view=list",
      );
    });
    expect(fetchArticleCategory).not.toHaveBeenCalled();
    expect(createArticleCategory).not.toHaveBeenCalled();
  });

  it("opens the selected category and reloads the list when its edit succeeds", async () => {
    const updated = { ...releases, name: "Changelog" };
    vi.mocked(fetchArticleCategory).mockResolvedValue(releases);
    vi.mocked(fetchArticleCategories)
      .mockResolvedValueOnce(catalog())
      .mockResolvedValueOnce(catalog([guides, updated]));
    vi.mocked(updateArticleCategory).mockResolvedValue(updated);
    const { user } = renderPage(["articles.write"]);
    const row = await screen.findByRole("row", { name: /Release notes/ });

    await user.click(
      within(row).getByRole("button", { name: i18n.t("update") }),
    );
    const drawer = await screen.findByRole("dialog", {
      name: i18n.t("update"),
    });
    expect(screen.getByLabelText("Category location")).toHaveTextContent(
      "?view=list#update",
    );
    fireEvent.change(await within(drawer).findByDisplayValue(releases.name), {
      target: { value: updated.name },
    });
    await user.click(
      within(drawer).getByRole("button", { name: i18n.t("submit") }),
    );

    expect(
      await screen.findByRole("cell", { name: updated.name }),
    ).toBeVisible();
    expect(fetchArticleCategory).toHaveBeenCalledExactlyOnceWith(
      releases.slug,
      expect.any(AbortSignal),
    );
    expect(fetchArticleCategories).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(screen.getByLabelText("Category location").textContent).toBe(
        "?view=list",
      ),
    );
  });

  it("waits for confirmed deletion before refreshing rows", async () => {
    const pending = deferred<void>();
    vi.mocked(deleteArticleCategory).mockReturnValue(pending.promise);
    vi.mocked(fetchArticleCategories)
      .mockResolvedValueOnce(catalog())
      .mockResolvedValueOnce(catalog([releases]));
    const { user } = renderPage(["articles.write"]);
    const onOk = await requestDelete(user);
    let confirmed!: Promise<void>;
    act(() => {
      confirmed = onOk();
    });

    expect(deleteArticleCategory).toHaveBeenCalledExactlyOnceWith(
      guides.slug,
      expect.any(AbortSignal),
    );
    expect(fetchArticleCategories).toHaveBeenCalledOnce();
    expect(screen.getByText(guides.name)).toBeVisible();
    for (const button of screen.getAllByRole("button", {
      name: i18n.t("delete"),
    })) {
      expect(button).toBeDisabled();
    }
    await act(async () => {
      pending.resolve();
      await confirmed;
    });

    expect(categoryNames()).toEqual([releases.name]);
    expect(messages.success).toHaveBeenCalledExactlyOnceWith(i18n.t("deleted"));
    expect(fetchArticleCategories).toHaveBeenCalledTimes(2);
  });

  it("reports a rejected delete, preserves the list and allows another attempt", async () => {
    vi.mocked(deleteArticleCategory).mockRejectedValue(
      new Error("Category is in use"),
    );
    const { user } = renderPage(["articles.write"]);
    const onOk = await requestDelete(user);

    await act(async () => {
      await onOk();
    });

    expect(categoryNames()).toEqual([guides.name, releases.name]);
    expect(messages.error).toHaveBeenCalledExactlyOnceWith(
      "Category is in use",
    );
    expect(messages.success).not.toHaveBeenCalled();
    expect(fetchArticleCategories).toHaveBeenCalledOnce();
    const row = screen.getByRole("row", { name: /Guides/ });
    expect(
      within(row).getByRole("button", { name: i18n.t("delete") }),
    ).toBeEnabled();
  });

  it("saves the keyboard order and renders it only after the server accepts it", async () => {
    const pending = deferred<void>();
    vi.mocked(sortArticleCategories).mockReturnValue(pending.promise);
    vi.mocked(fetchArticleCategories)
      .mockResolvedValueOnce(catalog())
      .mockResolvedValueOnce(catalog([releases, guides]));
    const { user } = renderPage(["articles.write"]);
    await startKeyboardReorder(user);

    expect(sortArticleCategories).toHaveBeenCalledExactlyOnceWith(
      {
        slugs: [releases.slug, guides.slug],
      },
      expect.any(AbortSignal),
    );
    expect(categoryNames()).toEqual([guides.name, releases.name]);
    expect(fetchArticleCategories).toHaveBeenCalledOnce();
    for (const handle of screen.getAllByRole("button", {
      name: i18n.t("order"),
    })) {
      expect(handle).toBeDisabled();
    }

    await act(async () => pending.resolve());
    await waitFor(() =>
      expect(categoryNames()).toEqual([releases.name, guides.name]),
    );
    expect(messages.success).toHaveBeenCalledExactlyOnceWith(
      i18n.t("contentSaved"),
    );
  });

  it("keeps the accepted order if the server rejects a reorder", async () => {
    vi.mocked(sortArticleCategories).mockRejectedValue(
      new Error("Order was rejected"),
    );
    const { user } = renderPage(["articles.write"]);
    await startKeyboardReorder(user);

    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledExactlyOnceWith(
        "Order was rejected",
      ),
    );
    expect(messages.success).not.toHaveBeenCalled();
    expect(categoryNames()).toEqual([guides.name, releases.name]);
    expect(fetchArticleCategories).toHaveBeenCalledTimes(2);
    for (const handle of screen.getAllByRole("button", {
      name: i18n.t("order"),
    })) {
      expect(handle).toBeEnabled();
    }
  });

  it.each([
    [new Error("Categories are unavailable"), true],
    [new CanceledError(), false],
  ])("handles a list rejection of type %s", async (error, showFallback) => {
    const pending = deferred<ArticleCategoryCatalog>();
    vi.mocked(fetchArticleCategories).mockReturnValue(pending.promise);
    renderPage();

    await act(async () => pending.reject(error));

    expect(screen.queryByText(guides.name)).not.toBeInTheDocument();
    const feedback = screen.queryByText(i18n.t("unexpectedError"));
    if (showFallback) expect(feedback).toBeVisible();
    else expect(feedback).not.toBeInTheDocument();
    expect(screen.queryByText("Categories are unavailable")).toBeNull();
    expect(messages.error).not.toHaveBeenCalled();
  });

  it("aborts its list read on unmount and ignores a late failure", async () => {
    const pending = deferred<ArticleCategoryCatalog>();
    vi.mocked(fetchArticleCategories).mockReturnValue(pending.promise);
    const { unmount } = renderPage();
    const signal = vi.mocked(fetchArticleCategories).mock.calls[0][0];
    unmount();
    await act(async () => pending.reject(new Error("Obsolete list response")));

    expect(signal?.aborted).toBe(true);
    expect(messages.error).not.toHaveBeenCalled();
  });
});
