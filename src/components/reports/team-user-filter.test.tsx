// src/components/reports/team-user-filter.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamUserFilter, usersForTeams } from "./team-user-filter";

// cmdk scrolls the active item into view; jsdom lacks the API.
Element.prototype.scrollIntoView = vi.fn();

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
  {
    id: "user-3",
    name: null,
    email: "solo@example.com",
    teamId: null,
    teamName: null,
  },
];

function setup(props: Partial<Parameters<typeof TeamUserFilter>[0]> = {}) {
  const onTeamsChange = vi.fn();
  const onUsersChange = vi.fn();
  render(
    <TeamUserFilter
      teamIds={[]}
      userIds={[]}
      teams={teams}
      users={users}
      onTeamsChange={onTeamsChange}
      onUsersChange={onUsersChange}
      {...props}
    />
  );
  return { onTeamsChange, onUsersChange, user: userEvent.setup() };
}

describe("usersForTeams", () => {
  it("returns every user when no team is selected (empty = all)", () => {
    expect(usersForTeams(users, [])).toHaveLength(3);
  });

  it("keeps members of any selected team", () => {
    expect(usersForTeams(users, ["team-1", "team-2"]).map((u) => u.id)).toEqual(
      ["user-1", "user-2"]
    );
  });
});

describe("TeamUserFilter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the 'all' placeholders when nothing is selected", () => {
    setup();
    expect(
      screen.getByRole("combobox", { name: "Select team" })
    ).toHaveTextContent("All teams");
    expect(
      screen.getByRole("combobox", { name: "Select user" })
    ).toHaveTextContent("All users");
  });

  it("selects several teams", async () => {
    const { user, onTeamsChange } = setup({ teamIds: ["team-1"] });
    await user.click(screen.getByRole("combobox", { name: "Select team" }));
    await user.click(screen.getByRole("option", { name: /Team B/ }));
    expect(onTeamsChange).toHaveBeenLastCalledWith(["team-1", "team-2"], []);
  });

  it("prunes picked users that leave the team selection", async () => {
    const { user, onTeamsChange } = setup({
      teamIds: ["team-1", "team-2"],
      userIds: ["user-1", "user-2"],
    });
    await user.click(screen.getByRole("combobox", { name: "Select team" }));
    await user.click(screen.getByRole("option", { name: /Team B/ }));
    expect(onTeamsChange).toHaveBeenLastCalledWith(["team-1"], ["user-1"]);
  });

  it("offers only members of the selected teams", async () => {
    const { user, onUsersChange } = setup({ teamIds: ["team-1"] });
    await user.click(screen.getByRole("combobox", { name: "Select user" }));
    expect(screen.getByRole("option", { name: /User A/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /User B/ })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /User A/ }));
    expect(onUsersChange).toHaveBeenLastCalledWith(["user-1"]);
  });

  it("locks the team selection for restricted viewers", () => {
    setup({ teamIds: ["team-1"], teamLocked: true, includeAllOption: false });
    expect(
      screen.getByRole("combobox", { name: "Select team" })
    ).toBeDisabled();
  });
});
