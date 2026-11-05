/**
 * SMP-206: Markdown rendering tests for the AI side panel
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AiMarkdown } from "./ai-markdown";

describe("AiMarkdown", () => {
  it("renders headings", () => {
    render(<AiMarkdown content="## This is a title" />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent("This is a title");
  });

  it("renders bold text", () => {
    render(<AiMarkdown content="This is **bold** text" />);
    const bold = screen.getByText("bold");
    expect(bold.tagName).toBe("STRONG");
  });

  it("renders unordered lists", () => {
    render(<AiMarkdown content={"- Item 1\n- Item 2\n- Item 3"} />);
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it("renders ordered lists", () => {
    render(<AiMarkdown content="1. First\n2. Second\n3. Third" />);
    const list = screen.getByRole("list");
    expect(list.tagName).toBe("OL");
  });

  it("renders inline code", () => {
    render(<AiMarkdown content={"This is `code` here"} />);
    const code = screen.getByText("code");
    expect(code.tagName).toBe("CODE");
  });

  it("renders code blocks", () => {
    render(<AiMarkdown content={"```\nconst x = 1;\n```"} />);
    const code = screen.getByText("const x = 1;");
    expect(code.closest("pre")).toBeInTheDocument();
  });

  it("renders links", () => {
    render(<AiMarkdown content="[Google](https://google.com)" />);
    const link = screen.getByRole("link", { name: "Google" });
    expect(link).toHaveAttribute("href", "https://google.com");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders tables", () => {
    const md = "| Name | Value |\n|------|----|\n| A | 1 |\n| B | 2 |";
    render(<AiMarkdown content={md} />);
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it("renders plain text as a paragraph", () => {
    render(<AiMarkdown content="Hello there" />);
    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });

  it("handles an empty string safely", () => {
    const { container } = render(<AiMarkdown content="" />);
    expect(container).toBeInTheDocument();
  });
});
