import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatBytes, formatDateTime, MAX_FILE_BYTES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  Clock,
  FileText,
  Hourglass,
  Loader2,
  Upload,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

// ---------- File reading ----------

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export const MAX_FILE_BYTES_LOCAL = MAX_FILE_BYTES;

/**
 * Uploads a supporting document (max 2MB) to Convex file storage and records
 * it against the claim.
 */
export async function uploadClaimDocument(
  addDoc: (args: {
    claimId: Id<"claims">;
    name: string;
    mimeType: string;
    size: number;
    storageId: Id<"_storage">;
  }) => Promise<unknown>,
  generateUploadUrl: () => Promise<string>,
  claimId: Id<"claims">,
  file: File,
) {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `${file.name} is ${formatBytes(file.size)} — the maximum size is 2MB`,
    );
  }
  const url = await generateUploadUrl();
  const result = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!result.ok) {
    throw new Error(`Upload failed for ${file.name} (HTTP ${result.status})`);
  }
  const { storageId } = (await result.json()) as { storageId: Id<"_storage"> };
  await addDoc({
    claimId,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    storageId,
  });
}

// ---------- Stat card ----------

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="card-layer flex items-start gap-3 rounded-xl border border-border/70 bg-card p-5">
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          accent
            ? "bg-primary text-primary-foreground"
            : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ---------- Status badges ----------

const MEMBER_STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  inactive: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  terminated: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
};

const CLAIM_STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  approved: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  rejected: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
};

const CLAIM_STATUS_ICONS: Record<string, typeof Clock> = {
  pending: Hourglass,
  approved: CheckCircle2,
  rejected: XCircle,
  paid: Wallet,
};

export function MemberStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("capitalize", MEMBER_STATUS_STYLES[status])}
    >
      {status}
    </Badge>
  );
}

export function ClaimStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("capitalize", CLAIM_STATUS_STYLES[status])}
    >
      {status}
    </Badge>
  );
}

export function ClaimStatusIcon({ status }: { status: string }) {
  const Icon = CLAIM_STATUS_ICONS[status] ?? FileText;
  return <Icon className="size-4" />;
}

// ---------- Maturity ----------

export function MaturityProgress({
  monthsActive,
  monthsRemaining,
  matured,
}: {
  monthsActive: number;
  monthsRemaining: number;
  matured: boolean;
}) {
  const pct = Math.min(100, Math.round((monthsActive / 6) * 100));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">
          {matured
            ? "Fully matured"
            : `${monthsRemaining} month${monthsRemaining === 1 ? "" : "s"} to maturity`}
        </span>
        {matured ? (
          <Badge className="gap-1 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400">
            <CheckCircle2 className="size-3" />
            Matured
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Clock className="size-3" />
            {Math.min(monthsActive, 6)}/6 months
          </Badge>
        )}
      </div>
      <Progress value={pct} className="h-2" />
      <p className="text-xs text-muted-foreground">
        Members mature after 6 months of membership, unlocking all benefits.
      </p>
    </div>
  );
}

// ---------- Empty state ----------

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Users;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/50 px-6 py-12 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------- Claim documents ----------

export function ClaimDocumentsDialog({
  claimId,
  canUpload,
  trigger,
  title = "Supporting documents",
}: {
  claimId: Id<"claims">;
  canUpload: boolean;
  trigger: ReactNode;
  title?: string;
}) {
  const docs = useQuery(api.welfare.listClaimDocuments, { claimId });
  const addDoc = useMutation(api.welfare.addClaimDocument);
  const generateUploadUrl = useMutation(api.welfare.generateUploadUrl);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadClaimDocument(
          (args) => addDoc(args),
          () => generateUploadUrl(),
          claimId,
          file,
        );
      }
      toast.success("Document(s) uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const docCount = docs?.length ?? 0;

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Payslips, invitation, transfer or retirement letters supporting
            this claim. Each file may be up to 2MB.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
          {docs === undefined ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : docCount === 0 ? (
            <p className="rounded-lg border border-dashed border-border/80 px-4 py-6 text-center text-sm text-muted-foreground">
              No documents attached yet.
            </p>
          ) : (
            docs.map((doc) =>
              doc.mimeType.startsWith("image/") ? (
                <StoredImage
                  key={doc._id}
                  name={doc.name}
                  storageId={doc.storageId}
                  dataUrl={doc.dataUrl}
                  uploadedAt={doc.uploadedAt}
                />
              ) : (
                <StoredFileRow
                  key={doc._id}
                  name={doc.name}
                  storageId={doc.storageId}
                  dataUrl={doc.dataUrl}
                  size={doc.size}
                  uploadedAt={doc.uploadedAt}
                />
              ),
            )
          )}
        </div>

        {canUpload && (
          <div className="border-t border-border/70 pt-4">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {uploading ? "Uploading…" : "Attach document"}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Maximum 2MB per file.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Stored document views ----------

function StoredImage({
  name,
  storageId,
  dataUrl,
  uploadedAt,
}: {
  name: string;
  storageId?: Id<"_storage">;
  dataUrl?: string;
  uploadedAt: number;
}) {
  const url = useQuery(
    api.welfare.getClaimDocumentUrl,
    storageId ? ({ storageId } as any) : "skip",
  );
  return (
    <figure className="overflow-hidden rounded-lg border border-border/70">
      {url ? (
        <img
          src={url}
          alt={name}
          className="max-h-56 w-full bg-secondary/40 object-contain"
        />
      ) : dataUrl ? (
        <img
          src={dataUrl}
          alt={name}
          className="max-h-56 w-full bg-secondary/40 object-contain"
        />
      ) : null}
      <figcaption className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs">
        <span className="truncate font-medium">{name}</span>
        <a
          href={url ?? dataUrl ?? "#"}
          download={name}
          className="shrink-0 font-medium text-primary hover:underline"
        >
          Download
        </a>
      </figcaption>
    </figure>
  );
}

function StoredFileRow({
  name,
  storageId,
  dataUrl,
  size,
  uploadedAt,
}: {
  name: string;
  storageId?: Id<"_storage">;
  dataUrl?: string;
  size?: number;
  uploadedAt: number;
}) {
  const url = useQuery(
    api.welfare.getClaimDocumentUrl,
    storageId ? ({ storageId } as any) : "skip",
  );
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(uploadedAt)}
            {size !== undefined && ` · ${formatBytes(size)}`}
          </p>
        </div>
      </div>
      <a
        href={url ?? dataUrl ?? "#"}
        download={name}
        className="shrink-0 text-sm font-medium text-primary hover:underline"
      >
        Download
      </a>
    </div>
  );
}
