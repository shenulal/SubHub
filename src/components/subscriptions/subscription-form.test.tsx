// src/components/subscriptions/subscription-form.test.tsx
import messages from "@/i18n/messages/en.json";
import type { SubscriptionDetail } from "@/types/subscription";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionForm } from "./subscription-form";
import type { AppWithTeams } from "./subscription-form-assignment";

// next-intl mock: translation function backed by the en.json messages
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

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock shadcn/ui components (radix-ui based -> avoids a duplicate React copy)
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
    ...props
  }: {
    children: React.ReactNode;
    id?: string;
    value?: string;
    onValueChange?: (v: string) => void;
    disabled?: boolean;
  }) => (
    <button
      role="combobox"
      id={id}
      aria-labelledby={id ? `label-${id}` : undefined}
    >
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
    ...props
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
      {...props}
    />
  ),
}));

// Server actions used by the vendor card
vi.mock("@/actions/taxonomy/catalog", () => ({
  searchCatalog: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/actions/taxonomy/auto-categorize", () => ({
  suggestCategory: vi.fn().mockResolvedValue({ categoryId: null }),
}));
vi.mock("@/actions/subscriptions/subscription-lifecycle", () => ({
  checkDuplicate: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Taxonomy-backed cards (rendered only with `options`; they pull server actions)
vi.mock("./subscription-form-classification", () => ({
  SubscriptionFormClassification: () => (
    <div data-testid="form-classification" />
  ),
}));
vi.mock("./subscription-form-terms", () => ({
  SubscriptionFormTerms: () => <div data-testid="form-terms" />,
}));

// Mock sub-components that also use radix-ui internally
vi.mock("./subscription-form-assignment", () => ({
  SubscriptionFormAssignment: () => <div data-testid="form-assignment" />,
}));

vi.mock("./subscription-form-period", () => ({
  SubscriptionFormPeriod: ({
    control,
    errors,
    isPending,
  }: {
    control: unknown;
    errors: Record<string, unknown>;
    isPending: boolean;
  }) => (
    <div data-testid="form-period">
      <label htmlFor="startDate">Start date *</label>
      <input id="startDate" type="date" />
    </div>
  ),
}));

vi.mock("./subscription-form-renewal", () => ({
  SubscriptionFormRenewal: ({
    control,
    isPending,
  }: {
    control: unknown;
    isPending: boolean;
  }) => (
    <div data-testid="form-renewal">
      <label>
        <input type="checkbox" defaultChecked />
        Auto renewal
      </label>
      <label>
        <input type="checkbox" defaultChecked />
        30 days before
      </label>
      <label>
        <input type="checkbox" />
        60 days before
      </label>
      <label>
        <input type="checkbox" />
        90 days before
      </label>
    </div>
  ),
}));

vi.mock("./subscription-form-pricing", () => ({
  SubscriptionFormPricing: ({
    errors,
    isPending,
    register,
  }: {
    errors: Record<string, { message?: string }>;
    isPending: boolean;
    register: (name: string) => Record<string, unknown>;
  }) => (
    <div data-testid="form-pricing">
      <label htmlFor="billingCycle">Billing cycle *</label>
      <label htmlFor="amount">Amount *</label>
      <input id="amount" type="number" {...register("amount")} />
      {errors.amount?.message && (
        <p className="text-destructive text-sm">{errors.amount.message}</p>
      )}
    </div>
  ),
}));

let mockValues: Record<string, unknown> = {};
let mockErrors: Record<string, { message: string }> = {};
let mockIsSubmitting = false;
let mockFormLoading = false;
let capturedOnFinishPayload: Record<string, unknown> | null = null;

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
    useWatch: ({ name }: { name: string }) => mockValues[name],
  };
});

vi.mock("@refinedev/react-hook-form", () => ({
  useForm: (options?: { defaultValues?: Record<string, unknown> }) => {
    mockValues = { ...(options?.defaultValues ?? {}) };
    return {
      refineCore: {
        onFinish: vi.fn(async (payload: Record<string, unknown>) => {
          capturedOnFinishPayload = payload;
          return { data: { id: "sub-1" } };
        }),
        formLoading: mockFormLoading,
      },
      handleSubmit: (cb: (values: Record<string, unknown>) => unknown) => () =>
        cb({ ...mockValues }),
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
        mockValues[name] = value;
      },
      formState: {
        errors: mockErrors,
        isSubmitting: mockIsSubmitting,
      },
    };
  },
}));

