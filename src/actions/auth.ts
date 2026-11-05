"use server";

import { signOut } from "@/lib/auth";

/**
 * Sign-out Server Action
 * Used as a form action from client components
 */
export async function logout() {
  await signOut({ redirectTo: "/login" });
}
