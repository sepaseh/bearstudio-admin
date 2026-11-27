// @vitest-environment jsdom
import { act, fireEvent, waitFor, within } from "@testing-library/react";
import {
  Link,
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminApiError } from "@/shared/api";
import { useGoBack } from "@/shared/hooks";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";
import { render, screen } from "@/test/render";

import { createArticle, fetchArticle, updateArticle } from "../../api";
import type { Article, ArticleRequest } from "../../types";
import { ArticleForm } from "./ArticleForm";

const messages = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
const onFinish = vi.fn();
vi.mock("../../api", () => ({
  createArticle: vi.fn(),
  fetchArticle: vi.fn(),
  updateArticle: vi.fn(),
}));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: messages }),
  useCore: () => ({ settings: { language: { direction: "ltr" } } }),
}));
vi.mock("@/features/files", () => ({
  ManagedImagePicker: ({
    context,
    id,
    onChange,
    selectOnly,
    value,
  }: {
    context: string;
    id?: string;
    onChange?: (id: string | null) => void;
    selectOnly: boolean;
    value?: string | null;
  }) => (
    <input
      id={id}
      data-context={context}
      data-select-only={String(selectOnly)}
      value={value ?? ""}
      onChange={(event) => onChange?.(event.currentTarget.value || null)}
    />
  ),
}));
vi.mock("@/shared/ui/rich-text-editor", () => ({
  RichTextEditor: ({
    disabled,
    id,
    onChange,
    value,
  }: {
    disabled?: boolean;
    id?: string;
    onChange?: (
      value: string,
      changes: unknown,
      source: "api" | "user",
    ) => void;
    value?: string;
  }) => (
    <>
      <textarea
        disabled={disabled}
        id={id}
        value={value ?? ""}
        onChange={(event) =>
          onChange?.(event.currentTarget.value, undefined, "user")
        }
      />
      <button
        type="button"
        onClick={() =>
          onChange?.("<p>Visit the production guide.</p>", undefined, "api")
        }
      >
        Normalize editor markup
      </button>
    </>
  ),
}));

const categories = [{ name: "Workshop notes", slug: "workshop" }];
const draftMetadata: Omit<ArticleRequest, "body"> = {
  title: "Making an edit",
  slug: "making-an-edit",
  category: { slug: categories[0].slug },
  cover: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" },
  excerpt: "An example article.",
};
const draft: ArticleRequest = {
  ...draftMetadata,
  body: "<ul><li>Choose your material.</li></ul>",
};
const record: Article = {
  ...draft,
  category: categories[0],
  cover: {
    ...draft.cover,
    url: "/api/v1/public/images/" + draft.cover.id,
    thumb: null,
  },
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
};

const Navigation = () => {
  const { hash } = useLocation();
  return (
    <>
      <Link to="/articles">Leave the article</Link>
      <Link to="/articles#create">Create another article</Link>
      <output aria-label="Article route hash">{hash}</output>
    </>
  );
};

const Fixture = ({ id }: { id?: string }) => {
  const goBack = useGoBack();
  return (
    <ArticleForm
      id={id}
      options={{ categories }}
      onClose={goBack}
      onFinish={() => {
        onFinish();
        goBack();
      }}
    />
  );
};

const renderForm = (
  hash = "#create",
  id?: string,
  permissions = ["articles.read", "articles.write"],
) =>
  render(
    <MemoryRouter initialEntries={["/articles" + hash]}>
      <Navigation />
      <Routes>
        <Route element={<Outlet context={{ currentUser: { permissions } }} />}>
          <Route path="/articles" element={<Fixture id={id} />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const submit = () => screen.getByRole("button", { name: i18n.t("submit") });
const setText = (label: string, value: string) => {
  fireEvent.change(screen.getByRole("textbox", { name: label }), {
    target: { value },
  });
};

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(createArticle).mockResolvedValue(record);
  vi.mocked(fetchArticle).mockResolvedValue(record);
  vi.mocked(updateArticle).mockResolvedValue(record);
  await i18n.changeLanguage("en");
});

