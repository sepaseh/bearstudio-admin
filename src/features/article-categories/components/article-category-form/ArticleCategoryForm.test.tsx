import { act, fireEvent, waitFor, within } from "@testing-library/react";
import { CanceledError } from "axios";
import {
  Link,
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdministratorSession } from "@/features/auth";
import { useGoBack } from "@/shared/hooks";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";
import { render, screen } from "@/test/render";

import {
  createArticleCategory,
  fetchArticleCategory,
  updateArticleCategory,
} from "../../api";
import type { ArticleCategory } from "../../types";
import { ArticleCategoryForm } from "./ArticleCategoryForm";

const { messages } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../../api", () => ({
  createArticleCategory: vi.fn(),
  deleteArticleCategory: vi.fn(),
  fetchArticleCategories: vi.fn(),
  fetchArticleCategory: vi.fn(),
  sortArticleCategories: vi.fn(),
  updateArticleCategory: vi.fn(),
}));

vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: messages }),
}));

const category: ArticleCategory = {
  slug: "guides",
  name: "Guides",
};

const CategoryNavigation = () => {
  const { hash } = useLocation();
  return (
    <>
      <Link to="/article-categories#create">Open category form</Link>
      <output aria-label="Category form location">{hash}</output>
    </>
  );
};

const RoutedCategoryForm = ({
  id,
  onFinish,
}: {
  id?: ArticleCategory["slug"];
  onFinish: () => void;
}) => {
  const goBack = useGoBack();

  const handleFinish = () => {
    onFinish();
    goBack();
  };

  return (
    <ArticleCategoryForm slug={id} onClose={goBack} onFinish={handleFinish} />
  );
};

const renderForm = ({
  hash = "#create",
  id,
  permissions = ["articles.write"],
}: {
  hash?: string;
  id?: string;
  permissions?: AdministratorSession["permissions"];
} = {}) => {
  const currentUser: AdministratorSession = {
    id: "synthetic-category-editor",
    mobile: "9120000000",
    name: "Ada Lovelace",
    permissions: ["articles.read", ...permissions],
    roles: [],
  };
  const onFinish = vi.fn();

  return {
    ...render(
      <MemoryRouter initialEntries={[`/article-categories${hash}`]}>
        <CategoryNavigation />
        <Routes>
          <Route element={<Outlet context={{ currentUser }} />}>
            <Route
              path="/article-categories"
              element={<RoutedCategoryForm id={id} onFinish={onFinish} />}
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    ),
    onFinish,
  };
};

const formLocation = () => screen.getByLabelText("Category form location");
const nameField = () => screen.findByRole("textbox", { name: i18n.t("name") });
const enterSlug = () =>
  fireEvent.change(screen.getByRole("textbox", { name: i18n.t("slug") }), {
    target: { value: " GUIDES " },
  });
const submitButton = () =>
  screen.getByRole("button", { name: i18n.t("submit") });

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(createArticleCategory).mockResolvedValue(category);
  vi.mocked(fetchArticleCategory).mockResolvedValue(category);
  vi.mocked(updateArticleCategory).mockResolvedValue(category);
  await i18n.changeLanguage("en");
});

