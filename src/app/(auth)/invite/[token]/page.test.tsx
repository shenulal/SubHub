// src/app/(auth)/invite/[token]/page.test.tsx
import { acceptInvitation } from "@/actions/invitations";
import messages from "@/i18n/messages/en.json";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InviteAcceptPage from "./page";

const getMessage = (key: string): string => {
  return key.split(".").reduce((acc, part) => {
    if (typeof acc === "object" && acc !== null && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return key;
  }, messages as unknown) as string;
};

const formatMessage = (
  template: string,
  values?: Record<string, string | number>
) => {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, token) =>
    values[token] !== undefined ? String(values[token]) : `{${token}}`
  );
};

vi.mock("@/actions/invitations", () => ({
  acceptInvitation: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations:
    async () => (key: string, values?: Record<string, string | number>) =>
      formatMessage(getMessage(key), values),
}));

describe("InviteAcceptPage", () => {
  it("shows the success message", async () => {
    vi.mocked(acceptInvitation).mockResolvedValue({
      success: true,
      message: "The invitation has been accepted",
    });

    const page = await InviteAcceptPage({
      params: Promise.resolve({ token: "token-1" }),
    });
    render(page);

    expect(screen.getByText(/Invitation accepted/)).toBeInTheDocument();
  });

  it("shows the error message on failure", async () => {
    vi.mocked(acceptInvitation).mockResolvedValue({
      success: false,
      message: "The invitation has expired",
    });

    const page = await InviteAcceptPage({
      params: Promise.resolve({ token: "token-1" }),
    });
    render(page);

    expect(screen.getByText(/The invitation has expired/)).toBeInTheDocument();
    expect(screen.getByText(/Go to login/)).toBeInTheDocument();
  });
});
