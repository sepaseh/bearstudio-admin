import { act, waitFor, within } from "@testing-library/react";
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";
import { render, screen } from "@/test/render";

import {
  createFaq,
  deleteFaq,
  fetchFaq,
  fetchFaqs,
  sortFaqs,
  updateFaq,
} from "./api";
import { FaqsPage } from "./Faqs";
import type { Faq, FaqCatalog } from "./types";

const { confirm, messages } = vi.hoisted(() => ({
  confirm: vi.fn<(options: { onOk: () => Promise<void> }) => void>(),
  messages: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("./api", () => ({
  createFaq: vi.fn(),
  deleteFaq: vi.fn(),
  fetchFaq: vi.fn(),
  fetchFaqs: vi.fn(),
  sortFaqs: vi.fn(),
  updateFaq: vi.fn(),
}));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: messages, modalAPI: { confirm } }),
}));

const first: Faq = {
  id: "11111111-1111-4111-8111-111111111111",
  question: "Where can I find my files?",
  answer: "Open the Files page.",
};
const second: Faq = {
  id: "22222222-2222-4222-8222-222222222222",
  question: "How do I edit a category?",
  answer: "Open the Category settings.",
};

const catalog = (items: Faq[]): FaqCatalog => ({ items });

const LocationPreview = () => {
  const { hash, pathname, search } = useLocation();
  return <output aria-label="FAQ location">{pathname + search + hash}</output>;
};

const HistoryControls = () => {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => void navigate({ pathname, search })}>
        Open FAQ list
      </button>
      <button onClick={() => void navigate(-2)}>Back to earlier FAQ</button>
      <button onClick={() => void navigate(2)}>Forward to later FAQ</button>
    </>
  );
};

const renderPage = (
  permissions: readonly string[] = ["content.read"],
  historyControls = false,
) => {
  const currentUser = {
    permissions,
  };
  return render(
    <MemoryRouter initialEntries={["/faqs?from=admin"]}>
      <LocationPreview />
      {historyControls && <HistoryControls />}
      <Routes>
        <Route element={<Outlet context={{ currentUser }} />}>
          <Route path="/faqs" element={<FaqsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
};

const getConfirmation = () => {
  const [confirmation] = confirm.mock.lastCall ?? [];
  if (!confirmation) throw new Error("Expected an FAQ deletion confirmation");

  return confirmation;
};

const questionOrder = () =>
  screen
    .getAllByRole("cell", { name: /^(Where can I find|How do I edit)/ })
    .map((cell) => cell.textContent);

const provideRowGeometry = () => {
  // jsdom has no layout. Give the keyboard sensor distinct sortable row bounds.
  const getBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const row = this.closest("tr[data-row-key]");
      const index = [first, second].findIndex(
        (faq) => faq.id === row?.getAttribute("data-row-key"),
      );
      return index < 0
        ? getBoundingClientRect.call(this)
        : new DOMRect(16, 48 + index * 48, 320, 48);
    },
  );
};

const reorderFirst = async (user: ReturnType<typeof render>["user"]) => {
  const handle = screen.getAllByRole("button", { name: i18n.t("order") })[0];
  handle.focus();
  await user.keyboard("[Space]");
  await waitFor(() => expect(handle).toHaveAttribute("aria-pressed", "true"));
  await user.keyboard("[ArrowDown]");
  await waitFor(() =>
    expect(
      screen.getByText(
        new RegExp("moved over droppable area " + second.id, "i"),
      ),
    ).toBeVisible(),
  );
  await user.keyboard("[Space]");
};

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(fetchFaqs).mockResolvedValue(catalog([first, second]));
  vi.mocked(fetchFaq).mockImplementation(async (id) => {
    const result = [first, second].find((faq) => faq.id === id);
    if (!result) throw new Error(`Unknown synthetic FAQ: ${id}`);

    return result;
  });
  vi.mocked(createFaq).mockResolvedValue(first);
  vi.mocked(updateFaq).mockResolvedValue(second);
  vi.mocked(deleteFaq).mockResolvedValue(undefined);
  vi.mocked(sortFaqs).mockResolvedValue(undefined);
  await i18n.changeLanguage("en");
});