describe("article category form", () => {
  it("rejects a whitespace-only name and creates a category with the corrected value", async () => {
    const { onFinish, user } = renderForm();
    const field = await nameField();
    fireEvent.change(field, { target: { value: "   " } });
    await user.click(submitButton());

    await waitFor(() => expect(field).toHaveAttribute("aria-invalid", "true"));
    expect(createArticleCategory).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: category.name } });
    enterSlug();
    await user.click(submitButton());

    await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
    expect(createArticleCategory).toHaveBeenCalledExactlyOnceWith(
      { name: category.name, slug: category.slug },
      expect.any(AbortSignal),
    );
    expect(updateArticleCategory).not.toHaveBeenCalled();
    expect(messages.success).toHaveBeenCalledExactlyOnceWith(
      i18n.t("contentSaved"),
    );
    await waitFor(() => expect(formLocation()).toBeEmptyDOMElement());
  });

  it("waits for details before allowing an edit of the requested category", async () => {
    const pending = deferred<ArticleCategory>();
    vi.mocked(fetchArticleCategory).mockReturnValue(pending.promise);
    const { onFinish, user } = renderForm({
      hash: "#update",
      id: category.slug,
    });
    const drawer = await screen.findByRole("dialog", {
      name: i18n.t("update"),
    });
    const submit = within(drawer).getByRole("button", {
      name: i18n.t("submit"),
    });
    expect(submit).toBeDisabled();
    expect(updateArticleCategory).not.toHaveBeenCalled();

    await act(async () => pending.resolve(category));
    const name = await nameField();
    expect(name).toHaveValue(category.name);
    expect(submit).toBeEnabled();
    fireEvent.change(name, { target: { value: "Getting started" } });
    await user.click(submit);

    await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
    expect(fetchArticleCategory).toHaveBeenCalledExactlyOnceWith(
      category.slug,
      expect.any(AbortSignal),
    );
    expect(updateArticleCategory).toHaveBeenCalledExactlyOnceWith(
      category.slug,
      { name: "Getting started", slug: category.slug },
      expect.any(AbortSignal),
    );
    expect(createArticleCategory).not.toHaveBeenCalled();
    await waitFor(() => expect(formLocation()).toBeEmptyDOMElement());
  });

  it("preserves the draft after a failed save and allows correction and retry", async () => {
    vi.mocked(createArticleCategory).mockRejectedValueOnce(
      new Error("Name already exists"),
    );
    const { onFinish, user } = renderForm();
    const field = await nameField();
    fireEvent.change(field, { target: { value: category.name } });
    enterSlug();
    await user.click(submitButton());

    await waitFor(() => {
      expect(messages.error).toHaveBeenCalledExactlyOnceWith(
        "Name already exists",
      );
      expect(submitButton()).toBeEnabled();
    });
    expect(formLocation()).toHaveTextContent("#create");
    expect(field).toHaveValue(category.name);
    expect(onFinish).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: "Documentation" } });
    await user.click(submitButton());
    await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
    expect(createArticleCategory).toHaveBeenLastCalledWith(
      { name: "Documentation", slug: category.slug },
      expect.any(AbortSignal),
    );
  });

  it("suppresses cancellation feedback and releases the save control", async () => {
    vi.mocked(createArticleCategory).mockRejectedValueOnce(new CanceledError());
    const { onFinish, user } = renderForm();
    const field = await nameField();
    fireEvent.change(field, { target: { value: category.name } });
    enterSlug();
    await user.click(submitButton());

    await waitFor(() => {
      expect(createArticleCategory).toHaveBeenCalledOnce();
      expect(submitButton()).toBeEnabled();
    });
    expect(field).toHaveValue(category.name);
    expect(messages.error).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("resets the draft when the closed create drawer is opened again", async () => {
    const { user } = renderForm();
    fireEvent.change(await nameField(), { target: { value: "Unsaved draft" } });
    await user.click(screen.getByRole("button", { name: i18n.t("cancel") }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("link", { name: "Open category form" }));
    expect(await nameField()).toHaveValue("");
    expect(createArticleCategory).not.toHaveBeenCalled();
  });

  it.each(["#create", "#update"])(
    "returns readers from %s without fetching editor data",
    async (hash) => {
      renderForm({ hash, id: category.slug, permissions: [] });

      await waitFor(() => expect(formLocation()).toBeEmptyDOMElement());
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(fetchArticleCategory).not.toHaveBeenCalled();
      expect(createArticleCategory).not.toHaveBeenCalled();
      expect(updateArticleCategory).not.toHaveBeenCalled();
    },
  );

  it("returns to the list when the edit URL supplies no selected category", async () => {
    renderForm({ hash: "#update" });

    await waitFor(() => expect(formLocation()).toBeEmptyDOMElement());
    expect(fetchArticleCategory).not.toHaveBeenCalled();
    expect(updateArticleCategory).not.toHaveBeenCalled();
  });

  it("displays a failed detail read and lets the operator retry", async () => {
    vi.mocked(fetchArticleCategory).mockRejectedValueOnce(
      new Error("Category is unavailable"),
    );
    renderForm({ hash: "#update", id: category.slug });

    expect(await screen.findByText(i18n.t("unexpectedError"))).toBeVisible();
    expect(
      screen.queryByText("Category is unavailable"),
    ).not.toBeInTheDocument();
    expect(formLocation()).toHaveTextContent("#update");
    expect(submitButton()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("retry") }));
    expect(await screen.findByDisplayValue(category.name)).toBeVisible();
    expect(updateArticleCategory).not.toHaveBeenCalled();
  });

  it("cancels a pending detail read when the edit drawer is closed", async () => {
    const pending = deferred<ArticleCategory>();
    vi.mocked(fetchArticleCategory).mockReturnValueOnce(pending.promise);
    const { user } = renderForm({ hash: "#update", id: category.slug });
    const drawer = await screen.findByRole("dialog", {
      name: i18n.t("update"),
    });
    const signal = vi.mocked(fetchArticleCategory).mock.calls[0][1];

    await user.click(
      within(drawer).getByRole("button", { name: i18n.t("cancel") }),
    );
    await act(async () => pending.resolve(category));

    expect(formLocation()).toBeEmptyDOMElement();
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByDisplayValue(category.name)).not.toBeInTheDocument();
    expect(messages.error).not.toHaveBeenCalled();
  });

  it.each(["success", "failure"])(
    "blocks duplicate saves and ignores a late %s after unmount",
    async (outcome) => {
      const pending = deferred<ArticleCategory>();
      vi.mocked(createArticleCategory).mockReturnValueOnce(pending.promise);
      const { onFinish, unmount, user } = renderForm();
      const name = await nameField();
      const submit = submitButton();
      fireEvent.change(name, { target: { value: category.name } });
      enterSlug();
      await user.click(submit);
      await waitFor(() => expect(submit).toBeDisabled());
      expect(name).toBeDisabled();
      await user.click(submit);
      expect(createArticleCategory).toHaveBeenCalledOnce();
      const signal = vi.mocked(createArticleCategory).mock.calls[0][1];
      unmount();

      await act(async () => {
        if (outcome === "success") pending.resolve(category);
        else pending.reject(new Error("Obsolete save response"));
      });

      expect(signal?.aborted).toBe(true);
      expect(messages.success).not.toHaveBeenCalled();
      expect(messages.error).not.toHaveBeenCalled();
      expect(onFinish).not.toHaveBeenCalled();
    },
  );
});
