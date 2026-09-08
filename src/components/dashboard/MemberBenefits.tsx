import { readFileAsDataUrl } from "@/components/dashboard/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatCedis, formatCedisShort } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import { FilePlus2, HandCoins, Loader2, Lock, Percent, Tag, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const PACKAGE_ORDER = [
  "death_parent",
  "death_spouse",
  "death_child",
  "retirement",
  "transfer",
  "resignation",
];

export default function MemberBenefits() {
  const packages = useQuery(api.welfare.listPackages);
  const profile = useQuery(api.welfare.getMyMemberProfile);

  if (packages === undefined || profile === undefined) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  const sorted = [...packages].sort(
    (a, b) => PACKAGE_ORDER.indexOf(a.key) - PACKAGE_ORDER.indexOf(b.key),
  );
  const matured = profile?.maturity.matured ?? false;
  const totalPaid = profile?.totalPaid ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Benefit package
          </h2>
          <p className="text-sm text-muted-foreground">
            {matured
              ? "You are matured — file a claim when life happens."
              : "Claims unlock once you mature after 6 months."}
          </p>
        </div>
        <FileClaimDialog matured={matured} totalPaid={totalPaid} packages={sorted} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((pkg) => (
          <Card key={pkg.key} className="card-layer">
            <CardHeader>
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {pkg.kind === "fixed" ? (
                  <HandCoins className="size-5" />
                ) : (
                  <Percent className="size-5" />
                )}
              </div>
              <CardTitle className="text-[15px]">{pkg.label}</CardTitle>
              <CardDescription>
                {pkg.kind === "fixed"
                  ? "Fixed payout"
                  : "Share of total contribution"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tracking-tight text-primary">
                {pkg.kind === "fixed"
                  ? formatCedisShort(pkg.amount)
                  : `${pkg.percentOfContribution ?? pkg.amount}%`}
              </p>
              {pkg.kind === "percent" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  ≈ {formatCedisShort(
                    ((pkg.percentOfContribution ?? pkg.amount) / 100) * totalPaid,
                  )}{" "}
                  based on your GH¢{totalPaid.toLocaleString()} contribution
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function FileClaimDialog({
  matured,
  totalPaid,
  packages,
}: {
  matured: boolean;
  totalPaid: number;
  packages: Array<{
    key: string;
    label: string;
    kind: "fixed" | "percent";
    amount: number;
    percentOfContribution?: number;
  }>;
}) {
  const [open, setOpen] = useState(false);
  const [benefitKey, setBenefitKey] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fileClaim = useMutation(api.welfare.fileClaim);
  const addDoc = useMutation(api.welfare.addClaimDocument);

  const selected = packages.find((p) => p.key === benefitKey);
  const previewAmount = selected
    ? selected.kind === "fixed"
      ? selected.amount
      : Math.round(
          ((selected.percentOfContribution ?? selected.amount) / 100) *
            totalPaid *
            100,
        ) / 100
    : 0;

  const reset = () => {
    setBenefitKey("");
    setDetails("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!benefitKey) {
      toast.error("Choose the benefit you are claiming");
      return;
    }
    setSubmitting(true);
    try {
      const files = fileRef.current?.files;
      const claimId: Id<"claims"> = await fileClaim({
        benefitKey,
        details: details || undefined,
      });
      if (files) {
        for (const file of Array.from(files)) {
          if (file.size > 3_000_000) {
            toast.error(`${file.name} is larger than 3MB`);
            continue;
          }
          const dataUrl = await readFileAsDataUrl(file);
          await addDoc({
            claimId,
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            dataUrl,
          });
        }
      }
      toast.success("Claim filed — the admin will review it shortly");
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not file claim");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" disabled={!matured}>
          {matured ? (
            <>
              <FilePlus2 className="size-4" />
              File a claim
            </>
          ) : (
            <>
              <Lock className="size-4" />
              File a claim
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>File a benefit claim</DialogTitle>
          <DialogDescription>
            Attach supporting documents — a current payslip, invitation,
            transfer or retirement letter as applicable.
          </DialogDescription>
        </DialogHeader>

        {!matured && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            You are not yet matured. Claims unlock after 6 months of membership.
          </p>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="benefit">Benefit</Label>
            <Select value={benefitKey} onValueChange={setBenefitKey}>
              <SelectTrigger id="benefit" className="w-full">
                <SelectValue placeholder="Select benefit type" />
              </SelectTrigger>
              <SelectContent>
                {packages.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected && (
            <div className="rounded-lg bg-secondary/60 px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">Estimated payout: </span>
              <span className="font-semibold">
                {formatCedis(previewAmount)}
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="details">Details (optional)</Label>
            <Textarea
              id="details"
              placeholder="e.g. My mother passed away on… / Retirement effective…"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Supporting documents</Label>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" />
              Attach payslip, letter, or photos
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            className="w-full gap-2"
            disabled={submitting || !benefitKey || !matured}
            onClick={() => void handleSubmit()}
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {submitting ? "Filing claim…" : "Submit claim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
