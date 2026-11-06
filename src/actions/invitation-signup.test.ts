import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  invitation: { update: vi.fn() },
  user: { create: vi.fn(), update: vi.fn() },
};
vi.mock("@/lib/db", () => ({
  prisma: {
    invitation: { findFirst: vi.fn() },
    user: { findFirst: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  },
}));
vi.mock("@/lib/logging", () => ({
  withLogging: (_n: string, fn: unknown) => fn,
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/auth/auth-audit", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/auth-audit")>()),
  recordAuthEvent: vi.fn(),
}));
vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(async (p: string) => `hash:${p}`),
  verifyPassword: vi.fn(async () => false),
}));
vi.mock("@/lib/auth/password-policy", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/password-policy")>()),
  getPasswordPolicy: vi.fn().mockResolvedValue({
    minLength: 10,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSymbol: true,
    historyCount: 0,
  }),
}));

import { prisma } from "@/lib/db";
import {
  acceptInvitationWithPassword,
  getInvitationSignupInfo,
} from "./invitation-signup";

type Fn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  invitation: { findFirst: Fn };
  user: { findFirst: Fn; findUnique: Fn };
};

const invitation = {
  id: "inv-1",
  email: "new@acme.test",
  role: "MEMBER",
  teamId: null,
  organizationId: "org-1",
  organization: { name: "Acme" },
};

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.invitation.findFirst.mockResolvedValue(invitation);
  db.user.findFirst.mockResolvedValue(null);
  db.user.findUnique.mockResolvedValue(null);
  tx.user.create.mockResolvedValue({ id: "u-new", email: "new@acme.test" });
});

describe("invitation sign-up", () => {
  it("describes an open invitation", async () => {
    const info = await getInvitationSignupInfo("tok");
    expect(info).toMatchObject({
      email: "new@acme.test",
      organizationName: "Acme",
      hasPassword: false,
      minLength: 10,
    });
  });

  it("rejects an unknown or expired invitation", async () => {
    db.invitation.findFirst.mockResolvedValue(null);
    const result = await acceptInvitationWithPassword("tok", form({}));
    expect(result.success).toBe(false);
  });

  it("asks existing password users to sign in instead", async () => {
    db.user.findFirst.mockResolvedValue({
      id: "u",
      passwordHash: "h",
      passwordHistory: [],
    });
    const result = await acceptInvitationWithPassword(
      "tok",
      form({
        name: "N",
        password: "Strong-Pass1!",
        confirmPassword: "Strong-Pass1!",
      })
    );
    expect(result.error).toBe("SIGN_IN_REQUIRED");
  });

  it("creates the member with a password and accepts the invitation", async () => {
    const result = await acceptInvitationWithPassword(
      "tok",
      form({
        name: "New Person",
        username: "New.Person",
        password: "Strong-Pass1!",
        confirmPassword: "Strong-Pass1!",
      })
    );
    expect(result).toMatchObject({
      success: true,
      data: { email: "new@acme.test" },
    });
    expect(tx.invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv-1" },
        data: expect.objectContaining({ status: "ACCEPTED" }),
      })
    );
    expect(tx.user.create.mock.calls[0][0].data).toMatchObject({
      email: "new@acme.test",
      organizationId: "org-1",
      role: "MEMBER",
      username: "new.person",
      passwordHash: "hash:Strong-Pass1!",
    });
  });

  it("enforces the organisation password policy", async () => {
    const result = await acceptInvitationWithPassword(
      "tok",
      form({ name: "N", password: "weakpass", confirmPassword: "weakpass" })
    );
    expect(result.success).toBe(false);
    expect(tx.user.create).not.toHaveBeenCalled();
  });
});
