import { DuesReceiptDialog, EmptyState, MemberAvatar, MemberStatusBadge, MaturityProgress, StatCard } from "@/components/dashboard/shared";
import { Button } from "@/components/ui/button";
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
import { useMutation, useQuery } from "convex/react";
import { CalendarDays, HandCoins, IdCard, ImagePlus, Mail, Phone, Printer, Receipt, Trash2, UserRound, Wallet } from "lucide-react";
import { BadgeCheck } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

export default function MemberOverview() {
  const profile = useQuery(api.welfare.getMyMemberProfile);
  const payments = useQuery(api.welfare.getMyPayments);
  const claims = useQuery(api.welfare.getMyClaims);
  const generateUploadUrl = useMutation(api.welfare.generateUploadUrl);
  const setPic = useMutation(api.welfare.setMyProfilePicture);
  const removePic = useMutation(api.welfare.removeMyProfilePicture);
  const picInputRef = useRef<HTMLInputElement>(null);
  const [picBusy, setPicBusy] = useState<"uploading" | "removing" | null>(null);

  const handlePickPicture = () => picInputRef.current?.click();

  const handlePictureFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Profile picture must be an image (JPG or PNG)");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(
        `That image is ${(file.size / 1024 / 1024).toFixed(1)}MB — the maximum is 2MB`,
      );
      return;
    }
    setPicBusy("uploading");
    try {
      const url = await generateUploadUrl();
      const result = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!result.ok) throw new Error(`Upload failed (HTTP ${result.status})`);
      const { storageId } = (await result.json()) as { storageId: string };
      await setPic({ storageId } as never);
      toast.success("Profile picture updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload picture");
    } finally {
      setPicBusy(null);
      if (picInputRef.current) picInputRef.current.value = "";
    }
  };

  const handleRemovePicture = async () => {
    setPicBusy("removing");
    try {
      await removePic({});
      toast.success("Profile picture removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove picture");
    } finally {
      setPicBusy(null);
    }
  };

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
              <div className="flex min-w-0 items-center gap-3">
                <MemberAvatar
                  fullName={profile.fullName}
                  storageId={profile.profilePicStorageId}
                  size={64}
                  editable={picBusy === null}
                  uploading={picBusy === "uploading"}
                  onPick={handlePickPicture}
                />
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold tracking-tight">
                    {profile.fullName}
                  </p>
                  <p className="text-sm text-muted-foreground">{profile.memberCode}</p>
                  <div className="mt-1 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePickPicture}
                      disabled={picBusy !== null}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                    >
                      <ImagePlus className="size-3" />
                      {profile.profilePicStorageId ? "Change" : "Upload photo"}
                    </button>
                    {profile.profilePicStorageId && (
                      <>
                        <span className="text-xs text-muted-foreground">·</span>
                        <button
                          type="button"
                          onClick={() => void handleRemovePicture()}
                          disabled={picBusy !== null}
                          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
                        >
                          <Trash2 className="size-3" />
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <MemberStatusBadge status={profile.status} />
            </div>
            <input
              ref={picInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handlePictureFile(e.target.files?.[0])}
            />
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
                  <TableHead className="text-right">Receipt</TableHead>
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
                    <TableCell className="text-right">
                      {p.acknowledgedAt ? (
                        <DuesReceiptDialog
                          payment={p}
                          member={profile}
                          trigger={
                            <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
                              <Printer className="size-3.5" />
                              Receipt
                            </Button>
                          }
                        />
                      ) : (
                        <DuesReceiptDialog
                          payment={p}
                          member={profile}
                          trigger={
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-xs">
                              <BadgeCheck className="size-3.5 text-muted-foreground" />
                              Acknowledge
                            </Button>
                          }
                        />
                      )}
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
