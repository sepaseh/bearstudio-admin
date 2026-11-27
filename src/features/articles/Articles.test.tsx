// @vitest-environment jsdom

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ConfigProvider, type ModalFuncProps } from "antd";
import { MemoryRouter, Outlet, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchArticleCategories } from "@/features/article-categories";
import type { AdministratorSession } from "@/features/auth";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";

import { deleteArticle, fetchArticle, fetchArticles } from "./api";
import { ArticlesPage } from "./Articles";
import type { Article, ArticleSummary } from "./types";

const { messages, modal } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
  modal: { confirm: vi.fn<(options: ModalFuncProps) => void>() },
}));
vi.mock("./api", () => ({
  createArticle: vi.fn(),
  deleteArticle: vi.fn(),
  fetchArticle: vi.fn(),
  fetchArticles: vi.fn(),
  updateArticle: vi.fn(),
}));
vi.mock("@/features/article-categories", () => ({
  fetchArticleCategories: vi.fn(),
}));
vi.mock("@/features/files", () => ({ ManagedImagePicker: () => null }));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({
    messageAPI: messages,
    modalAPI: modal,
    token: { marginLG: 24 },
  }),
  useCore: () => ({
    settings: {
      language: { direction: "ltr" },
    },
  }),
}));

const category = {
  slug: "category-1",
  name: "Documentation",
} as const;
const catalog = { items: [category] };
const guide: Article = {
  body: "<p>Manage your account.</p>",
  category,
  cover: {
    id: "guide-cover",
    url: "/api/v1/public/images/guide-cover",
    thumb: "/api/v1/public/images/guide-cover/thumbnail",
  },
  slug: "account-guide",
  excerpt: "Account settings and preferences.",
  id: "guide-1",
  title: "Account guide",
};
const reader: AdministratorSession = {
  id: "synthetic-admin",
  mobile: "9120000000",
  name: "Ada Lovelace",
  permissions: ["articles.read"],
  roles: [],
};

const LocationDisplay = () => {
  const { pathname, search, hash } = useLocation();
  return (
    <output aria-label="Current location">{pathname + search + hash}</output>
  );
};

const renderPage = (
  path = "/articles",
  permissions: AdministratorSession["permissions"] = reader.permissions,
) =>
  render(
    // jsdom cannot complete CSS transitions. Keep the real drawer callbacks.
    <ConfigProvider theme={{ token: { motion: false } }}>
      <MemoryRouter initialEntries={[path]}>
        <LocationDisplay />
        <Routes>
          <Route
            element={
              <Outlet context={{ currentUser: { ...reader, permissions } }} />
            }
          >
            <Route path="/articles" element={<ArticlesPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ConfigProvider>,
  );

const confirmDeletion = () => {
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(modal.confirm).toHaveBeenCalledOnce();
  const confirm = modal.confirm.mock.calls[0][0].onOk;
  if (!confirm) throw new Error("Delete confirmation handler is missing");
  return confirm;
};

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(fetchArticleCategories).mockResolvedValue(catalog);
  vi.mocked(fetchArticle).mockResolvedValue(guide);
  vi.mocked(fetchArticles).mockResolvedValue([guide]);
  await i18n.changeLanguage("en");
});

