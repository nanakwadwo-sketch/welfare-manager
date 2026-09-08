import { ClaimDocumentsDialog, ClaimStatusBadge, ClaimStatusIcon, EmptyState } from "@/components/dashboard/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { formatCedis, formatDate } from "@/lib/format";
import { useQuery } from "convex/react";
import { FileText, Inbox } from "lucide-react";

export default function MemberClaims() {
  const claims = useQuery(api.welfare.getMyClaims);
  const packages = useQuery(api.welfare.listPackages);

  if (claims === undefined || packages === undefined) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  const labelFor = (key: string) =>
    packages.find((p) => p.key === key)?.label ?? key;

  if (claims.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No claims filed yet"
        description="When you need support, file a claim from the Benefits tab — it will appear here with its review status."
      />
    );
  }

  return (
    <div className="space-y-4">
      {claims.map((claim) => (
        <Card key={claim._id} className="card-layer">
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ClaimStatusIcon status={claim.status} />
                </div>
                <p className="font-semibold tracking-tight">
                  {labelFor(claim.benefitKey)}
                </p>
                <ClaimStatusBadge status={claim.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                Filed {formatDate(claim.filedAt)} ·{" "}
                <span className="font-medium text-foreground">
                  {formatCedis(claim.amount)}
                </span>
              </p>
              {claim.details && (
                <p className="max-w-xl rounded-lg bg-secondary/60 px-3 py-2 text-sm text-secondary-foreground">
                  {claim.details}
                </p>
              )}
              {claim.reviewNote && (
                <p className="max-w-xl text-sm">
                  <span className="font-medium">Admin note: </span>
                  <span className="text-muted-foreground">{claim.reviewNote}</span>
                </p>
              )}
            </div>
            <ClaimDocumentsDialog
              claimId={claim._id}
              canUpload={claim.status !== "paid" && claim.status !== "rejected"}
              trigger={
                <Button variant="outline" size="sm" className="gap-2 self-start">
                  <FileText className="size-4" />
                  Documents
                </Button>
              }
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
