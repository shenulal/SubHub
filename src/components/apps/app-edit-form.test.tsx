// src/components/apps/app-edit-form.test.tsx
import type { AppDetail } from "@/types/app";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppEditForm } from "./app-edit-form";

vi.mock("@/components/ui/select", () => {
  const Select = ({
    children,
    value,
    onValueChange,
    disabled,
  }: {
    children?: React.ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
  }) => (
    <select
      data-testid="select-mock"
      value={value ?? ""}
      onChange={(event) => onValueChange?.(event.target.value)}
      disabled={disabled}
    >
      {children}
    </select>
  );
  const SelectTrigger = ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  );
  const SelectValue = ({ placeholder }: { placeholder?: string }) => (
    <option value="">{placeholder}</option>
  );
  const SelectContent = ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  );
  const SelectItem = ({
    children,
    value,
  }: {
    children?: React.ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>;
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

const mockRouter = {
  push: vi.fn(),
  back: vi.fn(),
};

let mockValues: Record<string, string>;
const mockOnFinish = vi.fn();
let mockErrors: Record<string, { message: string }>;
let mockFormLoading = false;
let mockIsSubmitting = false;
let mockMutationResult: Record<string, unknown> | undefined;

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("react-hook-form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-hook-form")>();
  return {
    ...actual,
    Controller: ({
      name,
      render,
    }: {
      name: string;
      render: (props: unknown) => React.ReactElement;
    }) =>
      render({
        field: {
          name,
          value: mockValues[name],
          onChange: (value: string) => {
            mockValues[name] = value;
          },
        },
      }),
  };
});

vi.mock("@refinedev/react-hook-form", () => ({
  useForm: (options?: { defaultValues?: Record<string, string> }) => {
    mockValues = { ...(options?.defaultValues ?? {}) };
    return {
      refineCore: {
        onFinish: mockOnFinish,
        formLoading: mockFormLoading,
        mutationResult: mockMutationResult,
      },
      handleSubmit: (cb: (values: Record<string, string>) => unknown) => () =>
        cb({ ...mockValues } as Record<string, string>),
      register: (name: string) => ({
        name,
        defaultValue: mockValues[name] ?? "",
        onChange: (event: { target: { value: string } }) => {
          mockValues[name] = event.target.value;
        },
        onBlur: vi.fn(),
        ref: vi.fn(),
      }),
      control: {},
      setValue: (name: string, value: unknown) => {
        mockValues[name] = value as string;
      },
      formState: { errors: mockErrors, isSubmitting: mockIsSubmitting },
    };
  },
}));

const mockApp: AppDetail = {
  id: "app-1",
  name: "Slack",
  status: "ACTIVE",
  source: "MANUAL",
  category: "Collaboration",
  catalogId: null,
  customLogoUrl: "https://example.com/slack.png",
  catalogLogoUrl: null,
  customWebsite: "https://slack.com",
  notes: "Team communication tool",
  tags: ["chat", "team"],
  riskScore: null,
  discoveredAt: null,
  ownerName: "John Smith",
  ownerEmail: "hong@test.com",
  subscriptionCount: 2,
  userAccessCount: 10,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-02"),
  teams: [],
};

describe("AppEditForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValues = {};
    mockErrors = {};
    mockFormLoading = false;
    mockIsSubmitting = false;
    mockMutationResult = undefined;
    mockOnFinish.mockResolvedValue({ data: { id: "app-1" } });
  });

  it("pre-fills the form with the existing app data", () => {
    mockValues = {
      name: mockApp.name,
      status: mockApp.status,
      category: mockApp.category ?? "",
      customLogoUrl: mockApp.customLogoUrl ?? "",
      customWebsite: mockApp.customWebsite ?? "",
      notes: mockApp.notes ?? "",
      tags: mockApp.tags.join(", "),
    };
    render(<AppEditForm app={mockApp} />);

    expect(screen.getByDisplayValue("Slack")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Collaboration")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("https://example.com/slack.png")
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://slack.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("chat, team")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Team communication tool")
    ).toBeInTheDocument();
  });

  it("has save and cancel buttons", () => {
    render(<AppEditForm app={mockApp} />);

    expect(screen.getByRole("button", { name: /Save/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeInTheDocument();
  });

  it("has a status select field", () => {
    mockValues = {
      name: mockApp.name,
      status: mockApp.status,
      category: mockApp.category ?? "",
      customLogoUrl: mockApp.customLogoUrl ?? "",
      customWebsite: mockApp.customWebsite ?? "",
      notes: mockApp.notes ?? "",
      tags: mockApp.tags.join(", "),
    };
    render(<AppEditForm app={mockApp} />);

    expect(screen.getByTestId("select-mock")).toBeInTheDocument();
  });

  it("navigates back when cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<AppEditForm app={mockApp} />);

    const cancelButton = screen.getByRole("button", { name: /Cancel/ });
    await user.click(cancelButton);

    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("navigates to the app detail page after a successful submit", async () => {
    const user = userEvent.setup();
    render(<AppEditForm app={mockApp} />);

    const submitButton = screen.getByRole("button", { name: /Save/ });
    await user.click(submitButton);

    await vi.waitFor(() => {
      expect(mockOnFinish).toHaveBeenCalled();
    });

    await vi.waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/apps/app-1");
    });
  });

  it("shows an error message on a server error", async () => {
    mockOnFinish.mockRejectedValueOnce(new Error("App not found"));

    const user = userEvent.setup();
    render(<AppEditForm app={mockApp} />);

    const submitButton = screen.getByRole("button", { name: /Save/ });
    await user.click(submitButton);

    await vi.waitFor(() => {
      expect(screen.getByText("App not found")).toBeInTheDocument();
    });
  });

  it("gives every form field the correct name attribute", () => {
    mockValues = {
      name: mockApp.name,
      status: mockApp.status,
      category: mockApp.category ?? "",
      customLogoUrl: mockApp.customLogoUrl ?? "",
      customWebsite: mockApp.customWebsite ?? "",
      notes: mockApp.notes ?? "",
      tags: mockApp.tags.join(", "),
    };
    render(<AppEditForm app={mockApp} />);

    expect(screen.getByLabelText(/App name/)).toHaveAttribute("name", "name");
    expect(screen.getByLabelText(/Category/)).toHaveAttribute(
      "name",
      "category"
    );
    expect(screen.getByLabelText(/Logo URL/)).toHaveAttribute(
      "name",
      "customLogoUrl"
    );
    expect(screen.getByLabelText(/Website/)).toHaveAttribute(
      "name",
      "customWebsite"
    );
    expect(screen.getByLabelText(/Tags/)).toHaveAttribute("name", "tags");
    expect(screen.getByLabelText(/Description/)).toHaveAttribute(
      "name",
      "notes"
    );
  });
});