describe("articles listing", () => {
  it("ignores legacy list query parameters and hides write actions for readers", async () => {
    renderPage("/articles?page=3&title=Account&category=category-1");

    const row = await screen.findByRole("row", {
      name: /1 Account guide account-guide Documentation/,
    });
    expect(row).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: i18n.t("image") }),
    ).toBeVisible();
    const thumbnail = within(row).getByRole("img", {
      name: i18n.t("image") + " · " + guide.title,
    });
    expect(thumbnail.querySelector("img")).toHaveAttribute(
      "src",
      guide.cover.thumb,
    );
    expect(thumbnail.querySelector(".ant-avatar-square")).toHaveStyle({
      width: "32px",
      height: "32px",
    });
    expect(
      screen.queryByRole("textbox", { name: "Title" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Category" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Excerpt" }),
    ).not.toBeInTheDocument();
    expect(fetchArticles).toHaveBeenCalledExactlyOnceWith(
      expect.any(AbortSignal),
    );
    for (const name of ["Create", "Update", "Delete"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("shows all article rows without pagination", async () => {
    const articles = Array.from({ length: 25 }, (_, index) => ({
      ...guide,
      id: `guide-${index}`,
      title: `Guide number ${index + 1}`,
    }));
    vi.mocked(fetchArticles).mockResolvedValueOnce(articles);
    renderPage();
    expect(await screen.findByText("Guide number 25")).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(26);
    expect(screen.queryByTitle("2")).not.toBeInTheDocument();
  });

  it("lists and opens a legacy article with no cover image", async () => {
    const legacy = { ...guide, cover: { id: null, thumb: null, url: null } };
    vi.mocked(fetchArticles).mockResolvedValueOnce([legacy]);
    vi.mocked(fetchArticle).mockResolvedValueOnce(legacy);
    renderPage("/articles", ["articles.read", "articles.write"]);

    const row = await screen.findByRole("row", { name: /Account guide/ });
    expect(within(row).getByRole("cell", { name: "-" })).toBeVisible();
    expect(row.querySelector("img")).toBeNull();

    fireEvent.click(within(row).getByRole("button", { name: "Update" }));
    expect(await screen.findByDisplayValue(legacy.excerpt)).toBeInTheDocument();
  });

  it("opens the selected article for editing and preserves the current query on return", async () => {
    renderPage("/articles?page=2", ["articles.read", "articles.write"]);
    await screen.findByText(guide.title);
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    expect(await screen.findByDisplayValue(guide.excerpt)).toBeInTheDocument();
    expect(fetchArticle).toHaveBeenCalledExactlyOnceWith(
      guide.id,
      expect.any(AbortSignal),
    );
    expect(screen.getByLabelText("Current location")).toHaveTextContent(
      "/articles?page=2#update",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Current location")).toHaveTextContent(
        /^\/articles\?page=2$/,
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Current location")).toHaveTextContent(
        "/articles?page=2#create",
      ),
    );
    expect(fetchArticle).toHaveBeenCalledOnce();
  });

  it("confirms deletion and refreshes the complete list", async () => {
    const pending = deferred<void>();
    vi.mocked(deleteArticle).mockReturnValueOnce(pending.promise);
    vi.mocked(fetchArticles)
      .mockResolvedValueOnce([guide])
      .mockResolvedValue([]);
    renderPage("/articles", ["articles.read", "articles.write"]);
    await screen.findByText(guide.title);
    const confirm = confirmDeletion();
    expect(deleteArticle).not.toHaveBeenCalled();

    let completion: Promise<void> | undefined;
    act(() => {
      completion = confirm();
    });
    expect(deleteArticle).toHaveBeenCalledExactlyOnceWith(
      guide.id,
      expect.any(AbortSignal),
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(fetchArticles).toHaveBeenCalledOnce();
    await act(async () => {
      pending.resolve();
      await completion;
    });

    await waitFor(() =>
      expect(fetchArticles).toHaveBeenLastCalledWith(expect.any(AbortSignal)),
    );
    expect(screen.getByLabelText("Current location")).toHaveTextContent(
      "/articles",
    );
    expect(screen.queryByText(guide.title)).not.toBeInTheDocument();
    expect(messages.success).toHaveBeenCalledWith(i18n.t("deleted"));
  });

  it("reports deletion failure, retains the row and permits retry", async () => {
    vi.mocked(deleteArticle).mockRejectedValueOnce(
      new Error("Synthetic delete refused"),
    );
    renderPage("/articles", ["articles.read", "articles.write"]);
    await screen.findByText(guide.title);
    const confirm = confirmDeletion();

    await act(async () => {
      await confirm();
    });

    expect(messages.error).toHaveBeenCalledWith("Synthetic delete refused");
    expect(screen.getByText(guide.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
    expect(fetchArticles).toHaveBeenCalledOnce();
    vi.mocked(deleteArticle).mockResolvedValueOnce(undefined);
    await act(async () => {
      await confirm();
    });
    expect(deleteArticle).toHaveBeenCalledTimes(2);
    expect(fetchArticles).toHaveBeenCalledTimes(2);
  });

  it("keeps the article list usable if fetching category options fails", async () => {
    vi.mocked(fetchArticleCategories).mockRejectedValueOnce(
      new Error("Synthetic categories unavailable"),
    );
    renderPage();

    expect(await screen.findByText(guide.title)).toBeInTheDocument();
    const fallback = await screen.findByRole("region", {
      name: i18n.t("articleCategories"),
    });
    expect(within(fallback).getByText(i18n.t("unexpectedError"))).toBeVisible();
    expect(screen.queryByText("Synthetic categories unavailable")).toBeNull();

    fireEvent.click(
      within(fallback).getByRole("button", { name: i18n.t("retry") }),
    );
    await waitFor(() => expect(fallback).not.toBeInTheDocument());
    expect(fetchArticleCategories).toHaveBeenCalledTimes(2);
    expect(fetchArticles).toHaveBeenCalledOnce();
  });

  it("reports a current list failure and ignores abandoned list and category results", async () => {
    vi.mocked(fetchArticles).mockRejectedValueOnce(
      new Error("Synthetic articles unavailable"),
    );
    const first = renderPage();
    expect(await screen.findByText(i18n.t("unexpectedError"))).toBeVisible();
    expect(screen.queryByText("Synthetic articles unavailable")).toBeNull();
    first.unmount();

    const pendingArticles = deferred<ArticleSummary[]>();
    const pendingCategories = deferred<typeof catalog>();
    vi.mocked(fetchArticles).mockReturnValueOnce(pendingArticles.promise);
    vi.mocked(fetchArticleCategories).mockReturnValueOnce(
      pendingCategories.promise,
    );
    const second = renderPage();
    const listSignal = vi.mocked(fetchArticles).mock.calls[1][0];
    const categorySignal = vi.mocked(fetchArticleCategories).mock.calls[1][0];
    second.unmount();

    expect(listSignal?.aborted).toBe(true);
    expect(categorySignal?.aborted).toBe(true);
    await act(async () => {
      pendingArticles.reject(new Error("Obsolete listing"));
      pendingCategories.resolve(catalog);
    });
    expect(messages.error).not.toHaveBeenCalled();
  });

  it("keeps the accepted list visible when a later read fails", async () => {
    vi.mocked(deleteArticle).mockResolvedValueOnce(undefined);
    renderPage("/articles", ["articles.read", "articles.write"]);
    expect(await screen.findByText(guide.title)).toBeVisible();

    const pending = deferred<ArticleSummary[]>();
    vi.mocked(fetchArticles).mockReturnValueOnce(pending.promise);
    const confirm = confirmDeletion();
    act(() => {
      void confirm();
    });
    await waitFor(() => expect(fetchArticles).toHaveBeenCalledTimes(2));
    await act(async () =>
      pending.reject(new Error("Synthetic refresh failed")),
    );

    expect(screen.getByText(guide.title)).toBeVisible();
    expect(screen.queryByText(i18n.t("unexpectedError"))).toBeNull();
    expect(screen.queryByText("Synthetic refresh failed")).toBeNull();
  });
});
