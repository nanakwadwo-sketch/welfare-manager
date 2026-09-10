import { MemberAvatar } from "@/components/dashboard/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Loader2, ShieldCheck, UserRound, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type UserRow = {
  _id: Id<"users">;
  name?: string;
  email?: string;
  role?: "admin" | "user" | "member";
  isAnonymous?: boolean;
  memberCode?: string;
  memberStatus?: "active" | "inactive" | "terminated";
  memberProfilePic?: Id<"_storage">;
};

const ROLE_STYLES: Record<string, string> = {
  admin: "bg-primary/10 text-primary border-primary/20",
  member: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  user: "bg-secondary text-secondary-foreground border-border",
};

export default function AdminUsers() {
  const users = useQuery(api.welfare.adminListUsers);
  const setRole = useMutation(api.welfare.adminSetUserRole);
  const [savingId, setSavingId] = useState<Id<"users"> | null>(null);

  const handleRole = async (u: UserRow, role: string) => {
    setSavingId(u._id);
    try {
      await setRole({
        userId: u._id,
        role: role as "admin" | "member" | "user",
      });
      toast.success(
        `${u.name ?? u.email ?? "User"} is now ${role}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change role");
    } finally {
      setSavingId(null);
    }
  };

  if (users === undefined) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">User accounts</h2>
        <p className="text-sm text-muted-foreground">
          Everyone who has signed in. Admins manage the fund; members see their
          own workspace. Link accounts to members by using the member's email.
        </p>
      </div>

      <Card className="card-layer">
        <CardContent>
          {users.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Users className="size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">No users yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="hidden sm:table-cell">Linked member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Change role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u._id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {u.memberProfilePic ? (
                          <MemberAvatar
                            fullName={u.name ?? u.email ?? "Member"}
                            storageId={u.memberProfilePic}
                            size={32}
                          />
                        ) : (
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                            {u.role === "admin" ? (
                              <ShieldCheck className="size-4" />
                            ) : (
                              <UserRound className="size-4" />
                            )}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {u.name ?? u.email ?? "Anonymous user"}
                          </div>
                          {u.email && u.name && (
                            <div className="truncate text-xs text-muted-foreground">
                              {u.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {u.memberCode ? (
                        <Badge variant="outline" className="gap-1">
                          {u.memberCode}
                          {u.memberStatus && (
                            <span className="text-muted-foreground">· {u.memberStatus}</span>
                          )}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`capitalize ${ROLE_STYLES[u.role ?? "user"]}`}
                      >
                        {u.role ?? "user"}
                      </Badge>
                      {u.isAnonymous && (
                        <span className="ml-2 text-xs text-muted-foreground">guest</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {savingId === u._id && (
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        )}
                        <Select
                          value={u.role ?? "user"}
                          onValueChange={(v) => void handleRole(u, v)}
                        >
                          <SelectTrigger className="h-8 w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="user">User</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
