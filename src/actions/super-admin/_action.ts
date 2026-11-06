// src/actions/super-admin/_action.ts
/**
 * Wrapper for Control Panel server actions: logs, resolves the platform super
 * admin (`requirePlatformAdmin`) and maps refusals to an ActionState instead of
 * redirecting. Not a server action module (no "use server").
 */
import { withLogging } from "@/lib/logging";
import {
  isPlatformAccessError,
  requirePlatformAdmin,
  type PlatformAdminActor,
} from "@/lib/platform/guard";
import type { ActionState } from "@/types";

export function platformAction<A extends unknown[], T>(
  name: string,
  fn: (actor: PlatformAdminActor, ...args: A) => Promise<ActionState<T>>
): (...args: A) => Promise<ActionState<T>> {
  return withLogging(name, async (...args: A): Promise<ActionState<T>> => {
    let actor: PlatformAdminActor;
    try {
      actor = await requirePlatformAdmin();
    } catch (error) {
      if (isPlatformAccessError(error)) {
        return { success: false, error: error.message, message: error.message };
      }
      throw error;
    }
    return fn(actor, ...args);
  });
}
