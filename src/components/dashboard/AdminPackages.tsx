import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { formatCedisShort } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import { HandCoins, Loader2, Percent, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const PACKAGE_ORDER = [
  "death_parent",
  "death_spouse",
  "death_child",
  "retirement",
  "transfer",
  "resignation",
];

type Pkg = {
  key: string;
  label: string;
  kind: "fixed" | "percent";
  amount: number;
  percentOfContribution?: number;
  updatedAt: number;
};

type PkgDraft = {
  label: string;
  kind: "fixed" | "percent";
  amount: string; // kept as string while being edited
};

export default function AdminPackages() {
  const packages = useQuery(api.welfare.adminListPackages);
  const updatePackage = useMutation(api.welfare.adminUpdatePackage);
  const [drafts, setDrafts] = useState<Record<string, PkgDraft>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const sorted = [...(packages ?? [])].sort(
    (a, b) => PACKAGE_ORDER.indexOf(a.key) - PACKAGE_ORDER.indexOf(b.key),
  );

  // Keep drafts in sync when server data loads or changes
  useEffect(() => {
    if (!packages) return;
    setDrafts((prev) => {
      const next: Record<string, PkgDraft> = {};
      for (const pkg of packages) {
        next[pkg.key] = prev[pkg.key] ?? {
          label: pkg.label,
          kind: pkg.kind,
          amount: String(pkg.amount),
        };
      }
      return next;
    });
  }, [packages]);

  const draftOf = (pkg: Pkg): PkgDraft => ({
    label: drafts[pkg.key]?.label ?? pkg.label,
    kind: drafts[pkg.key]?.kind ?? pkg.kind,
    amount: drafts[pkg.key]?.amount ?? String(pkg.amount),
  });

  const isDirty = (pkg: Pkg) => {
    const d = draftOf(pkg);
    return (
      d.label !== pkg.label ||
      d.kind !== pkg.kind ||
      Number(d.amount) !== pkg.amount
    );
  };

  const handleSave = async (pkg: Pkg) => {
    const d = draftOf(pkg);
    const amount = Number(d.amount);
    if (!Number.isFinite(amount)) {
      toast.error("Enter a valid number");
      return;
    }
    if (d.kind === "fixed" && amount <= 0) {
      toast.error("Fixed amounts must be greater than 0");
      return;
    }
    if (d.kind === "percent" && (amount < 0 || amount > 100)) {
      toast.error("Percent must be between 0 and 100");
      return;
    }
    setSavingKey(pkg.key);
    try {
      await updatePackage({
        key: pkg.key,
        label: d.label.trim() || pkg.label,
        kind: d.kind,
        amount,
        percentOfContribution: d.kind === "percent" ? amount : undefined,
      });
      toast.success(`${d.label.trim() || pkg.label} updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingKey(null);
    }
  };

  if (packages === undefined) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Benefit packages</h2>
        <p className="text-sm text-muted-foreground">
          Amounts can change at any time — new claims use the updated values
          immediately.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {sorted.map((pkg) => {
          const d = draftOf(pkg);
          const dirty = isDirty(pkg);
          return (
            <Card key={pkg.key} className="card-layer">
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {pkg.kind === "fixed" ? (
                      <HandCoins className="size-5" />
                    ) : (
                      <Percent className="size-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Input
                      value={d.label}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [pkg.key]: { ...d, label: e.target.value },
                        }))
                      }
                      className="font-semibold"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      key: {pkg.key} · updated{" "}
                      {new Date(pkg.updatedAt).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-[130px_1fr_auto] items-end gap-3">
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select
                      value={d.kind}
                      onValueChange={(v) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [pkg.key]: { ...d, kind: v as "fixed" | "percent" },
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed GH¢</SelectItem>
                        <SelectItem value="percent">% of contribution</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>
                      {d.kind === "fixed" ? "Amount (GH¢)" : "Percent (%)"}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step={d.kind === "fixed" ? "0.01" : "1"}
                      value={d.amount}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [pkg.key]: { ...d, amount: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <Button
                    size="icon"
                    variant={dirty ? "default" : "outline"}
                    disabled={!dirty || savingKey === pkg.key}
                    title={dirty ? "Save changes" : "No changes"}
                    onClick={() => void handleSave(pkg)}
                  >
                    {savingKey === pkg.key ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                  </Button>
                </div>

                <p className="rounded-lg bg-secondary/60 px-3 py-2 text-sm text-secondary-foreground">
                  {d.kind === "fixed"
                    ? `Pays ${formatCedisShort(Number(d.amount) || 0)} per claim`
                    : `Pays ${Number(d.amount) || 0}% of the member's total contribution at filing time`}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
