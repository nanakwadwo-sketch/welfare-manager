import { EmptyState, MemberStatusBadge, MaturityProgress, StatCard } from "@/components/dashboard/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { formatCedis, formatDate, monthLabel } from "@/lib/format";
import { useQuery } from "convex/react";
import { CalendarDays, HandCoins, IdCard, Mail, Phone, Receipt, UserRound, Wallet } from "lucide-react";

export default function MemberOverview() {
  const profile = useQuery(api.welfare.getMyMemberProfile);
  const payments = useQuery(api.welfare.getMyPayments);
  const claims = useQuery(api.welfare.getMyClaims);

  if (profile === undefined || payments === undefined || claims === undefined) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  // Signed in but not registered as a member yet
  if (profile === null) {
    return (
      <EmptyState
        icon={UserRound}
        title="You are not registered as a member yet"
        description="Ask the fund admin to add your email so your membership, dues, and benefits appear here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Wallet}
          label="Total contributed"
          value={formatCedis(profile.totalPaid)}
          sub={`${profile.paymentCount} month${profile.paymentCount === 1 ? "" : "s"} of dues`}
          accent
        />
        <StatCard
          icon={HandCoins}
          label="Claims filed"
          value={claims.length}
          sub={
            claims.filter((c) => c.status === "pending").length > 0
              ? `${claims.filter((c) => c.status === "pending").length} awaiting review`
              : "None awaiting review"
          }
        />
        <StatCard
          icon={Receipt}
          label="Benefits paid to you"
          value={formatCedis(
            claims.filter((c) => c.status === "paid").reduce((s, c) => s + c.amount, 0),
          )}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="card-layer">
          <CardHeader>
            <CardTitle className="text-[15px]">Your profile</CardTitle>
            <CardDescription>Registered membership details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold tracking-tight">
                  {profile.fullName}
                </p>
                <p className="text-sm text-muted-foreground">{profile.memberCode}</p>
              </div>
              <MemberStatusBadge status={profile.status} />
            </div>
            <dl className="space-y-2.5 border-t border-border/70 pt-3 text-sm">
              <div className="flex items-center gap-2.5">
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-muted-foreground">{profile.email}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <IdCard className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{profile.staffId ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{profile.phone ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Joined {formatDate(profile.joinedAt)}
                </span>
              </div>
            </dl>
            {profile.department && (
              <p className="rounded-lg bg-secondary/60 px-3 py-2 text-sm text-secondary-foreground">
                {profile.department}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="card-layer">
          <CardHeader>
            <CardTitle className="text-[15px]">Maturity</CardTitle>
            <CardDescription>
              Claims unlock once you are matured
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MaturityProgress {...profile.maturity} />
          </CardContent>
        </Card>
      </div>

      <Card className="card-layer">
        <CardHeader>
          <CardTitle className="text-[15px]">Dues history</CardTitle>
          <CardDescription>Monthly dues recorded by the admin</CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No dues recorded yet"
              description="Once the admin records your monthly dues, they will show up here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="hidden sm:table-cell">Recorded</TableHead>
                  <TableHead className="hidden md:table-cell">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.slice(0, 8).map((p) => (
                  <TableRow key={p._id}>
                    <TableCell className="font-medium">
                      {monthLabel(p.periodMonth)}
                    </TableCell>
                    <TableCell>{formatCedis(p.amount)}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatDate(p.recordedAt)}
                    </TableCell>
                    <TableCell className="hidden max-w-[200px] truncate text-muted-foreground md:table-cell">
                      {p.note ?? "—"}
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
