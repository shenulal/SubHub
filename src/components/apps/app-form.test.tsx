// src/components/apps/app-form.test.tsx
import messages from "@/i18n/messages/en.json";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppForm } from "./app-form";
import { APP_TEMPLATES } from "./app-templates";

// next-intl mock: provides a translation function backed by en.json messages
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

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

// Category master picker (fetches via a server action) replaced by a stub that
// selects a fixed master row.
vi.mock("@/components/taxonomy/category-picker", () => ({
  CategoryPicker: ({
    id,
    onChange,
  }: {
    id?: string;
    onChange: (id: string, node: { id: string; name: string }) => void;
  }) => (
    <button
      type="button"
      id={id}
      onClick={() =>
        onChange("cat-collab", { id: "cat-collab", name: "Collaboration" })
      }
    >
      pick category
    </button>
  ),
}));

vi.mock("@/actions/apps-form-options", () => ({
  getAppFormOptions: vi.fn().mockResolvedValue({
    success: true,
    data: {
      owners: [{ id: "u-1", name: "Owner One", email: "o@acme.test" }],
      teams: [],
      logoMaxSizeKb: 512,
    },
  }),
}));
vi.mock("@/actions/teams", () => ({
  getTeams: vi.fn().mockResolvedValue({ success: true, data: [] }),
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

const mockSetValue = vi.fn((name: string, value: unknown) => {
  mockValues[name] = value as string;
});

vi.mock("@refinedev/react-hook-form", () => ({
  useForm: (options?: { defaultValues?: Record<string, string> }) => {
    // Set defaults only on initialisation (do not overwrite existing values)
    if (Object.keys(mockValues).length === 0) {
      mockValues = { ...(options?.defaultValues ?? {}) };
    }
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
      setValue: mockSetValue,
      watch: (name: string) => mockValues[name] ?? "",
      formState: { errors: mockErrors, isSubmitting: mockIsSubmitting },
    };
  },
}));

describe("AppForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValues = {
      name: "",
      category: "",
      customWebsite: "",
      tags: "",
      notes: "",
    };
    mockErrors = {};
    mockFormLoading = false;
    mockIsSubmitting = false;
    mockMutationResult = undefined;
    mockOnFinish.mockResolvedValue({ data: { id: "new-app-1" } });
  });

  it("renders the required input fields", () => {
    render(<AppForm />);

    expect(screen.getByLabelText(/App name/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Register/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeInTheDocument();
  });

  it("renders the optional input fields", () => {
    render(<AppForm />);

    expect(screen.getByLabelText(/Category/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Website/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tags/)).toBeInTheDocument();
  });

  it("triggers native browser validation when the app name is empty", async () => {
    const user = userEvent.setup();
    render(<AppForm />);

    const nameInput = screen.getByLabelText(/App name/) as HTMLInputElement;
    const submitButton = screen.getByRole("button", { name: /Register/ });

    await user.click(submitButton);

    // HTML5 validation
    expect(nameInput.validity.valueMissing).toBe(true);
  });

  it("navigates back when cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<AppForm />);

    const cancelButton = screen.getByRole("button", { name: /Cancel/ });
    await user.click(cancelButton);

    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("navigates to the app list after a successful submit", async () => {
    const user = userEvent.setup();
    render(<AppForm />);

    const nameInput = screen.getByLabelText(/App name/);
    await user.type(nameInput, "New Test App");

    const submitButton = screen.getByRole("button", { name: /Register/ });
    await user.click(submitButton);

    await vi.waitFor(() => {
      expect(mockOnFinish).toHaveBeenCalled();
    });

    await vi.waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/apps/new-app-1");
    });
  });

  it("shows an error message on a server error", async () => {
    mockOnFinish.mockRejectedValueOnce(
      new Error("An app with this name already exists")
    );

    const user = userEvent.setup();
    render(<AppForm />);

    const nameInput = screen.getByLabelText(/App name/);
    await user.type(nameInput, "Existing App");

    const submitButton = screen.getByRole("button", { name: /Register/ });
    await user.click(submitButton);

    await vi.waitFor(() => {
      expect(
        screen.getByText("An app with this name already exists")
      ).toBeInTheDocument();
    });
  });

  it("disables the button while loading", async () => {
    mockFormLoading = true;

    const user = userEvent.setup();
    render(<AppForm />);

    const nameInput = screen.getByLabelText(/App name/);
    await user.type(nameInput, "Test App");

    const submitButton = screen.getByRole("button", { name: /Register/ });
    await user.click(submitButton);

    // During loading, button should be disabled
    await vi.waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  it("submits all fields correctly", async () => {
    const user = userEvent.setup();
    render(<AppForm />);

    await user.type(screen.getByLabelText(/App name/), "Slack");
    await user.click(screen.getByLabelText(/Category/));
    await user.type(screen.getByLabelText(/Website/), "https://slack.com");
    await user.type(screen.getByLabelText(/Tags/), "chat, team, messaging");
    await user.type(
      screen.getByLabelText(/Description/),
      "Team communication tool"
    );

    const submitButton = screen.getByRole("button", { name: /Register/ });
    await user.click(submitButton);

    await vi.waitFor(() => {
      expect(mockOnFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "Collaboration",
          categoryId: "cat-collab",
          customWebsite: "https://slack.com",
          name: "Slack",
          notes: "Team communication tool",
          tags: "chat, team, messaging",
        })
      );
    });
  });

  describe("template feature", () => {
    it("renders the quick input template buttons", () => {
      render(<AppForm />);

      expect(screen.getByText("Quick input:")).toBeInTheDocument();
      APP_TEMPLATES.forEach((template) => {
        expect(screen.getByAltText(template.name)).toBeInTheDocument();
      });
    });

    it("fills the form automatically when the Slack template is clicked", async () => {
      const user = userEvent.setup();
      render(<AppForm />);

      const slackButton = screen.getByAltText("Slack").closest("button");
      expect(slackButton).toBeInTheDocument();
      await user.click(slackButton!);

      const slackTemplate = APP_TEMPLATES.find((t) => t.id === "slack")!;
      expect(mockSetValue).toHaveBeenCalledWith("name", slackTemplate.name);
      expect(mockSetValue).toHaveBeenCalledWith(
        "category",
        slackTemplate.category
      );
      expect(mockSetValue).toHaveBeenCalledWith(
        "customWebsite",
        slackTemplate.website
      );
      expect(mockSetValue).toHaveBeenCalledWith("customLogoUrl", "");
      expect(mockSetValue).toHaveBeenCalledWith(
        "tags",
        slackTemplate.tags!["en"]
      );
    });

    it("fills the form automatically when the Claude template is clicked", async () => {
      const user = userEvent.setup();
      render(<AppForm />);

      const claudeButton = screen.getByAltText("Claude").closest("button");
      expect(claudeButton).toBeInTheDocument();
      await user.click(claudeButton!);

      const claudeTemplate = APP_TEMPLATES.find((t) => t.id === "claude")!;
      expect(mockSetValue).toHaveBeenCalledWith("name", claudeTemplate.name);
      expect(mockSetValue).toHaveBeenCalledWith(
        "category",
        claudeTemplate.category
      );
      expect(mockSetValue).toHaveBeenCalledWith(
        "customWebsite",
        claudeTemplate.website
      );
      expect(mockSetValue).toHaveBeenCalledWith("customLogoUrl", "");
      expect(mockSetValue).toHaveBeenCalledWith(
        "tags",
        claudeTemplate.tags!["en"]
      );
    });

    it("fills the form automatically when the ChatGPT template is clicked", async () => {
      const user = userEvent.setup();
      render(<AppForm />);

      const openaiButton = screen.getByAltText("ChatGPT").closest("button");
      expect(openaiButton).toBeInTheDocument();
      await user.click(openaiButton!);

      const openaiTemplate = APP_TEMPLATES.find((t) => t.id === "openai")!;
      expect(mockSetValue).toHaveBeenCalledWith("name", openaiTemplate.name);
      expect(mockSetValue).toHaveBeenCalledWith(
        "category",
        openaiTemplate.category
      );
      expect(mockSetValue).toHaveBeenCalledWith(
        "customWebsite",
        openaiTemplate.website
      );
      expect(mockSetValue).toHaveBeenCalledWith("customLogoUrl", "");
      expect(mockSetValue).toHaveBeenCalledWith(
        "tags",
        openaiTemplate.tags!["en"]
      );
    });

    it("fills the form automatically when the Cursor template is clicked", async () => {
      const user = userEvent.setup();
      render(<AppForm />);

      const cursorButton = screen.getByAltText("Cursor").closest("button");
      expect(cursorButton).toBeInTheDocument();
      await user.click(cursorButton!);

      const cursorTemplate = APP_TEMPLATES.find((t) => t.id === "cursor")!;
      expect(mockSetValue).toHaveBeenCalledWith("name", cursorTemplate.name);
      expect(mockSetValue).toHaveBeenCalledWith(
        "category",
        cursorTemplate.category
      );
      expect(mockSetValue).toHaveBeenCalledWith(
        "customWebsite",
        cursorTemplate.website
      );
      expect(mockSetValue).toHaveBeenCalledWith("customLogoUrl", "");
      expect(mockSetValue).toHaveBeenCalledWith(
        "tags",
        cursorTemplate.tags!["en"]
      );
    });

    it("disables the template buttons while loading", () => {
      mockFormLoading = true;
      render(<AppForm />);

      APP_TEMPLATES.forEach((template) => {
        const button = screen.getByAltText(template.name).closest("button");
        expect(button).toBeDisabled();
      });
    });
  });
});
