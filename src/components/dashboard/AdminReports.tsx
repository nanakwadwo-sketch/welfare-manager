import { StatCard } from "@/components/dashboard/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { formatCedis, formatDateTime, monthLabel } from "@/lib/format";
import { useQuery } from "convex/react";
import {
  Activity,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  FileSpreadsheet,
  HandCoins,
  Hourglass,
  Loader2,
  Users,
  Wallet,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function AdminReports() {
  const reports = useQuery(api.welfare.adminReports);
  const members = useQuery(api.welfare.adminListMembers);

  if (reports === undefined) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  /** Exports the full member register as a dated .xlsx workbook. */
  const downloadMembersExcel = () => {
    if (!members || members.length === 0) return;
    const aoa: (string | number)[][] = [
      [
        "Member Code",
        "Full Name",
        "Email",
        "Staff ID",
        "Phone",
        "Department",
        "Join Date",
        "Status",
        "Maturity Date",
        "Matured",
        "Months Active",
        "Total Contributed (GH¢)",
        "Dues Payments",
      ],
      ...members.map((m) => [
        m.memberCode,
        m.fullName,
        m.email,
        m.staffId ?? "",
        m.phone ?? "",
        m.department ?? "",
        new Date(m.joinedAt).toISOString().slice(0, 10),
        m.status.charAt(0).toUpperCase() + m.status.slice(1),
        new Date(m.maturity.maturityDate).toISOString().slice(0, 10),
        m.maturity.matured ? "Yes" : "No",
        m.maturity.monthsActive,
        m.totalPaid,
        m.paymentCount,
      ]),
      [],
      [
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "TOTAL",
        "",
        members.reduce((sum, m) => sum + m.totalPaid, 0),
        members.reduce((sum, m) => sum + m.paymentCount, 0),
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 12 },
      { wch: 26 },
      { wch: 30 },
      { wch: 12 },
      { wch: 16 },
      { wch: 18 },
      { wch: 12 },
      { wch: 10 },
      { wch: 14 },
      { wch: 10 },
      { wch: 14 },
      { wch: 22 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Members");
    XLSX.writeFile(wb, `kgh-welfare-members-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const chartData = reports.duesByMonth.map((d) => ({
    month: monthLabel(d.month),
    total: d.total,
  }));

  const statusMeta = [
    { status: "pending", label: "Pending", icon: Hourglass },
    { status: "approved", label: "Approved", icon: ClipboardCheck },
    { status: "rejected", label: "Rejected", icon: Clock },
    { status: "paid", label: "Paid", icon: CheckCircle2 },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Members"
          value={reports.totalMembers}
          sub={`${reports.activeMembers} active · ${reports.maturedMembers} matured`}
          accent
        />
        <StatCard
          icon={Wallet}
          label="Total dues collected"
          value={formatCedis(reports.totalContributed)}
          sub="All recorded payments"
        />
        <StatCard
          icon={Hourglass}
          label="Pending claims"
          value={reports.pendingClaims}
          sub={`${reports.approvedUnpaid} approved awaiting payment`}
        />
        <StatCard
          icon={HandCoins}
          label="Total paid out"
          value={formatCedis(reports.totalPaidOut)}
          sub="Claims marked as paid"
        />
      </div>

      <Card className="card-layer">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <Download className="size-4 text-muted-foreground" />
            Downloads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="size-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Member register</p>
                <p className="text-xs text-muted-foreground">
                  All members with contributions and maturity status (.xlsx)
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              disabled={members === undefined || members.length === 0}
              onClick={downloadMembersExcel}
            >
              {members === undefined ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Download Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="card-layer lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-[15px]">Dues collected by month</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No dues recorded yet.
              </p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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
                      formatter={(value) => [formatCedis(Number(value)), "Collected"]}
                    />
                    <Bar dataKey="total" fill="#2f57d9" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-layer lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-[15px]">Claims pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusMeta.map(({ status, label, icon: Icon }) => {
              const entry = reports.claimsByStatus.find((c) => c.status === status);
              return (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-lg border border-border/70 px-4 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <Badge variant="secondary" className="font-semibold">
                    {entry?.count ?? 0}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="card-layer">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <Activity className="size-4 text-muted-foreground" />
            Recent activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports.recentActivity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Activity will appear here as members and admins use the system.
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {reports.recentActivity.map((a) => (
                <li key={a._id} className="flex items-start justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{a.detail ?? a.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.actorName ?? "System"} · {a.action}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
