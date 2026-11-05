// src/components/subscriptions/subscription-form-pricing.test.tsx
import messages from "@/i18n/messages/en.json";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionFormPricing } from "./subscription-form-pricing";

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const value = path.split(".").reduce<unknown>((acc, key) => {
    if (
      acc &&
      typeof acc === "object" &&
      key in (acc as Record<string, unknown>)
    ) {
      return (acc as Record<string, unknown>)[key];
    }
    return path;
  }, obj);
  return typeof value === "string" ? value : path;
}

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    return (key: string, values?: Record<string, string | number>) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      let result = getNestedValue(
        messages as unknown as Record<string, unknown>,
        fullKey
      );
      if (values) {
        Object.entries(values).forEach(([k, v]) => {
          result = result.replace(`{${k}}`, String(v));
        });
      }
      return result;
    };
  },
  useLocale: () => "en",
}));

// Inline currency creation pulls in server actions; not under test here.
vi.mock("@/components/platform/masters/currency-dialog", () => ({
  CurrencyDialog: () => null,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
    name,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
    disabled?: boolean;
    name?: string;
  }) => (
    <div data-testid={`select-${name ?? "default"}`}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(
            child as React.ReactElement<Record<string, unknown>>,
            { value, onValueChange, disabled }
          );
        }
        return child;
      })}
    </div>
  ),
  SelectTrigger: ({
    children,
    id,
  }: {
    children: React.ReactNode;
    id?: string;
  }) => (
    <button role="combobox" id={id}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>,
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/ui/command", () => ({
  Command: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CommandInput: ({ placeholder }: { placeholder?: string }) => (
    <input placeholder={placeholder} />
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CommandEmpty: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CommandGroup: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CommandItem: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    id,
  }: {
    checked?: boolean;
    onCheckedChange?: (v: boolean) => void;
    id?: string;
  }) => (
    <input
      type="checkbox"
      checked={checked ?? false}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      id={id}
    />
  ),
}));

let mockWatchValues: Record<string, unknown> = {};

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
          value: mockWatchValues[name],
          onChange: (value: string) => {
            mockWatchValues[name] = value;
          },
        },
      }),
    useWatch: ({ name }: { name: string }) => mockWatchValues[name],
  };
});

const mockRegister = (name: string) => ({
  name,
  defaultValue: "",
  onChange: vi.fn(),
  onBlur: vi.fn(),
  ref: vi.fn(),
});

const mockSetValue = vi.fn();

describe("SubscriptionFormPricing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWatchValues = {
      billingType: "FLAT_RATE",
      totalLicenses: undefined,
    };
  });

  const defaultProps = {
    control: {} as never,
    register: mockRegister as never,
    setValue: mockSetValue as never,
    errors: {},
    isPending: false,
    defaultCurrency: "KRW",
    users: [],
    isAdmin: false,
    selectedUserIds: [],
  };

  it("shows the pricing card title", () => {
    render(<SubscriptionFormPricing {...defaultProps} />);

    expect(screen.getByText("Pricing")).toBeInTheDocument();
  });

  it("shows the billing cycle and billing type selects", () => {
    render(<SubscriptionFormPricing {...defaultProps} />);

    expect(screen.getByText("Billing cycle *")).toBeInTheDocument();
    expect(screen.getByText("Billing Type")).toBeInTheDocument();
  });

  it("shows the currency and amount fields", () => {
    render(<SubscriptionFormPricing {...defaultProps} />);

    expect(screen.getByText("Currency")).toBeInTheDocument();
    expect(screen.getByText("Amount *")).toBeInTheDocument();
  });

  it("hides seat management for FLAT_RATE", () => {
    render(<SubscriptionFormPricing {...defaultProps} />);

    expect(screen.queryByText(/Total seats/)).not.toBeInTheDocument();
  });

  it("shows seat management for PER_SEAT", () => {
    mockWatchValues = { billingType: "PER_SEAT", totalLicenses: 50 };
    render(<SubscriptionFormPricing {...defaultProps} />);

    expect(screen.getByText(/Total seats/)).toBeInTheDocument();
  });

  it("shows user assignment for PER_SEAT + isAdmin + users", () => {
    mockWatchValues = { billingType: "PER_SEAT", totalLicenses: 50 };
    const users = [
      { id: "u1", name: "User 1", email: "u1@test.com", teamId: null },
    ];
    render(
      <SubscriptionFormPricing {...defaultProps} isAdmin={true} users={users} />
    );

    expect(screen.getByText("Assign users")).toBeInTheDocument();
  });

  it("shows the amount error message", () => {
    render(
      <SubscriptionFormPricing
        {...defaultProps}
        errors={{
          amount: { message: "Please enter an amount", type: "required" },
        }}
      />
    );

    expect(screen.getByText("Please enter an amount")).toBeInTheDocument();
  });

  it("shows the billingCycle error message", () => {
    render(
      <SubscriptionFormPricing
        {...defaultProps}
        errors={{
          billingCycle: {
            message: "Please select a billing cycle",
            type: "required",
          },
        }}
      />
    );

    expect(
      screen.getByText("Please select a billing cycle")
    ).toBeInTheDocument();
  });

  it("disables the amount input when isPending=true", () => {
    render(<SubscriptionFormPricing {...defaultProps} isPending={true} />);

    const amountInput = screen.getByLabelText("Amount *");
    expect(amountInput).toBeDisabled();
  });
});
