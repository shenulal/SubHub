"use client";

import { assignMemberRole } from "@/actions/platform/roles";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MemberRoleRow, RoleRow } from "@/types/platform";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

interface MemberRoleTableProps {
  members: MemberRoleRow[];
  roles: RoleRow[];
}

/** Role row id currently in effect for a member (custom wins over system). */
function effectiveRoleId(member: MemberRoleRow, roles: RoleRow[]): string {
  if (member.customRoleId) return member.customRoleId;
  return (
    roles.find((r) => r.isSystem && r.legacyRole === member.systemRole)?.id ??
    ""
  );
}

export function MemberRoleTable({ members, roles }: MemberRoleTableProps) {
  const t = useTranslations("platform.roles");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? members.filter(
          (m) =>
            (m.name ?? "").toLowerCase().includes(q) ||
            m.email.toLowerCase().includes(q)
        )
      : members;
  }, [members, query]);

  const assign = (member: MemberRoleRow, roleId: string) => {
    setBusyId(member.id);
    startTransition(async () => {
      const result = await assignMemberRole({
        userId: member.id,
        roleId: roleId || null,
      });
      setBusyId(null);
      if (result.success) {
        toast.success(t("assigned"));
        router.refresh();
      } else {
        toast.error(result.error ?? t("saveFailed"));
      }
    });
  };

  return (
    <div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("searchMembers")}
        className="mb-3 max-w-xs"
      />
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>{t("member")}</TableHead>
              <TableHead className="w-64">{t("role")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="font-medium">
                    {member.name ?? member.email}
                  </div>
                  {member.name && (
                    <div className="text-muted-foreground text-xs">
                      {member.email}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Select
                    value={effectiveRoleId(member, roles)}
                    onValueChange={(v) => assign(member, v)}
                    disabled={busyId === member.id}
                  >
                    <SelectTrigger aria-label={`${member.email} ${t("role")}`}>
                      <SelectValue placeholder={t("noRole")} />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                          {!r.isSystem && (
                            <span className="text-muted-foreground ml-1 text-xs">
                              · {t("custom")}
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
