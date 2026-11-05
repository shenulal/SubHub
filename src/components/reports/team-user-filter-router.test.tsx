// src/components/reports/team-user-filter-router.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamUserFilterRouter } from "./team-user-filter-router";

// cmdk scrolls the active item into view; jsdom lacks the API.
Element.prototype.scrollIntoView = vi.fn();

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams("foo=bar"),
}));

const teams = [
  { id: "team-1", name: "Team A" },
  { id: "team-2", name: "Team B" },
];

const users = [
  {
    id: "user-1",
    name: "User A",
    email: "user-a@example.com",
    teamId: "team-1",
    teamName: "Team A",
  },
  {
    id: "user-2",
    name: "User B",
    email: "user-b@example.com",
    teamId: "team-2",
    teamName: "Team B",
  },
];

function pushedParams(): URLSearchParams {
  const url = mockPush.mock.calls.at(-1)![0] as string;
  return new URL(url, "http://localhost").searchParams;
}

describe("TeamUserFilterRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes several teams comma-separated and keeps other params", async () => {
    const user = userEvent.setup();
    render(
      <TeamUserFilterRouter
        basePath="/reports/cost"
        teamIds={["team-1"]}
        userIds={[]}
        teams={teams}
        users={users}
        includeAllOption
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Select team" }));
    await user.click(screen.getByRole("option", { name: /Team B/ }));

    expect(mockPush.mock.calls[0][0]).toContain("/reports/cost?");
    const params = pushedParams();
    expect(params.get("teamId")).toBe("team-1,team-2");
    expect(params.get("foo")).toBe("bar");
    expect(params.has("userId")).toBe(false);
  });

  it("drops users outside the new team selection", async () => {
    const user = userEvent.setup();
    render(
      <TeamUserFilterRouter
        basePath="/reports/cost"
        teamIds={["team-1", "team-2"]}
        userIds={["user-1", "user-2"]}
        teams={teams}
        users={users}
        includeAllOption
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Select team" }));
    await user.click(screen.getByRole("option", { name: /Team A/ }));

    const params = pushedParams();
    expect(params.get("teamId")).toBe("team-2");
    expect(params.get("userId")).toBe("user-2");
  });

  it("clearing every team removes the key (empty = all teams)", async () => {
    const user = userEvent.setup();
    render(
      <TeamUserFilterRouter
        basePath="/reports/cost"
        teamIds={["team-1"]}
        userIds={[]}
        teams={teams}
        users={users}
        includeAllOption
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Select team" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(pushedParams().has("teamId")).toBe(false);
  });

  it("keeps the team list when users change", async () => {
    const user = userEvent.setup();
    render(
      <TeamUserFilterRouter
        basePath="/reports/cost"
        teamIds={["team-1", "team-2"]}
        userIds={["user-1"]}
        teams={teams}
        users={users}
        includeAllOption
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Select user" }));
    await user.click(screen.getByRole("option", { name: /User B/ }));

    const params = pushedParams();
    expect(params.get("teamId")).toBe("team-1,team-2");
    expect(params.get("userId")).toBe("user-1,user-2");
  });
});
