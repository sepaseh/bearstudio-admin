// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n";
import { render, screen } from "@/test/render";

import { createService, fetchService, updateService } from "../../api";
import type { ServiceGroup } from "../../types";
import { ServiceForm } from "./ServiceForm";

const { messages, onClose, onFinish } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
  onClose: vi.fn(),
  onFinish: vi.fn(),
}));
vi.mock("../../api", () => ({
  createService: vi.fn(),
  fetchService: vi.fn(),
  updateService: vi.fn(),
}));
vi.mock("@/app/hooks", () => ({ useAntd: () => ({ messageAPI: messages }) }));
vi.mock("@/features/files", () => ({
  ManagedImagePicker: ({
    context,
    id,
    multiple,
    onChange,
    value,
  }: {
    context: string;
    id?: string;
    multiple: boolean;
    onChange?: (ids: string[]) => void;
    value?: string[];
  }) => (
    <select
      id={id}
      data-context={context}
      multiple={multiple}
      value={value ?? []}
      onChange={(event) =>
        onChange?.(
          Array.from(
            event.currentTarget.selectedOptions,
            (option) => option.value,
          ),
        )
      }
    >
      <option value={secondImage}>Second image</option>
      <option value={firstImage}>First image</option>
    </select>
  ),
}));

const service: ServiceGroup = {
  slug: "animation",
  title: "Animation",
  description: "Production and design.",
  tags: ["2D", "3D"],
  images: [],
};

const renderForm = (hash = "#create", slug?: string) =>
  render(
    <MemoryRouter initialEntries={["/services" + hash]}>
      <Routes>
        <Route
          element={
            <Outlet
              context={{
                currentUser: { permissions: ["content.read", "content.write"] },
              }}
            />
          }
        >
          <Route
            path="/services"
            element={
              <ServiceForm onClose={onClose} onFinish={onFinish} slug={slug} />
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const field = (name: string) => screen.getByRole("textbox", { name });
const set = (name: string, value: string) =>
  fireEvent.change(field(name), { target: { value } });
const submit = () => screen.getByRole("button", { name: i18n.t("submit") });
const firstImage = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const secondImage = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(fetchService).mockResolvedValue(service);
  vi.mocked(createService).mockResolvedValue({
    ...service,
  });
  await i18n.changeLanguage("en");
});

it("submits trimmed text, ordered tags and only the selected image IDs", async () => {
  const { user } = renderForm();
  await screen.findByRole("textbox", { name: i18n.t("title") });
  set(i18n.t("title"), " Animation ");
  set(i18n.t("slug"), " Animation ");
  set(i18n.t("description"), " Production and design. ");

  const tags = screen.getByRole("combobox", { name: i18n.t("serviceTags") });
  const images = screen.getByRole("listbox", { name: i18n.t("images") });
  expect(images).toHaveAttribute("data-context", "service");
  expect(
    screen.queryByRole("textbox", { name: /details|alt text/i }),
  ).toBeNull();
  await user.type(tags, " 3D {Enter}");
  await user.type(tags, "2D");
  await user.selectOptions(images, [secondImage, firstImage]);
  await user.click(submit());

  await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
  expect(createService).toHaveBeenCalledExactlyOnceWith(
    {
      title: "Animation",
      slug: "animation",
      description: "Production and design.",
      tags: ["3D", "2D"],
      imageIds: [secondImage, firstImage],
    },
    expect.any(AbortSignal),
  );
});

it("loads saved images and preserves their order and repeated tags on edit", async () => {
  const existing = {
    ...service,
    images: [firstImage, secondImage].map((id) => ({
      id,
      url: "/api/v1/public/images/" + id,
      thumb: "/api/v1/public/images/" + id + "/thumbnail",
    })),
    tags: ["2D", "2D", "1", "3D"],
  };
  vi.mocked(fetchService).mockResolvedValue(existing);
  vi.mocked(updateService).mockResolvedValue(existing);

  const { user } = renderForm("#update", existing.slug);
  await screen.findByDisplayValue(existing.title);
  const tags = screen.getByRole("combobox", { name: i18n.t("serviceTags") });
  await user.type(tags, "  Stop motion  ");
  await user.click(submit());

  await waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
  expect(updateService).toHaveBeenCalledExactlyOnceWith(
    existing.slug,
    {
      title: existing.title,
      slug: existing.slug,
      description: existing.description,
      tags: ["2D", "2D", "1", "3D", "Stop motion"],
      imageIds: [firstImage, secondImage],
    },
    expect.any(AbortSignal),
  );
});
