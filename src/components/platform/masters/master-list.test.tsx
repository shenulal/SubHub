import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Table, TableBody } from "@/components/ui/table";

import {
  filterMasterRows,
  MasterListNoMatches,
  MasterListToolbar,
  useMasterList,
} from "./master-list";

interface Row {
  code: string;
  name: string;
  note: string | null;
  isActive: boolean;
}

const ROWS: Row[] = [
  { code: "VAT5", name: "VAT 5%", note: "UAE", isActive: true },
  { code: "VAT15", name: "VAT 15%", note: "KSA", isActive: true },
  { code: "OLD", name: "Legacy rate", note: null, isActive: false },
];

const options = {
  searchText: (r: Row) => [r.code, r.name, r.note],
  isActive: (r: Row) => r.isActive,
};

describe("filterMasterRows", () => {
  it("returns every row with no search and the all filter", () => {
    expect(filterMasterRows(ROWS, "", "all", options)).toHaveLength(3);
  });

  it("matches any searchable field, ignoring case and nulls", () => {
    expect(
      filterMasterRows(ROWS, "ksa", "all", options).map((r) => r.code)
    ).toEqual(["VAT15"]);
    expect(
      filterMasterRows(ROWS, " legacy ", "all", options).map((r) => r.code)
    ).toEqual(["OLD"]);
  });

  it("filters by status", () => {
    expect(
      filterMasterRows(ROWS, "", "active", options).map((r) => r.code)
    ).toEqual(["VAT5", "VAT15"]);
    expect(
      filterMasterRows(ROWS, "", "inactive", options).map((r) => r.code)
    ).toEqual(["OLD"]);
  });

  it("ignores the status filter when the master has no status", () => {
    expect(
      filterMasterRows(ROWS, "", "inactive", { searchText: (r) => [r.name] })
    ).toHaveLength(3);
  });
});

function Harness({ withStatus = true }: { withStatus?: boolean }) {
  const list = useMasterList(ROWS, {
    searchText: (r) => [r.code, r.name, r.note],
    isActive: withStatus ? (r) => r.isActive : undefined,
  });
  return (
    <div>
      <MasterListToolbar list={list} searchPlaceholder="Search tax rates" />
      <Table>
        <TableBody>
          {list.visible.length === 0 && <MasterListNoMatches colSpan={2} />}
          {list.visible.map((r) => (
            <tr key={r.code}>
              <td>{r.name}</td>
            </tr>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

describe("MasterListToolbar", () => {
  it("shows the count and narrows the list as the user types", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText("Showing 3 of 3")).toBeInTheDocument();

    await user.type(
      screen.getByRole("searchbox", { name: "Search tax rates" }),
      "vat 1"
    );

    expect(screen.getByText("VAT 15%")).toBeInTheDocument();
    expect(screen.queryByText("VAT 5%")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 3")).toBeInTheDocument();
  });

  it("says when nothing matches", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole("searchbox"), "zzz");
    expect(
      screen.getByText("No records match your search or filter.")
    ).toBeInTheDocument();
  });

  it("offers a status filter only for masters with a status", () => {
    const { unmount } = render(<Harness />);
    expect(
      screen.getByRole("combobox", { name: "Filter by status" })
    ).toHaveTextContent("All statuses");
    unmount();
    render(<Harness withStatus={false} />);
    expect(
      screen.queryByRole("combobox", { name: "Filter by status" })
    ).not.toBeInTheDocument();
  });
});
