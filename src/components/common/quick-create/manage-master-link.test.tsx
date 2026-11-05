// src/components/common/quick-create/manage-master-link.test.tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { renderWithPermissions } from "@/test/permission-wrapper";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ManageMasterLink } from "./manage-master-link";

Element.prototype.scrollIntoView = vi.fn();

function CostCentreSelect() {
  return (
    <Select defaultValue="cc1">
      <SelectTrigger aria-label="Cost centre">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="cc1">FIN · Finance</SelectItem>
        <ManageMasterLink
          href="/settings/masters?tab=cost-centers"
          label="cost centres"
          permission="masters:manage"
        />
      </SelectContent>
    </Select>
  );
}

describe("ManageMasterLink", () => {
  it("shows a Manage link in the open list for managers only", async () => {
    renderWithPermissions(<CostCentreSelect />, ["masters:manage"]);
    expect(
      screen.queryByRole("link", { name: /manage/i })
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("combobox", { name: "Cost centre" })
    );
    expect(
      await screen.findByRole("link", { name: "Manage cost centres" })
    ).toHaveAttribute("href", "/settings/masters?tab=cost-centers");
  });

  it("is hidden without the manage permission", async () => {
    renderWithPermissions(<CostCentreSelect />, ["masters:read"]);
    await userEvent.click(
      screen.getByRole("combobox", { name: "Cost centre" })
    );
    expect(
      await screen.findByRole("option", { name: /FIN · Finance/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /manage/i })
    ).not.toBeInTheDocument();
  });
});
