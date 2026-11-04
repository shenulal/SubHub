import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CategoryBadge } from "./category-badge";

describe("CategoryBadge", () => {
  it("renders the uncategorised fallback", () => {
    render(<CategoryBadge category={null} />);
    expect(screen.getByText("Uncategorised")).toBeInTheDocument();
  });
  it("renders name, parent prefix and colour dot", () => {
    const { container } = render(
      <CategoryBadge
        category={{ name: "Design", color: "#ff0000" }}
        parentName="Software"
      />
    );
    expect(screen.getByText("Design")).toBeInTheDocument();
    expect(screen.getByText("Software ›")).toBeInTheDocument();
    expect(container.querySelector("span[aria-hidden]")).toHaveStyle({
      backgroundColor: "#ff0000",
    });
  });
});
