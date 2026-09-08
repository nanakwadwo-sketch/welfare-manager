import { EmptyState, MemberStatusBadge, MaturityProgress } from "@/components/dashboard/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { currentPeriod, formatCedis, formatDate, monthLabel } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarPlus,
  Download,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

type MemberRow = {
  _id: Id<"members">;
  memberCode: string;
  fullName: string;
  email: string;
  phone?: string;
  department?: string;
  joinedAt: number;
  status: "active" | "inactive" | "terminated";
  totalPaid: number;
  paymentCount: number;
  maturity: {
    monthsActive: number;
    monthsRemaining: number;
    matured: boolean;
    maturityDate: number;
  };
};

type ParsedRow = {
  fullName: string;
  email: string;
  phone: string;
  department: string;
};

export default function AdminMembers() {
  const members = useQuery(api.welfare.adminListMembers);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [duesFor, setDuesFor] = useState<MemberRow | null>(null);

  const filtered = useMemo(() => {
    if (!members) return [];
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.memberCode.toLowerCase().includes(q) ||
        (m.department ?? "").toLowerCase().includes(q),
    );
  }, [members, search]);

  if (members === undefined) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, code…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setBulkOpen(true)}>
            <FileSpreadsheet className="size-4" />
            Bulk upload (Excel)
          </Button>
          <Button className="gap-2" onClick={() => setAdding(true)}>
            <UserPlus className="size-4" />
            Add member
          </Button>
        </div>
      </div>

      <Card className="card-layer">
        <CardContent>
          {members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No members yet"
              description="Add members one by one, or import your whole list from an Excel file."
              action={
                <Button className="gap-2" onClick={() => setBulkOpen(true)}>
                  <FileSpreadsheet className="size-4" />
                  Bulk upload (Excel)
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="hidden lg:table-cell">Department</TableHead>
                  <TableHead className="hidden sm:table-cell">Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Contributed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m._id}>
                    <TableCell>
                      <div className="font-medium">{m.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.memberCode} · {m.email}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {m.department ?? "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatDate(m.joinedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <MemberStatusBadge status={m.status} />
                        {m.maturity.matured ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                            Matured
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {m.maturity.monthsRemaining}mo to maturity
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCedis(m.totalPaid)}
                      <div className="text-xs font-normal text-muted-foreground">
                        {m.paymentCount} dues
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Record dues"
                          onClick={() => setDuesFor(m as MemberRow)}
                        >
                          <CalendarPlus className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit member"
                          onClick={() => setEditing(m as MemberRow)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {filtered.length === 0 && members.length > 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No members match “{search}”.
            </p>
          )}
        </CardContent>
      </Card>

      <AddMemberDialog open={adding} onOpenChange={setAdding} />
      <BulkUploadDialog open={bulkOpen} onOpenChange={setBulkOpen} />
      <EditMemberDialog member={editing} onOpenChange={(o) => !o && setEditing(null)} />
      <RecordDuesDialog member={duesFor} onOpenChange={(o) => !o && setDuesFor(null)} />
    </div>
  );
}

// ---------- Add member ----------

function AddMemberDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addMember = useMutation(api.welfare.adminAddMember);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [joinedAt, setJoinedAt] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setDepartment("");
    setJoinedAt("");
  };

  const handleSave = async () => {
    if (!fullName.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSaving(true);
    try {
      await addMember({
        fullName,
        email,
        phone: phone || undefined,
        department: department || undefined,
        joinedAt: joinedAt ? new Date(joinedAt).getTime() : undefined,
      });
      toast.success(`${fullName.trim()} added`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add member");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a member</DialogTitle>
          <DialogDescription>
            The member signs in with this email — use the address they will
            register with. A member code is generated automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="add-name">Full name</Label>
            <Input id="add-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Kwame Mensah" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-email">Email</Label>
            <Input id="add-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kwame@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="add-phone">Phone</Label>
              <Input id="add-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0244 000 111" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-dept">Department</Label>
              <Input id="add-dept" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Finance" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-joined">Join date</Label>
            <Input id="add-joined" type="date" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Defaults to today. Maturity counts 6 months from this date.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void handleSave()} disabled={saving} className="w-full gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Adding…" : "Add member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Bulk upload ----------

function parseWorkbook(file: File): Promise<ParsedRow[]> {
  return file.arrayBuffer().then((buf) => {
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return [];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    const pick = (row: Record<string, unknown>, ...keys: string[]) => {
      for (const key of keys) {
        const found = Object.keys(row).find(
          (k) => k.toLowerCase().trim() === key,
        );
        if (found && String(row[found]).trim()) {
          return String(row[found]).trim();
        }
      }
      return "";
    };
    return rows
      .map((row) => ({
        fullName: pick(row, "full name", "fullname", "name"),
        email: pick(row, "email", "email address", "e-mail"),
        phone: pick(row, "phone", "phone number", "telephone"),
        department: pick(row, "department", "dept"),
      }))
      .filter((r) => r.fullName || r.email);
  });
}

function downloadTemplate() {
  const aoa = [
    ["Full Name", "Email", "Phone", "Department"],
    ["Kwame Mensah", "kwame.mensah@example.com", "0244 000 111", "Finance"],
    ["Akosua Boateng", "akosua.boateng@example.com", "0209 111 222", "Operations"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Members");
  XLSX.writeFile(wb, "welfare-members-template.xlsx");
}

function BulkUploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const bulkAdd = useMutation(api.welfare.adminBulkAddMembers);
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setParsed(null);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    setFileName(file.name);
    try {
      const rows = await parseWorkbook(file);
      if (rows.length === 0) {
        toast.error("No usable rows found — check the template columns");
        setParsed(null);
        return;
      }
      setParsed(rows);
    } catch {
      toast.error("Could not read that file. Try an .xlsx or .csv file.");
    }
  };

  const handleImport = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      const res = await bulkAdd({ rows: parsed });
      if (res.added > 0) {
        toast.success(`${res.added} member${res.added === 1 ? "" : "s"} added`);
      }
      if (res.skipped > 0) {
        toast.warning(
          `${res.skipped} row${res.skipped === 1 ? "" : "s"} skipped (invalid or duplicate email)`,
        );
      }
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk add members from Excel</DialogTitle>
          <DialogDescription>
            Upload a .xlsx or .csv file with columns: Full Name, Email, Phone,
            Department. Members with duplicate emails are skipped.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />

        {!parsed ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border/80 bg-card/50 px-4 py-10 transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <FileSpreadsheet className="size-8 text-muted-foreground" />
              <span className="text-sm font-medium">
                {fileName || "Choose an Excel or CSV file"}
              </span>
              <span className="text-xs text-muted-foreground">
                Click to browse your files
              </span>
            </button>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={downloadTemplate}
            >
              <Download className="size-4" />
              Download template
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-border/70">
              <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
                <span className="font-medium">
                  {parsed.length} row{parsed.length === 1 ? "" : "s"} found
                </span>
                <span className="text-xs text-muted-foreground">{fileName}</span>
              </div>
              <ul className="max-h-40 space-y-1 overflow-y-auto px-3 py-2 text-sm">
                {parsed.slice(0, 6).map((r, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="truncate font-medium">{r.fullName || "(no name)"}</span>
                    <span className="truncate text-muted-foreground">{r.email || "(no email)"}</span>
                  </li>
                ))}
                {parsed.length > 6 && (
                  <li className="text-xs text-muted-foreground">
                    …and {parsed.length - 6} more
                  </li>
                )}
              </ul>
            </div>
            <Button type="button" className="w-full gap-2" disabled={busy} onClick={() => void handleImport()}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <UserPlus className="size-4" />
                  Import {parsed.length} member{parsed.length === 1 ? "" : "s"}
                </>
              )}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={reset}>
              Choose a different file
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Edit member ----------

function EditMemberDialog({
  member,
  onOpenChange,
}: {
  member: MemberRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const updateMember = useMutation(api.welfare.adminUpdateMember);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState<string>("active");
  const [saving, setSaving] = useState(false);
  const [initializedFor, setInitializedFor] = useState<Id<"members"> | null>(null);

  if (member && initializedFor !== member._id) {
    setFullName(member.fullName);
    setPhone(member.phone ?? "");
    setDepartment(member.department ?? "");
    setStatus(member.status);
    setInitializedFor(member._id);
  }

  const handleSave = async () => {
    if (!member) return;
    setSaving(true);
    try {
      await updateMember({
        memberId: member._id,
        fullName,
        phone: phone || undefined,
        department: department || undefined,
        status: status as MemberRow["status"],
      });
      toast.success("Member updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit member</DialogTitle>
          <DialogDescription>
            {member ? `${member.fullName} · ${member.memberCode}` : ""}
          </DialogDescription>
        </DialogHeader>
        {member && (
          <>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Full name</Label>
                <Input id="edit-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input id="edit-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-dept">Department</Label>
                  <Input id="edit-dept" value={department} onChange={(e) => setDepartment(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="edit-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border border-border/70 p-3">
              <MaturityProgress {...member.maturity} />
            </div>
            <DialogFooter>
              <Button onClick={() => void handleSave()} disabled={saving} className="w-full gap-2">
                {saving && <Loader2 className="size-4 animate-spin" />}
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Record dues ----------

function RecordDuesDialog({
  member,
  onOpenChange,
}: {
  member: MemberRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const recordDues = useMutation(api.welfare.adminRecordDues);
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!member) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    setSaving(true);
    try {
      await recordDues({
        memberId: member._id,
        amount: value,
        periodMonth: period,
        note: note || undefined,
      });
      toast.success(`Dues recorded for ${member.fullName} — ${monthLabel(period)}`);
      setAmount("");
      setNote("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record dues");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record monthly dues</DialogTitle>
          <DialogDescription>
            {member
              ? `${member.fullName} · ${member.memberCode} · contributed so far ${formatCedis(member.totalPaid)}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="dues-amount">Amount (GH¢)</Label>
              <Input
                id="dues-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dues-period">Period</Label>
              <Input
                id="dues-period"
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dues-note">Note (optional)</Label>
            <Input
              id="dues-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Cash, receipt #0142"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Dues amounts can change at any time — each payment stores its own amount.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => void handleSave()} disabled={saving} className="w-full gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Recording…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
