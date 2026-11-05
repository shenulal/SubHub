// src/components/common/quick-create/create-app-dialog.test.tsx
import { renderWithPermissions } from "@/test/permission-wrapper";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateAppDialog } from "./create-app-dialog";

const { createApp, toastSuccess } = vi.hoisted(() => ({
  createApp: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock("@/actions/apps", () => ({ createApp }));
vi.mock("@/actions/taxonomy/catalog", () => ({
  searchCatalog: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/components/taxonomy/category-picker", () => ({
  CategoryPicker: () => <div data-testid="category-picker" />,
}));
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: vi.fn() },
}));

function renderDialog(onCreated = vi.fn(), defaultName = "Figma") {
  const onOpenChange = vi.fn();
  renderWithPermissions(
    <CreateAppDialog
      open
      onOpenChange={onOpenChange}
      defaultName={defaultName}
      onCreated={onCreated}
    />,
    ["apps:manage", "categories:manage"]
  );
  return { onCreated, onOpenChange };
}

describe("CreateAppDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("prefills the typed name and creates the app", async () => {
    createApp.mockResolvedValue({ success: true, data: { id: "app-9" } });
    const { onCreated, onOpenChange } = renderDialog();

    expect(screen.getByLabelText(/app name/i)).toHaveValue("Figma");
    await userEvent.type(
      screen.getByLabelText(/website/i),
      "https://figma.com"
    );
    await userEvent.click(screen.getByRole("button", { name: "Create app" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const fd = createApp.mock.calls[0][1] as FormData;
    expect(fd.get("name")).toBe("Figma");
    expect(fd.get("customWebsite")).toBe("https://figma.com");
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: "app-9", name: "Figma" })
    );
    expect(toastSuccess).toHaveBeenCalledWith("App “Figma” created");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("validates inline before calling the server", async () => {
    renderDialog(vi.fn(), "F");
    await userEvent.type(screen.getByLabelText(/website/i), "figma");
    await userEvent.click(screen.getByRole("button", { name: "Create app" }));

    expect(
      await screen.findByText("Enter at least 2 characters")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/full address starting with https/i)
    ).toBeInTheDocument();
    expect(createApp).not.toHaveBeenCalled();
  });

  it("shows the server's permission error and keeps the dialog open", async () => {
    createApp.mockResolvedValue({
      success: false,
      message: "You do not have permission to create apps",
    });
    const { onCreated, onOpenChange } = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Create app" }));

    expect(
      await screen.findByText("You do not have permission to create apps")
    ).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("cannot be submitted twice while saving", async () => {
    let resolve: (v: unknown) => void = () => {};
    createApp.mockReturnValue(new Promise((r) => (resolve = r)));
    renderDialog();
    const submit = screen.getByRole("button", { name: "Create app" });
    await userEvent.click(submit);

    expect(
      await screen.findByRole("button", { name: /creating/i })
    ).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /creating/i }));
    expect(createApp).toHaveBeenCalledTimes(1);
    resolve({ success: true, data: { id: "a" } });
  });
});
