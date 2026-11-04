// src/components/approvals/pending-approvals-card.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PendingApprovalsCard } from "./pending-approvals-card";

const getPendingApprovalsSummary = vi.hoisted(() => vi.fn());
vi.mock("@/actions/approvals/summary", () => ({ getPendingApprovalsSummary }));

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PendingApprovalsCard />
    </QueryClientProvider>
  );
}

describe("PendingApprovalsCard", () => {
  it("shows the count, committed monthly spend and the top requests", async () => {
    getPendingApprovalsSummary.mockResolvedValue({
      success: true,
      data: {
        count: 2,
        committedMonthly: 350,
        currency: "AED",
        items: [
          {
            id: "r1",
            serviceName: "Figma",
            vendorWebsite: null,
            amount: 3600,
            currency: "AED",
            billingCycle: "YEARLY",
            monthlyAmount: 300,
            seats: null,
            status: "PENDING",
            currentStep: 1,
            totalSteps: 2,
            submittedAt: "2026-03-01T00:00:00Z",
            decidedAt: null,
            requester: { id: "u", name: "Rania", email: "r@acme.test" },
            category: null,
            currentApprover: null,
            isAwaitingMe: false,
          },
        ],
      },
    });
    renderCard();
    expect(await screen.findByText("Figma")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/350/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Figma/ })).toHaveAttribute(
      "href",
      "/approvals/r1"
    );
  });

  it("renders the empty state", async () => {
    getPendingApprovalsSummary.mockResolvedValue({
      success: true,
      data: { count: 0, committedMonthly: 0, currency: "AED", items: [] },
    });
    renderCard();
    expect(
      await screen.findByText("No pending approvals right now.")
    ).toBeInTheDocument();
  });
});