const mockApps: AppWithTeams[] = [
  {
    id: "app-1",
    name: "Slack",
    teams: [{ id: "team-1", name: "Engineering" }],
  },
  { id: "app-2", name: "Notion", teams: [] },
  { id: "app-3", name: "Jira", teams: [{ id: "team-2", name: "Design" }] },
];

const mockSubscription: SubscriptionDetail = {
  id: "sub-1",
  appId: "app-1",
  appName: "Slack",
  appLogoUrl: null,
  status: "ACTIVE",
  billingCycle: "MONTHLY",
  billingType: "FLAT_RATE",
  amount: 10000,
  perSeatPrice: null,
  currency: "KRW",
  totalLicenses: 100,
  usedLicenses: 80,
  startDate: new Date("2024-01-01"),
  endDate: null,
  renewalDate: new Date("2024-02-01"),
  autoRenewal: true,
  renewalAlert30: true,
  renewalAlert60: false,
  renewalAlert90: false,
  contractUrl: null,
  notes: "Test note",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  teamId: null,
  teamName: null,
  team: null,
  teams: [],
  assignedUsers: [],
  category: null,
  tags: [],
  owner: null,
  isPersonal: false,
  isTrial: false,
  trialEndsAt: null,
  cancellationDeadline: null,
  paymentMethod: null,
  costCenter: null,
  noticePeriodDays: null,
  reminderLeadDays: [],
  pausedAt: null,
  archivedAt: null,
  lastDetectedAmount: null,
  cancellationUrl: null,
  cancellationNotes: null,
  taxRate: null,
  customFieldValues: [],
  app: {
    catalogId: null,
    website: null,
    cancellationUrl: null,
    cancellationNotes: null,
  },
};

