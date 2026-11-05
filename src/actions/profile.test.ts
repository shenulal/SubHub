// src/actions/profile.test.ts
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { updateProfile } from "./profile";

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockedRequireAuth = requireAuth as unknown as ReturnType<typeof vi.fn>;

describe("updateProfile", () => {
  it("redirects to /login when unauthenticated", async () => {
    mockedRequireAuth.mockRejectedValueOnce(new Error("NEXT_REDIRECT:/login"));

    const formData = new FormData();
    formData.set("name", "Test");

    await expect(updateProfile({ success: false }, formData)).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
  });

  it("returns an error for invalid values", async () => {
    mockedRequireAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
    });

    const formData = new FormData();
    formData.set("name", ""); // missing name

    const result = await updateProfile({ success: false }, formData);

    expect(result.success).toBe(false);
    expect(result.errors?.name).toBeDefined();
  });

  it("updates the profile and returns a success message", async () => {
    mockedRequireAuth.mockResolvedValueOnce({
      user: { id: "user-1" },
    });

    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: "user-1",
    } as never);

    const formData = new FormData();
    formData.set("name", "Ahmed Hassan");
    // title, department and avatarUrl are commented out and not sent

    const result = await updateProfile({ success: false }, formData);

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          name: "Ahmed Hassan",
          // jobTitle, department and avatarUrl are commented out
        }),
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/settings");
  });
});