describe("article drawer", () => {
  it("requires visible body text and creates an article with the chosen managed cover", async () => {
    const { user } = renderForm();
    await screen.findByRole("textbox", { name: i18n.t("title") });
    setText(i18n.t("title"), "  " + draft.title + " ");
    setText(i18n.t("slug"), " Making-An-Edit ");
    setText(i18n.t("excerpt"), draft.excerpt);
    await user.click(
      screen.getByRole("combobox", { name: i18n.t("category") }),
    );
    await user.click(await screen.findByText(categories[0].name));
    const cover = screen.getByRole("textbox", { name: i18n.t("coverImage") });
    expect(cover).toHaveAttribute("data-context", "article");
    expect(cover).toHaveAttribute("data-select-only", "true");
    expect(
      screen.queryByRole("textbox", { name: "Image alt text" }),
    ).not.toBeInTheDocument();
    fireEvent.change(cover, { target: { value: draft.cover.id } });
    setText(i18n.t("body"), "<p>&nbsp;\u200b</p>");
    fireEvent.click(submit());

    expect(await screen.findByText(i18n.t("bodyRequired"))).toBeInTheDocument();
    expect(createArticle).not.toHaveBeenCalled();

    setText(i18n.t("body"), draft.body);
    fireEvent.click(submit());
    await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
    expect(createArticle).toHaveBeenCalledExactlyOnceWith(
      draft,
      expect.any(AbortSignal),
    );
  });

  it("clears the cover selection and draft after leaving and reopening create", async () => {
    const { user } = renderForm();
    await screen.findByRole("textbox", { name: i18n.t("title") });
    setText(i18n.t("title"), "Discard this draft");
    setText(i18n.t("coverImage"), draft.cover.id);
    await user.click(screen.getByRole("button", { name: i18n.t("cancel") }));
    await waitFor(() =>
      expect(screen.getByLabelText("Article route hash")).toBeEmptyDOMElement(),
    );
    await user.click(
      screen.getByRole("link", { name: "Create another article" }),
    );

    const drawer = within(await screen.findByRole("dialog"));
    expect(
      await drawer.findByRole("textbox", { name: i18n.t("title") }),
    ).toHaveValue("");
    expect(
      drawer.getByRole("textbox", { name: i18n.t("coverImage") }),
    ).toHaveValue("");
  });

  it("loads full details and retains the draft for retry after an edit fails", async () => {
    const details = deferred<Article>();
    vi.mocked(fetchArticle).mockReturnValueOnce(details.promise);
    vi.mocked(updateArticle).mockRejectedValueOnce(
      new AdminApiError("Synthetic invalid references", 400, {
        errors: {
          "category.slug": ["Choose an existing category."],
          "cover.id": ["Choose a ready cover."],
        },
      }),
    );
    renderForm("#update", record.id);

    await screen.findByRole("dialog");
    expect(submit()).toBeDisabled();
    await act(async () => details.resolve(record));
    expect(await screen.findByDisplayValue(draft.body)).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: i18n.t("coverImage") }),
    ).toHaveValue(record.cover.id);
    setText(i18n.t("title"), "New title");
    fireEvent.click(submit());
    await waitFor(() => {
      expect(messages.error).toHaveBeenCalledExactlyOnceWith(
        "Synthetic invalid references",
      );
      expect(submit()).toBeEnabled();
    });
    expect(
      screen.queryByText("Choose an existing category."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Choose a ready cover.")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: i18n.t("title") })).toHaveValue(
      "New title",
    );
    expect(onFinish).not.toHaveBeenCalled();

    fireEvent.click(submit());
    await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
    expect(updateArticle).toHaveBeenLastCalledWith(
      record.id,
      { ...draftMetadata, title: "New title" },
      expect.any(AbortSignal),
    );
  });

  it("does not overwrite stored link markup when the editor normalizes an unchanged body", async () => {
    const linkedBody =
      '<p>Visit <a href="https://example.test/guide">the production guide</a>.</p>';
    vi.mocked(fetchArticle).mockResolvedValueOnce({
      ...record,
      body: linkedBody,
    });
    renderForm("#update", record.id);

    await screen.findByDisplayValue(linkedBody);
    fireEvent.click(
      screen.getByRole("button", { name: "Normalize editor markup" }),
    );
    setText(i18n.t("title"), "Edited metadata");
    fireEvent.click(submit());

    await waitFor(() => expect(updateArticle).toHaveBeenCalledOnce());
    expect(updateArticle).toHaveBeenCalledWith(
      record.id,
      { ...draftMetadata, title: "Edited metadata" },
      expect.any(AbortSignal),
    );
  });

  it("includes semantic HTML when the operator changes the article body", async () => {
    renderForm("#update", record.id);
    await screen.findByDisplayValue(draft.body);
    const body = "<ul><li>Edited item.</li></ul>";
    setText(i18n.t("body"), body);
    fireEvent.click(submit());

    await waitFor(() => expect(updateArticle).toHaveBeenCalledOnce());
    expect(updateArticle).toHaveBeenCalledWith(
      record.id,
      { ...draftMetadata, body },
      expect.any(AbortSignal),
    );
  });

  it.each(["success", "failure"])(
    "ignores an obsolete edit %s after navigation",
    async (outcome) => {
      const pending = deferred<Article>();
      vi.mocked(updateArticle).mockReturnValueOnce(pending.promise);
      const { user } = renderForm("#update", record.id);
      await screen.findByDisplayValue(draft.title);
      fireEvent.click(submit());
      await waitFor(() => expect(updateArticle).toHaveBeenCalledOnce());
      const signal = vi.mocked(updateArticle).mock.calls[0][2];
      await user.click(screen.getByRole("link", { name: "Leave the article" }));

      await act(async () => {
        if (outcome === "success") pending.resolve(record);
        else pending.reject(new Error("Obsolete write"));
      });
      expect(signal?.aborted).toBe(true);
      expect(onFinish).not.toHaveBeenCalled();
      expect(messages.success).not.toHaveBeenCalled();
      expect(messages.error).not.toHaveBeenCalled();
    },
  );

  it("cancels an obsolete edit detail read", async () => {
    const pending = deferred<Article>();
    vi.mocked(fetchArticle).mockReturnValueOnce(pending.promise);
    const { unmount } = renderForm("#update", record.id);
    const signal = vi.mocked(fetchArticle).mock.calls[0][1];
    unmount();
    await act(async () => pending.resolve(record));
    expect(signal?.aborted).toBe(true);
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("keeps loading errors inside the drawer and offers retry", async () => {
    vi.mocked(fetchArticle).mockRejectedValueOnce(
      new Error("Article unavailable"),
    );
    renderForm("#update", record.id);
    expect(await screen.findByText(i18n.t("unexpectedError"))).toBeVisible();
    expect(screen.queryByText("Article unavailable")).not.toBeInTheDocument();
    expect(submit()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("retry") }));
    expect(await screen.findByDisplayValue(draft.body)).toBeVisible();
  });

  it.each(["#create", "#update"])("closes a denied drawer %s", async (hash) => {
    renderForm(hash, record.id, ["articles.read"]);
    await waitFor(() =>
      expect(screen.getByLabelText("Article route hash")).toBeEmptyDOMElement(),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchArticle).not.toHaveBeenCalled();
  });

  it("closes an edit without a record ID", async () => {
    renderForm("#update");
    await waitFor(() =>
      expect(screen.getByLabelText("Article route hash")).toBeEmptyDOMElement(),
    );
    expect(fetchArticle).not.toHaveBeenCalled();
  });
});