describe("SubscriptionForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValues = {};
    mockErrors = {};
    mockIsSubmitting = false;
    mockFormLoading = false;
    capturedOnFinishPayload = null;
  });

  describe("create mode", () => {
    it("renders an empty form", () => {
      render(<SubscriptionForm apps={mockApps} />);

      expect(screen.getByText(/Select app/)).toBeInTheDocument();
      expect(screen.getByText("Billing cycle *")).toBeInTheDocument();
      expect(screen.getByLabelText(/Amount/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Start date/)).toBeInTheDocument();
    });

    it("shows the add subscription button", () => {
      render(<SubscriptionForm apps={mockApps} />);

      expect(
        screen.getByRole("button", { name: /Add subscription/i })
      ).toBeInTheDocument();
    });

    it("has the app selection UI", () => {
      render(<SubscriptionForm apps={mockApps} />);

      expect(screen.getByText("Select an app")).toBeInTheDocument();
    });

    it("has the billing cycle UI", () => {
      render(<SubscriptionForm apps={mockApps} />);

      expect(screen.getByText("Billing cycle *")).toBeInTheDocument();
    });
  });

  describe("edit mode", () => {
    it("fills the form with existing data", () => {
      render(
        <SubscriptionForm apps={mockApps} subscription={mockSubscription} />
      );

      expect(screen.getByDisplayValue("10000")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Test note")).toBeInTheDocument();
    });

    it("shows the save button", () => {
      render(
        <SubscriptionForm apps={mockApps} subscription={mockSubscription} />
      );

      expect(screen.getByRole("button", { name: /Save/i })).toBeInTheDocument();
    });

    it("has the auto-renewal checkbox checked", () => {
      render(
        <SubscriptionForm apps={mockApps} subscription={mockSubscription} />
      );

      const autoRenewalCheckbox = screen.getByLabelText("Auto renewal");
      expect(autoRenewalCheckbox).toBeChecked();
    });

    it("sets the renewal alert checkbox states correctly", () => {
      render(
        <SubscriptionForm apps={mockApps} subscription={mockSubscription} />
      );

      expect(screen.getByLabelText("30 days before")).toBeChecked();
      expect(screen.getByLabelText("60 days before")).not.toBeChecked();
      expect(screen.getByLabelText("90 days before")).not.toBeChecked();
    });
  });

  describe("validation", () => {
    it("shows the required field labels", () => {
      render(<SubscriptionForm apps={mockApps} />);

      expect(screen.getByText("Select app *")).toBeInTheDocument();
      expect(screen.getByText("Billing cycle *")).toBeInTheDocument();
      expect(screen.getByText("Amount *")).toBeInTheDocument();
      expect(screen.getByText("Start date *")).toBeInTheDocument();
    });
  });

  describe("cancel button", () => {
    it("has a cancel button", () => {
      render(<SubscriptionForm apps={mockApps} />);

      const cancelButton = screen.getByRole("button", { name: /Cancel/i });
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe("layout", () => {
    it("uses a single column rather than a 2-column grid", () => {
      const { container } = render(<SubscriptionForm apps={mockApps} />);

      const gridDiv = container.querySelector(
        ".lg\\:grid-cols-\\[1fr_400px\\]"
      );
      expect(gridDiv).not.toBeInTheDocument();
    });

    it("has no contract card", () => {
      render(<SubscriptionForm apps={mockApps} />);

      expect(screen.queryByText("Contract")).not.toBeInTheDocument();
    });

    it("shows notes as a separate card at the bottom", () => {
      render(<SubscriptionForm apps={mockApps} />);

      expect(screen.getByText("Notes")).toBeInTheDocument();
    });

    it("renders the pricing subcomponent", () => {
      render(<SubscriptionForm apps={mockApps} />);

      expect(screen.getByTestId("form-pricing")).toBeInTheDocument();
    });

    it("includes the status field in the basic info card", () => {
      render(<SubscriptionForm apps={mockApps} />);

      expect(screen.getByText("Status")).toBeInTheDocument();
    });
  });

  describe("error messages", () => {
    it("shows the notes error message", () => {
      mockErrors = {
        notes: { message: "Notes must be 1000 characters or fewer" },
      };
      render(<SubscriptionForm apps={mockApps} />);
      expect(
        screen.getByText("Notes must be 1000 characters or fewer")
      ).toBeInTheDocument();
    });
  });

  describe("amount submission (amount is sent to the server as a string)", () => {
    it("passes amount as a string on submit", async () => {
      // subscription.amount = 10000 → defaultValues.amount = "10000"
      render(
        <SubscriptionForm apps={mockApps} subscription={mockSubscription} />
      );

      const form = screen
        .getByRole("button", { name: /Save/i })
        .closest("form");
      expect(form).toBeInTheDocument();

      form?.dispatchEvent(new Event("submit", { bubbles: true }));

      expect(capturedOnFinishPayload).not.toBeNull();
      expect(typeof capturedOnFinishPayload!.amount).toBe("string");
      expect(capturedOnFinishPayload!.amount).toBe("10000");
    });

    it("saves PER_SEAT subscriptions without perSeatPrice validation", async () => {
      const perSeatSub: SubscriptionDetail = {
        ...mockSubscription,
        billingType: "PER_SEAT",
        perSeatPrice: 1500,
      };
      render(<SubscriptionForm apps={mockApps} subscription={perSeatSub} />);

      const form = screen
        .getByRole("button", { name: /Save/i })
        .closest("form");
      form?.dispatchEvent(new Event("submit", { bubbles: true }));

      expect(capturedOnFinishPayload).not.toBeNull();
      // perSeatPrice is no longer part of the form schema
      expect(capturedOnFinishPayload!.perSeatPrice).toBeUndefined();
    });
  });

  describe("hideActions mode", () => {
    it("hides the action buttons when hideActions=true", () => {
      render(
        <SubscriptionForm apps={mockApps} hideActions formId="test-form" />
      );

      expect(
        screen.queryByRole("button", { name: /Add subscription/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Cancel/i })
      ).not.toBeInTheDocument();
    });

    it("sets formId on the form element", () => {
      const { container } = render(
        <SubscriptionForm apps={mockApps} hideActions formId="my-form" />
      );

      const form = container.querySelector("form#my-form");
      expect(form).toBeInTheDocument();
    });
  });
});