describe("FAQ listing", () => {
  it("opens and closes an answer on demand for a read-only operator", async () => {
    const { user } = renderPage();
    const firstRow = await screen.findByRole("row", {
      name: new RegExp(first.question.replace("?", "\\?")),
    });
    expect(within(firstRow).getByRole("cell", { name: "1" })).toBeVisible();
    expect(screen.queryByText(first.answer)).toBeNull();
    expect(screen.queryByText(second.answer)).toBeNull();
    const toggle = within(firstRow).getByRole("button", { name: "Expand row" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle.closest("td")?.nextElementSibling).toBe(
      within(firstRow).getByRole("cell", { name: first.question }),
    );

    toggle.focus();
    await user.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(first.answer)).toBeVisible();
    expect(screen.queryByText(second.answer)).toBeNull();
    await user.click(
      within(firstRow).getByRole("button", { name: "Collapse row" }),
    );
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("row", { name: first.answer })).toBeNull();

    expect(questionOrder()).toEqual([first.question, second.question]);
    expect(fetchFaqs).toHaveBeenCalledExactlyOnceWith(expect.any(AbortSignal));
    for (const action of ["create", "update", "delete", "order"] as const)
      expect(
        screen.queryByRole("button", { name: i18n.t(action) }),
      ).not.toBeInTheDocument();
  });

  it("opens and closes creation without losing the current query", async () => {
    const { user } = renderPage(["content.read", "content.write"]);
    await screen.findByText(first.question);

    await user.click(screen.getByRole("button", { name: i18n.t("create") }));
    const drawer = await screen.findByRole("dialog", {
      name: i18n.t("create"),
    });
    expect(screen.getByLabelText("FAQ location")).toHaveTextContent(
      "/faqs?from=admin#create",
    );
    expect(
      await within(drawer).findByRole("textbox", { name: i18n.t("question") }),
    ).toHaveValue("");
    expect(fetchFaq).not.toHaveBeenCalled();

    await user.click(
      within(drawer).getByRole("button", { name: i18n.t("cancel") }),
    );
    await waitFor(() => expect(drawer).not.toBeVisible());
    expect(screen.getByLabelText("FAQ location")).toHaveTextContent(
      /^\/faqs\?from=admin$/,
    );
    expect(createFaq).not.toHaveBeenCalled();
  });

  it("opens the selected FAQ for editing and retains the current query", async () => {
    const { user } = renderPage(["content.read", "content.write"]);
    const question = await screen.findByText(second.question);
    const row = question.closest("tr");
    if (!row) throw new Error("Expected an FAQ row");

    await user.click(
      within(row).getByRole("button", { name: i18n.t("update") }),
    );
    const drawer = await screen.findByRole("dialog", {
      name: i18n.t("update"),
    });
    expect(screen.getByLabelText("FAQ location")).toHaveTextContent(
      "/faqs?from=admin#update",
    );
    expect(
      await within(drawer).findByDisplayValue(second.question),
    ).toBeVisible();
    expect(within(drawer).getByDisplayValue(second.answer)).toBeVisible();
    expect(fetchFaq).toHaveBeenCalledExactlyOnceWith(
      second.id,
      expect.any(AbortSignal),
    );
  });

  it("saves the restored FAQ and closes the drawer while refreshing the list", async () => {
    const { user } = renderPage(["content.read", "content.write"], true);
    const openFaq = async (faq: Faq) => {
      const cell = await screen.findByRole("cell", { name: faq.question });
      const row = cell.closest("tr");
      if (!row) throw new Error("Expected an FAQ row");

      await user.click(
        within(row).getByRole("button", { name: i18n.t("update") }),
      );
    };

    await openFaq(first);
    const drawer = await screen.findByRole("dialog");
    await within(drawer).findByDisplayValue(first.question);
    await user.click(screen.getByText("Open FAQ list"));
    await waitFor(() => expect(drawer).not.toBeVisible());
    await openFaq(second);
    await within(drawer).findByDisplayValue(second.question);

    await user.click(screen.getByText("Back to earlier FAQ"));
    await within(drawer).findByDisplayValue(first.question);
    await user.click(screen.getByText("Forward to later FAQ"));
    await within(drawer).findByDisplayValue(second.question);

    await user.click(screen.getByText("Back to earlier FAQ"));
    await within(drawer).findByDisplayValue(first.question);

    const refreshed = { ...first, question: "Where are my uploaded files?" };
    const pendingRefresh = deferred<FaqCatalog>();
    vi.mocked(fetchFaqs).mockReturnValueOnce(pendingRefresh.promise);
    await user.click(
      within(drawer).getByRole("button", { name: i18n.t("submit") }),
    );

    await waitFor(() =>
      expect(updateFaq).toHaveBeenCalledExactlyOnceWith(
        first.id,
        {
          question: first.question,
          answer: first.answer,
        },
        expect.any(AbortSignal),
      ),
    );
    await waitFor(() => expect(drawer).not.toBeVisible());
    expect(screen.getByLabelText("FAQ location")).toHaveTextContent(
      /^\/faqs\?from=admin$/,
    );
    expect(fetchFaqs).toHaveBeenCalledTimes(2);

    await act(async () => pendingRefresh.resolve(catalog([refreshed, second])));
    expect(
      screen.getByRole("cell", { name: refreshed.question }),
    ).toBeVisible();
  });

  it("waits for a confirmed deletion before refreshing the list", async () => {
    const pending = deferred<void>();
    vi.mocked(deleteFaq).mockReturnValueOnce(pending.promise);
    vi.mocked(fetchFaqs)
      .mockResolvedValueOnce(catalog([first, second]))
      .mockResolvedValueOnce(catalog([second]));
    const { user } = renderPage(["content.read", "content.write"]);
    const button = (
      await screen.findAllByRole("button", { name: i18n.t("delete") })
    )[0];
    await user.click(button);
    expect(confirm).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ title: i18n.t("deleteConfirm") }),
    );
    expect(deleteFaq).not.toHaveBeenCalled();

    let deletion!: Promise<void>;
    act(() => {
      deletion = getConfirmation().onOk();
    });
    expect(deleteFaq).toHaveBeenCalledExactlyOnceWith(
      first.id,
      expect.any(AbortSignal),
    );
    expect(fetchFaqs).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    await act(async () => {
      pending.resolve();
      await deletion;
    });
    expect(fetchFaqs).toHaveBeenCalledTimes(2);
    expect(messages.success).toHaveBeenCalledExactlyOnceWith(i18n.t("deleted"));
    expect(screen.queryByText(first.question)).not.toBeInTheDocument();
    expect(screen.getByText(second.question)).toBeVisible();
  });

  it("reports failed deletion and preserves the existing list for retry", async () => {
    const failure = new Error("Synthetic FAQ deletion failed");
    vi.mocked(deleteFaq).mockRejectedValueOnce(failure);
    const { user } = renderPage(["content.read", "content.write"]);
    const button = (
      await screen.findAllByRole("button", { name: i18n.t("delete") })
    )[0];
    await user.click(button);
    await act(async () => {
      await expect(getConfirmation().onOk()).rejects.toBe(failure);
    });

    expect(messages.error).toHaveBeenCalledExactlyOnceWith(failure.message);
    expect(messages.success).not.toHaveBeenCalled();
    expect(fetchFaqs).toHaveBeenCalledTimes(1);
    expect(screen.getByText(first.question)).toBeVisible();
    expect(button).toBeEnabled();

    await user.click(button);
    await act(async () => {
      await getConfirmation().onOk();
    });
    expect(deleteFaq).toHaveBeenNthCalledWith(
      2,
      first.id,
      expect.any(AbortSignal),
    );
    expect(fetchFaqs).toHaveBeenCalledTimes(2);
  });

  it("reloads the authoritative order after a failed save and accepts a successful retry", async () => {
    provideRowGeometry();
    const failure = new Error("Synthetic FAQ order save failed");
    vi.mocked(sortFaqs).mockRejectedValueOnce(failure);
    vi.mocked(fetchFaqs)
      .mockResolvedValueOnce(catalog([first, second]))
      .mockResolvedValueOnce(catalog([first, second]))
      .mockResolvedValueOnce(catalog([second, first]));
    const { user } = renderPage(["content.read", "content.write"]);
    await screen.findByText(first.question);

    await reorderFirst(user);
    await waitFor(() =>
      expect(messages.error).toHaveBeenCalledExactlyOnceWith(failure.message),
    );
    expect(sortFaqs).toHaveBeenCalledExactlyOnceWith(
      { ids: [second.id, first.id] },
      expect.any(AbortSignal),
    );
    expect(fetchFaqs).toHaveBeenCalledTimes(2);
    expect(questionOrder()).toEqual([first.question, second.question]);

    await reorderFirst(user);
    await waitFor(() =>
      expect(questionOrder()).toEqual([second.question, first.question]),
    );
    expect(sortFaqs).toHaveBeenNthCalledWith(
      2,
      { ids: [second.id, first.id] },
      expect.any(AbortSignal),
    );
    expect(fetchFaqs).toHaveBeenCalledTimes(3);
    expect(messages.success).toHaveBeenCalledExactlyOnceWith(
      i18n.t("contentSaved"),
    );
  });

  it("reports an active list read failure", async () => {
    vi.mocked(fetchFaqs).mockRejectedValueOnce(
      new Error("Synthetic FAQs unavailable"),
    );
    const { user } = renderPage();
    expect(await screen.findByText(i18n.t("unexpectedError"))).toBeVisible();
    expect(screen.queryByText("Synthetic FAQs unavailable")).toBeNull();
    expect(screen.queryByText(first.question)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: i18n.t("retry") }));
    expect(await screen.findByText(first.question)).toBeVisible();
  });

  it("keeps the empty table after a successful initial read", async () => {
    vi.mocked(fetchFaqs).mockResolvedValueOnce(catalog([]));
    renderPage();

    expect(
      await screen.findByText("No data", { selector: "div" }),
    ).toBeVisible();
    expect(screen.queryByText(i18n.t("unexpectedError"))).toBeNull();
    expect(screen.queryByRole("button", { name: i18n.t("retry") })).toBeNull();
  });

  it("aborts an abandoned list read and suppresses its late failure", async () => {
    const pending = deferred<FaqCatalog>();
    vi.mocked(fetchFaqs).mockReturnValueOnce(pending.promise);
    const { unmount } = renderPage();
    const signal = vi.mocked(fetchFaqs).mock.calls[0][0]!;
    unmount();

    await act(async () => pending.reject(new Error("Synthetic obsolete read")));
    expect(signal.aborted).toBe(true);
    expect(messages.error).not.toHaveBeenCalled();
  });
});
