// src/components/common/quick-create/quick-create-provider.tsx
"use client";

/**
 * Hosts the quick-create dialogs for the app shell. `useQuickCreate().open(kind)`
 * opens a dialog in place (or navigates for kinds with a full page); after a
 * successful create the current route is refreshed so lists pick up the row.
 */
import { CostCenterDialog } from "@/components/platform/masters/cost-center-dialog";
import { PaymentMethodDialog } from "@/components/platform/masters/payment-method-dialog";
import { CategoryFormDialog } from "@/components/taxonomy/category-form-dialog";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { CreateAppDialog } from "./create-app-dialog";
import { CreateTagDialog } from "./create-tag-dialog";
import { InviteMemberDialog } from "./invite-member-dialog";
import { QuickCreateContext } from "./quick-create-context";
import {
  QUICK_CREATE_ENTRIES,
  type QuickCreateKind,
} from "./quick-create-registry";

export function QuickCreateProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [active, setActive] = useState<QuickCreateKind | null>(null);

  const open = useCallback(
    (kind: QuickCreateKind) => {
      const entry = QUICK_CREATE_ENTRIES.find((e) => e.kind === kind);
      if (entry?.href) {
        router.push(entry.href);
        return;
      }
      setActive(kind);
    },
    [router]
  );

  const value = useMemo(() => ({ open }), [open]);
  const close = (isOpen: boolean) => {
    if (!isOpen) setActive(null);
  };
  const done = () => router.refresh();

  return (
    <QuickCreateContext.Provider value={value}>
      {children}
      <CreateAppDialog
        open={active === "app"}
        onOpenChange={close}
        onCreated={done}
      />
      <CreateTeamDialog
        open={active === "team"}
        onOpenChange={close}
        onSuccess={done}
      />
      <CreateTagDialog
        open={active === "tag"}
        onOpenChange={close}
        onCreated={done}
      />
      <InviteMemberDialog
        open={active === "invite"}
        onOpenChange={close}
        onInvited={done}
      />
      {active === "category" && (
        <CategoryFormDialog open onOpenChange={close} onSaved={done} />
      )}
      {active === "costCenter" && (
        <CostCenterDialog open onOpenChange={close} onSaved={done} />
      )}
      {active === "paymentMethod" && (
        <PaymentMethodDialog open onOpenChange={close} onSaved={done} />
      )}
    </QuickCreateContext.Provider>
  );
}
