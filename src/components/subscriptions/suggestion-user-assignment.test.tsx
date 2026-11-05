// src/components/subscriptions/suggestion-user-assignment.test.tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AvailableUser } from "./suggestion-user-assignment";
import { SuggestionUserAssignment } from "./suggestion-user-assignment";

// next-intl mock
vi.mock("next-intl", () => ({
  useTranslations:
    () => (key: string, values?: Record<string, string | number>) => {
      const msgs: Record<string, string> = {
        selectTeam: "Select team",
        unassigned: "Unassigned",
        selectUsers: "Select users",
        selectedCount: `{count} selected`,
        searchUsers: "Search users...",
        noUsersFound: "User not found",
      };
      let result = msgs[key] ?? key;
      if (values) {
        Object.entries(values).forEach(([k, v]) => {
          result = result.replace(`{${k}}`, String(v));
        });
      }
      return result;
    },
  useLocale: () => "en",
}));

// Mock shadcn/ui Popover (always open for test convenience)
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

vi.mock("@/components/ui/command", () => ({
  Command: ({ children }: { children: ReactNode }) => (
    <div data-testid="command">{children}</div>
  ),
  CommandInput: ({ placeholder }: { placeholder?: string }) => (
    <input placeholder={placeholder} data-testid="command-input" />
  ),
  CommandList: ({
    children,
    className,
    "data-testid": dataTestId,
  }: {
    children: ReactNode;
    className?: string;
    "data-testid"?: string;
  }) => (
    <div data-testid={dataTestId ?? "command-list"} className={className}>
      {children}
    </div>
  ),
  CommandEmpty: ({ children }: { children: ReactNode }) => (
    <div data-testid="command-empty">{children}</div>
  ),
  CommandGroup: ({
    children,
    heading,
  }: {
    children: ReactNode;
    heading?: string;
  }) => (
    <div data-testid="command-group">
      {heading && <div data-testid="command-group-heading">{heading}</div>}
      {children}
    </div>
  ),
  CommandItem: ({
    children,
    onSelect,
    value,
  }: {
    children: ReactNode;
    onSelect?: () => void;
    value?: string;
  }) => (
    <div
      data-testid="command-item"
      data-value={value}
      onClick={onSelect}
      role="option"
    >
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ScrollArea: ({ children, className, ...props }: Record<string, any>) => (
    <div data-testid="scroll-area" className={className} {...props}>
      {children}
    </div>
  ),
  ScrollBar: () => null,
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    className,
  }: {
    checked?: boolean | "indeterminate";
    onCheckedChange?: (v: boolean) => void;
    className?: string;
  }) => (
    <input
      type="checkbox"
      checked={checked === true}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      className={className}
      data-testid="checkbox"
      data-state={
        checked === "indeterminate"
          ? "indeterminate"
          : checked
            ? "checked"
            : "unchecked"
      }
    />
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

// Test data
const usersTeamA: AvailableUser[] = [
  {
    id: "u1",
    name: "Alice",
    email: "alice@example.com",
    teamId: "team-a",
    teamName: "Team A",
  },
  {
    id: "u2",
    name: "Bob",
    email: "bob@example.com",
    teamId: "team-a",
    teamName: "Team A",
  },
];

const usersTeamB: AvailableUser[] = [
  {
    id: "u3",
    name: "Charlie",
    email: "charlie@example.com",
    teamId: "team-b",
    teamName: "Team B",
  },
];

const usersUnassigned: AvailableUser[] = [
  {
    id: "u4",
    name: "Dave",
    email: "dave@example.com",
    teamId: null,
    teamName: null,
  },
];

const allUsers: AvailableUser[] = [
  ...usersTeamA,
  ...usersTeamB,
  ...usersUnassigned,
];

const singleTeamUsers: AvailableUser[] = [
  {
    id: "u1",
    name: "Alice",
    email: "alice@example.com",
    teamId: "team-a",
    teamName: "Team A",
  },
  {
    id: "u2",
    name: "Bob",
    email: "bob@example.com",
    teamId: "team-a",
    teamName: "Team A",
  },
];

describe("SuggestionUserAssignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("per-team CommandGroup heading rendering", () => {
    it("shows the team name and member count in each team CommandGroup heading", () => {
      render(
        <SuggestionUserAssignment
          availableUsers={allUsers}
          selectedUserIds={[]}
          onSelectedUserIdsChange={vi.fn()}
        />
      );

      const headings = screen.getAllByTestId("command-group-heading");
      const headingTexts = headings.map((h) => h.textContent);

      expect(
        headingTexts.some((t) => t?.includes("Team A") && t?.includes("2"))
      ).toBe(true);
      expect(
        headingTexts.some((t) => t?.includes("Team B") && t?.includes("1"))
      ).toBe(true);
    });

    it("shows Unassigned and the member count in the unassigned group heading", () => {
      render(
        <SuggestionUserAssignment
          availableUsers={allUsers}
          selectedUserIds={[]}
          onSelectedUserIdsChange={vi.fn()}
        />
      );

      const headings = screen.getAllByTestId("command-group-heading");
      const headingTexts = headings.map((h) => h.textContent);

      expect(
        headingTexts.some((t) => t?.includes("Unassigned") && t?.includes("1"))
      ).toBe(true);
    });
  });

  describe("team selection Popover visibility", () => {
    it("shows the team select button when there are 2+ teams", () => {
      render(
        <SuggestionUserAssignment
          availableUsers={allUsers}
          selectedUserIds={[]}
          onSelectedUserIdsChange={vi.fn()}
        />
      );

      expect(screen.getByTestId("team-select")).toBeInTheDocument();
    });

    it("hides the team select button when there is at most 1 team", () => {
      render(
        <SuggestionUserAssignment
          availableUsers={singleTeamUsers}
          selectedUserIds={[]}
          onSelectedUserIdsChange={vi.fn()}
        />
      );

      expect(screen.queryByTestId("team-select")).not.toBeInTheDocument();
    });

    it("hides the team select button when only users without a team exist", () => {
      render(
        <SuggestionUserAssignment
          availableUsers={usersUnassigned}
          selectedUserIds={[]}
          onSelectedUserIdsChange={vi.fn()}
        />
      );

      expect(screen.queryByTestId("team-select")).not.toBeInTheDocument();
    });
  });

  describe("selecting a team adds all its members", () => {
    it("adds every member of the selected team to selectedUserIds", () => {
      const onSelectedUserIdsChange = vi.fn();
      render(
        <SuggestionUserAssignment
          availableUsers={allUsers}
          selectedUserIds={[]}
          onSelectedUserIdsChange={onSelectedUserIdsChange}
        />
      );

      const teamCommandList = screen.getByTestId("team-command-list");
      const teamItems = within(teamCommandList).getAllByTestId("command-item");
      const teamAItem = teamItems.find(
        (item) => item.getAttribute("data-value") === "team-a"
      );
      expect(teamAItem).toBeTruthy();
      fireEvent.click(teamAItem!);

      expect(onSelectedUserIdsChange).toHaveBeenCalledWith(
        expect.arrayContaining(["u1", "u2"])
      );
    });

    it("adds to existing selections when a team is selected", () => {
      const onSelectedUserIdsChange = vi.fn();
      render(
        <SuggestionUserAssignment
          availableUsers={allUsers}
          selectedUserIds={["u3"]}
          onSelectedUserIdsChange={onSelectedUserIdsChange}
        />
      );

      const teamCommandList = screen.getByTestId("team-command-list");
      const teamItems = within(teamCommandList).getAllByTestId("command-item");
      const teamAItem = teamItems.find(
        (item) => item.getAttribute("data-value") === "team-a"
      );
      expect(teamAItem).toBeTruthy();
      fireEvent.click(teamAItem!);

      const called = onSelectedUserIdsChange.mock.calls[0][0] as string[];
      expect(called).toContain("u3");
      expect(called).toContain("u1");
      expect(called).toContain("u2");
    });

    it("removes every team member when a fully selected team is selected again", () => {
      const onSelectedUserIdsChange = vi.fn();
      render(
        <SuggestionUserAssignment
          availableUsers={allUsers}
          selectedUserIds={["u1", "u2", "u3"]}
          onSelectedUserIdsChange={onSelectedUserIdsChange}
        />
      );

      const teamCommandList = screen.getByTestId("team-command-list");
      const teamItems = within(teamCommandList).getAllByTestId("command-item");
      const teamAItem = teamItems.find(
        (item) => item.getAttribute("data-value") === "team-a"
      );
      expect(teamAItem).toBeTruthy();
      fireEvent.click(teamAItem!);

      const called = onSelectedUserIdsChange.mock.calls[0][0] as string[];
      expect(called).not.toContain("u1");
      expect(called).not.toContain("u2");
      expect(called).toContain("u3");
    });
  });

  describe("unassigned group shown separately", () => {
    it("shows users with a null teamId in the unassigned group", () => {
      render(
        <SuggestionUserAssignment
          availableUsers={allUsers}
          selectedUserIds={[]}
          onSelectedUserIdsChange={vi.fn()}
        />
      );

      const headings = screen.getAllByTestId("command-group-heading");
      const unassignedHeading = headings.find((h) =>
        h.textContent?.includes("Unassigned")
      );
      expect(unassignedHeading).toBeInTheDocument();

      // Dave should be in a CommandItem of the unassigned group
      expect(screen.getByText("Dave")).toBeInTheDocument();
    });
  });

  describe("individual user toggle", () => {
    it("calls onSelectedUserIdsChange with the user added when a user CommandItem is clicked", () => {
      const onSelectedUserIdsChange = vi.fn();
      render(
        <SuggestionUserAssignment
          availableUsers={singleTeamUsers}
          selectedUserIds={[]}
          onSelectedUserIdsChange={onSelectedUserIdsChange}
        />
      );

      // Click Alice's CommandItem
      const items = screen.getAllByTestId("command-item");
      const aliceItem = items.find((item) =>
        item.textContent?.includes("Alice")
      );
      expect(aliceItem).toBeTruthy();
      fireEvent.click(aliceItem!);

      expect(onSelectedUserIdsChange).toHaveBeenCalledWith(["u1"]);
    });

    it("deselects an already selected user when its CommandItem is clicked", () => {
      const onSelectedUserIdsChange = vi.fn();
      render(
        <SuggestionUserAssignment
          availableUsers={singleTeamUsers}
          selectedUserIds={["u1"]}
          onSelectedUserIdsChange={onSelectedUserIdsChange}
        />
      );

      const items = screen.getAllByTestId("command-item");
      const aliceItem = items.find((item) =>
        item.textContent?.includes("Alice")
      );
      expect(aliceItem).toBeTruthy();
      fireEvent.click(aliceItem!);

      expect(onSelectedUserIdsChange).toHaveBeenCalledWith([]);
    });
  });

  describe("removing a user via the badge X", () => {
    it("removes the user from selectedUserIds when the badge X button is clicked", () => {
      const onSelectedUserIdsChange = vi.fn();
      render(
        <SuggestionUserAssignment
          availableUsers={singleTeamUsers}
          selectedUserIds={["u1", "u2"]}
          onSelectedUserIdsChange={onSelectedUserIdsChange}
        />
      );

      // Find Alice's badge in the badge list
      const badges = screen.getAllByTestId("badge");
      const aliceBadge = badges.find((b) => b.textContent?.includes("Alice"));
      expect(aliceBadge).toBeTruthy();

      // Click the X button
      const removeButton = within(aliceBadge!).getByRole("button");
      fireEvent.click(removeButton);

      expect(onSelectedUserIdsChange).toHaveBeenCalledWith(["u2"]);
    });
  });

  describe("maxUsers limit when selecting a whole team", () => {
    it("adds only as many users as there are remaining seats when selecting a whole team", () => {
      const onSelectedUserIdsChange = vi.fn();
      const onSeatLimitReached = vi.fn();
      render(
        <SuggestionUserAssignment
          availableUsers={allUsers}
          selectedUserIds={["u3"]}
          onSelectedUserIdsChange={onSelectedUserIdsChange}
          maxUsers={2}
          onSeatLimitReached={onSeatLimitReached}
        />
      );

      // Try selecting Team A (u1, u2) -> remaining seats = 2 - 1 = 1, so only 1 user is added
      const teamCommandList = screen.getByTestId("team-command-list");
      const teamItems = within(teamCommandList).getAllByTestId("command-item");
      const teamAItem = teamItems.find(
        (item) => item.getAttribute("data-value") === "team-a"
      );
      fireEvent.click(teamAItem!);

      const called = onSelectedUserIdsChange.mock.calls[0][0] as string[];
      expect(called).toHaveLength(2); // 1 existing + 1 new
      expect(called).toContain("u3"); // existing user kept
    });

    it("calls onSeatLimitReached when selecting a team with 0 remaining seats", () => {
      const onSelectedUserIdsChange = vi.fn();
      const onSeatLimitReached = vi.fn();
      render(
        <SuggestionUserAssignment
          availableUsers={allUsers}
          selectedUserIds={["u3"]}
          onSelectedUserIdsChange={onSelectedUserIdsChange}
          maxUsers={1}
          onSeatLimitReached={onSeatLimitReached}
        />
      );

      const teamCommandList = screen.getByTestId("team-command-list");
      const teamItems = within(teamCommandList).getAllByTestId("command-item");
      const teamAItem = teamItems.find(
        (item) => item.getAttribute("data-value") === "team-a"
      );
      fireEvent.click(teamAItem!);

      expect(onSeatLimitReached).toHaveBeenCalled();
      expect(onSelectedUserIdsChange).not.toHaveBeenCalled();
    });

    it("adds the whole team without limit when maxUsers is undefined", () => {
      const onSelectedUserIdsChange = vi.fn();
      render(
        <SuggestionUserAssignment
          availableUsers={allUsers}
          selectedUserIds={[]}
          onSelectedUserIdsChange={onSelectedUserIdsChange}
        />
      );

      const teamCommandList = screen.getByTestId("team-command-list");
      const teamItems = within(teamCommandList).getAllByTestId("command-item");
      const teamAItem = teamItems.find(
        (item) => item.getAttribute("data-value") === "team-a"
      );
      fireEvent.click(teamAItem!);

      const called = onSelectedUserIdsChange.mock.calls[0][0] as string[];
      expect(called).toContain("u1");
      expect(called).toContain("u2");
    });
  });

  describe("team checkbox indeterminate state", () => {
    it("shows an indeterminate checkbox when the team is partially selected", () => {
      render(
        <SuggestionUserAssignment
          availableUsers={allUsers}
          selectedUserIds={["u1"]}
          onSelectedUserIdsChange={vi.fn()}
        />
      );

      const teamCommandList = screen.getByTestId("team-command-list");
      const teamAItem = within(teamCommandList)
        .getAllByTestId("command-item")
        .find((item) => item.getAttribute("data-value") === "team-a");
      const checkbox = within(teamAItem!).getByTestId("checkbox");

      expect(checkbox).toHaveAttribute("data-state", "indeterminate");
    });

    it("shows a checked checkbox when the whole team is selected", () => {
      render(
        <SuggestionUserAssignment
          availableUsers={allUsers}
          selectedUserIds={["u1", "u2"]}
          onSelectedUserIdsChange={vi.fn()}
        />
      );

      const teamCommandList = screen.getByTestId("team-command-list");
      const teamAItem = within(teamCommandList)
        .getAllByTestId("command-item")
        .find((item) => item.getAttribute("data-value") === "team-a");
      const checkbox = within(teamAItem!).getByTestId("checkbox");

      expect(checkbox).toHaveAttribute("data-state", "checked");
    });

    it("shows an unchecked checkbox when the team is not selected", () => {
      render(
        <SuggestionUserAssignment
          availableUsers={allUsers}
          selectedUserIds={[]}
          onSelectedUserIdsChange={vi.fn()}
        />
      );

      const teamCommandList = screen.getByTestId("team-command-list");
      const teamAItem = within(teamCommandList)
        .getAllByTestId("command-item")
        .find((item) => item.getAttribute("data-value") === "team-a");
      const checkbox = within(teamAItem!).getByTestId("checkbox");

      expect(checkbox).toHaveAttribute("data-state", "unchecked");
    });
  });

  describe("maxUsers limit", () => {
    it("calls onSeatLimitReached when adding a user after reaching maxUsers", () => {
      const onSeatLimitReached = vi.fn();
      const onSelectedUserIdsChange = vi.fn();
      render(
        <SuggestionUserAssignment
          availableUsers={singleTeamUsers}
          selectedUserIds={["u1"]}
          onSelectedUserIdsChange={onSelectedUserIdsChange}
          maxUsers={1}
          onSeatLimitReached={onSeatLimitReached}
        />
      );

      // Try to add Bob
      const items = screen.getAllByTestId("command-item");
      const bobItem = items.find((item) => item.textContent?.includes("Bob"));
      expect(bobItem).toBeTruthy();
      fireEvent.click(bobItem!);

      expect(onSeatLimitReached).toHaveBeenCalled();
      expect(onSelectedUserIdsChange).not.toHaveBeenCalled();
    });

    it("adds the user normally when maxUsers has not been reached", () => {
      const onSeatLimitReached = vi.fn();
      const onSelectedUserIdsChange = vi.fn();
      render(
        <SuggestionUserAssignment
          availableUsers={singleTeamUsers}
          selectedUserIds={[]}
          onSelectedUserIdsChange={onSelectedUserIdsChange}
          maxUsers={2}
          onSeatLimitReached={onSeatLimitReached}
        />
      );

      const items = screen.getAllByTestId("command-item");
      const aliceItem = items.find((item) =>
        item.textContent?.includes("Alice")
      );
      fireEvent.click(aliceItem!);

      expect(onSeatLimitReached).not.toHaveBeenCalled();
      expect(onSelectedUserIdsChange).toHaveBeenCalledWith(["u1"]);
    });
  });
});
