import { EmptyState } from "@/components/dashboard/shared";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate, formatDateTime } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarDays,
  CalendarPlus,
  Loader2,
  MapPin,
  PartyPopper,
  Plane,
  Flower2,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type EventRow = {
  _id: Id<"welfareEvents">;
  title: string;
  type: "excursion" | "funeral" | "wedding" | "other";
  description?: string;
  location?: string;
  eventDate: number;
  createdAt: number;
  registrationCount: number;
  registered: boolean;
};

const EVENT_TYPE_META: Record<
  string,
  { label: string; icon: typeof Plane; classes: string }
> = {
  excursion: {
    label: "Excursion",
    icon: Plane,
    classes: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
  },
  funeral: {
    label: "Funeral attendance",
    icon: Flower2,
    classes:
      "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20",
  },
  wedding: {
    label: "Wedding attendance",
    icon: PartyPopper,
    classes:
      "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
  },
  other: {
    label: "Other",
    icon: Sparkles,
    classes:
      "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20",
  },
};

function EventTypeBadge({ type }: { type: string }) {
  const meta = EVENT_TYPE_META[type] ?? EVENT_TYPE_META.other;
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${meta.classes}`}>
      <Icon className="size-3" />
      {meta.label}
    </Badge>
  );
}

export default function AdminEvents() {
  const events = useQuery(api.welfare.listEvents);
  const [deleting, setDeleting] = useState<EventRow | null>(null);

  if (events === undefined) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  const upcoming = events.filter((e) => e.eventDate >= Date.now());
  const past = events.filter((e) => e.eventDate < Date.now());

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Events</h2>
          <p className="text-sm text-muted-foreground">
            Create excursions, funeral or wedding attendance, and other events —
            members register from their workspace.
          </p>
        </div>
        <CreateEventDialog />
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No events yet"
          description="Create your first event — members will see it and can register to attend."
        />
      ) : (
        <div className="space-y-6">
          {[
            { label: "Upcoming", list: upcoming },
            { label: "Past", list: past },
          ].map(
            (group) =>
              group.list.length > 0 && (
                <div key={group.label}>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {group.list.map((e) => (
                      <EventCard event={e} onDelete={() => setDeleting(e)} />
                    ))}
                  </div>
                </div>
              ),
          )}
        </div>
      )}

      <DeleteEventDialog
        event={deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      />
    </div>
  );
}

function EventCard({ event, onDelete }: { event: EventRow; onDelete: () => void }) {
  const [regOpen, setRegOpen] = useState(false);

  return (
    <Card className="card-layer">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15px] font-semibold leading-snug tracking-tight">
            {event.title}
          </h3>
          <EventTypeBadge type={event.type} />
        </div>
        {event.description && (
          <p className="text-sm leading-6 text-muted-foreground">
            {event.description}
          </p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {formatDate(event.eventDate)}
          </span>
          {event.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {event.location}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-3">
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => setRegOpen(true)}
          >
            <Users className="size-4" />
            Registrations
            <Badge
              variant="secondary"
              className="ml-1 h-5 min-w-5 px-1.5 text-[11px] tabular-nums"
            >
              {event.registrationCount}
            </Badge>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
            title="Delete event"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardContent>

      <RegistrationsDialog
        event={event}
        open={regOpen}
        onOpenChange={setRegOpen}
      />
    </Card>
  );
}

function RegistrationsDialog({
  event,
  open,
  onOpenChange,
}: {
  event: EventRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const regs = useQuery(
    api.welfare.adminListEventRegistrations,
    open ? { eventId: event._id } : "skip",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrations — {event.title}</DialogTitle>
          <DialogDescription>
            {formatDate(event.eventDate)} ·{" "}
            {regs ? `${regs.length} member(s) registered` : "Loading…"}
          </DialogDescription>
        </DialogHeader>
        {regs === undefined ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : regs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/80 px-4 py-6 text-center text-sm text-muted-foreground">
            No members have registered yet.
          </p>
        ) : (
          <div className="max-h-[320px] overflow-y-auto rounded-lg border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="hidden sm:table-cell">Contact</TableHead>
                  <TableHead className="text-right">Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regs.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell>
                      <div className="font-medium">{r.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.memberCode}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                      {r.email}
                      {r.phone ? ` · ${r.phone}` : ""}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDateTime(r.registeredAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateEventDialog() {
  const createEvent = useMutation(api.welfare.adminCreateEvent);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("excursion");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setType("excursion");
    setDescription("");
    setLocation("");
    setDate("");
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Give the event a title");
      return;
    }
    if (!date) {
      toast.error("Pick a date for the event");
      return;
    }
    setSaving(true);
    try {
      // Local midnight of the chosen date, as a plain calendar date.
      const [y, m, d] = date.split("-").map(Number);
      const eventDate = new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
      await createEvent({
        title,
        type: type as "excursion" | "funeral" | "wedding" | "other",
        description: description || undefined,
        location: location || undefined,
        eventDate,
      });
      toast.success(`${title.trim()} created — members can now register`);
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create event");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <CalendarPlus className="size-4" />
          Create event
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create an event</DialogTitle>
          <DialogDescription>
            Members will see this event in their workspace and can register to
            attend.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Annual staff excursion — Aburi Gardens"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excursion">Excursion</SelectItem>
                  <SelectItem value="funeral">Funeral attendance</SelectItem>
                  <SelectItem value="wedding">Wedding attendance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-date">Date</Label>
              <Input
                id="event-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="event-location">Location (optional)</Label>
            <Input
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Aburi Botanical Gardens"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="event-desc">Description (optional)</Label>
            <Textarea
              id="event-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any details members should know — transport, contribution, dress code…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => void handleCreate()}
            disabled={saving}
            className="w-full gap-2"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Creating…" : "Create event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteEventDialog({
  event,
  onOpenChange,
}: {
  event: EventRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const deleteEvent = useMutation(api.welfare.adminDeleteEvent);
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (!event) return;
    setBusy(true);
    try {
      await deleteEvent({ eventId: event._id });
      toast.success(`${event.title} deleted`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete event");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!event} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete event</DialogTitle>
          <DialogDescription>
            {event
              ? `Delete “${event.title}” and its ${event.registrationCount} registration(s)? This cannot be undone.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={busy}
            className="gap-2"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
