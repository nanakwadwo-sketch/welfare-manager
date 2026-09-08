import { ClaimDocumentsDialog, ClaimStatusBadge, ClaimStatusIcon, EmptyState } from "@/components/dashboard/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { formatCedis, formatDate } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import { FileText, Gavel, Inbox, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ClaimRow = Doc<"claims"> & {
  memberName: string;
  memberCode: string;
};

export default function AdminClaims() {
  const claims = useQuery(api.welfare.adminListClaims);
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviewing, setReviewing] = useState<ClaimRow | null>(null);

  if (claims === undefined) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  const filtered =
    statusFilter === "all"
      ? claims
      : claims.filter((c) => c.status === statusFilter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Claims</h2>
          <p className="text-sm text-muted-foreground">
            Review documents and decide payouts.
          </p>
        </div>
        <div className="w-44">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All claims</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {claims.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No claims filed yet"
          description="When members file benefit claims, they appear here for review."
        />
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No claims with this status.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <Card key={c._id} className="card-layer">
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ClaimStatusIcon status={c.status} />
                    </div>
                    <p className="font-semibold tracking-tight">
                      {c.memberName}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {c.memberCode}
                      </span>
                    </p>
                    <ClaimStatusBadge status={c.status} />
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {formatCedis(c.amount)} · filed {formatDate(c.filedAt)}
                  </p>
                  {c.details && (
                    <p className="mt-1 max-w-xl truncate text-xs text-muted-foreground">
                      “{c.details}”
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <ClaimDocumentsDialog
                    claimId={c._id}
                    canUpload
                    title={`Documents — ${c.memberName}`}
                    trigger={
                      <Button variant="outline" size="sm" className="gap-2">
                        <FileText className="size-4" />
                        Documents
                      </Button>
                    }
                  />
                  {c.status !== "paid" && c.status !== "rejected" && (
                    <Button size="sm" className="gap-2" onClick={() => setReviewing(c as ClaimRow)}>
                      <Gavel className="size-4" />
                      Review
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ReviewDialog claim={reviewing} onOpenChange={(o) => !o && setReviewing(null)} />
    </div>
  );
}

function ReviewDialog({
  claim,
  onOpenChange,
}: {
  claim: ClaimRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const reviewClaim = useMutation(api.welfare.adminReviewClaim);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const decide = async (decision: "approved" | "rejected" | "paid") => {
    if (!claim) return;
    setBusy(decision);
    try {
      await reviewClaim({
        claimId: claim._id,
        decision,
        reviewNote: note || undefined,
      });
      toast.success(`Claim ${decision}`);
      setNote("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update claim");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={!!claim} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review claim</DialogTitle>
          <DialogDescription>
            {claim
              ? `${claim.memberName} · ${formatCedis(claim.amount)} · filed ${formatDate(claim.filedAt)}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {claim && (
          <>
            <div className="space-y-2">
              <Label htmlFor="review-note">Review note (optional)</Label>
              <Textarea
                id="review-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Visible to the member, e.g. reason for rejection or payment date"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Current status: {claim.status}. Only approved claims can be marked
              as paid.
            </p>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                variant="destructive"
                className="flex-1"
                disabled={busy !== null}
                onClick={() => void decide("rejected")}
              >
                {busy === "rejected" ? <Loader2 className="size-4 animate-spin" /> : "Reject"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy !== null}
                onClick={() => void decide("approved")}
              >
                {busy === "approved" ? <Loader2 className="size-4 animate-spin" /> : "Approve"}
              </Button>
              <Button
                className="flex-1"
                disabled={busy !== null || claim.status !== "approved"}
                title={claim.status !== "approved" ? "Approve first" : undefined}
                onClick={() => void decide("paid")}
              >
                {busy === "paid" ? <Loader2 className="size-4 animate-spin" /> : "Mark as paid"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
