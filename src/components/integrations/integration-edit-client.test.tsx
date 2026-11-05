// src/components/integrations/integration-edit-client.test.tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationEditClient } from "./integration-edit-client";

const mockUseShow = vi.fn();

vi.mock("@refinedev/core", () => ({
  useShow: (...args: unknown[]) => mockUseShow(...args),
}));

// Mock IntegrationStatusForm
vi.mock("@/components/integrations/integration-status-form", () => ({
  IntegrationStatusForm: ({
    id,
    defaultStatus,
  }: {
    id: string;
    defaultStatus: string;
  }) => (
    <div data-testid="status-form">
      ID: {id}, Status: {defaultStatus}
    </div>
  ),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const mockIntegrationData = {
  id: "int-1",
  name: "Google Workspace",
  provider: "GOOGLE_WORKSPACE",
  status: "ACTIVE",
};

describe("IntegrationEditClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseShow.mockReturnValue({
      query: {
        data: { data: mockIntegrationData },
        isLoading: false,
      },
    });
  });

  it("renders the integration edit page", () => {
    render(<IntegrationEditClient id="int-1" />);

    expect(screen.getByText("Edit integration status")).toBeInTheDocument();
    expect(screen.getByText(/Update integration status/)).toBeInTheDocument();
  });

  it("shows the loading state while loading", () => {
    mockUseShow.mockReturnValueOnce({
      query: { data: undefined, isLoading: true },
    });

    render(<IntegrationEditClient id="int-1" />);

    expect(screen.getByText(/Loading integration info/)).toBeInTheDocument();
  });

  it("passes the correct props to IntegrationStatusForm", () => {
    render(<IntegrationEditClient id="int-1" />);

    const form = screen.getByTestId("status-form");
    expect(form).toHaveTextContent("ID: int-1");
    expect(form).toHaveTextContent("Status: ACTIVE");
  });

  it("defaults the status to PENDING when there is no data", () => {
    mockUseShow.mockReturnValueOnce({
      query: { data: { data: {} }, isLoading: false },
    });

    render(<IntegrationEditClient id="int-1" />);

    const form = screen.getByTestId("status-form");
    expect(form).toHaveTextContent("Status: PENDING");
  });

  it("has a link back to the detail page", () => {
    render(<IntegrationEditClient id="int-1" />);

    const backLink = screen.getByRole("link");
    expect(backLink).toHaveAttribute("href", "/integrations/int-1");
  });

  it("calls useShow with the correct parameters", () => {
    render(<IntegrationEditClient id="int-123" />);

    expect(mockUseShow).toHaveBeenCalledWith({
      resource: "integrations",
      id: "int-123",
      queryOptions: {
        enabled: true,
      },
    });
  });
});
