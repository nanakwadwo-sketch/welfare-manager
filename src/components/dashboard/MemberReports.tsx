import { StatCard } from "@/components/dashboard/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { formatCedis, monthLabel } from "@/lib/format";
import { useQuery } from "convex/react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartColumn, CheckCircle2, Clock, Wallet, XCircle } from "lucide-react";

export default function MemberReports() {
  const payments = useQuery(api.welfare.getMyPayments);
  const claims = useQuery(api.welfare.getMyClaims);

  if (payments === undefined || claims === undefined) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  const byMonth = new Map<string, number>();
  for (const p of payments) {
    byMonth.set(p.periodMonth, (byMonth.get(p.periodMonth) ?? 0) + p.amount);
  }
  const duesByMonth = Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, total]) => ({ month: monthLabel(month), total }));

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const avgPerMonth = payments.length > 0 ? totalPaid / payments.length : 0;
  const countBy = (status: string) => claims.filter((c) => c.status === status).length;
  const paidOut = claims
    .filter((c) => c.status === "paid")
    .reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Wallet}
          label="Total contributed"
          value={formatCedis(totalPaid)}
          sub={`${payments.length} dues payment${payments.length === 1 ? "" : "s"}`}
          accent
        />
        <StatCard
          icon={ChartColumn}
          label="Average per month"
          value={formatCedis(avgPerMonth)}
          sub="Based on your recorded dues"
        />
        <StatCard
          icon={CheckCircle2}
          label="Benefits received"
          value={formatCedis(paidOut)}
          sub={`${countBy("paid")} paid claim${countBy("paid") === 1 ? "" : "s"}`}
        />
      </div>

      <Card className="card-layer">
        <CardHeader>
          <CardTitle className="text-[15px]">Your dues by month</CardTitle>
        </CardHeader>
        <CardContent>
          {duesByMonth.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No dues recorded yet — your contribution chart will appear here.
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={duesByMonth} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,140,165,0.25)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    width={56}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(128,140,165,0.12)" }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      color: "var(--card-foreground)",
                      fontSize: 13,
                    }}
                    formatter={(value) => [formatCedis(Number(value)), "Dues paid"]}
                  />
                  <Bar dataKey="total" fill="#2f57d9" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="card-layer">
        <CardHeader>
          <CardTitle className="text-[15px]">Claims summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          {(
            [
              { label: "Pending", count: countBy("pending"), icon: Clock },
              { label: "Approved", count: countBy("approved"), icon: CheckCircle2 },
              { label: "Rejected", count: countBy("rejected"), icon: XCircle },
              { label: "Paid", count: countBy("paid"), icon: Wallet },
            ] as const
          ).map(({ label, count, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-lg border border-border/70 px-4 py-3"
            >
              <Icon className="size-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-semibold leading-none">{count}</p>
                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
