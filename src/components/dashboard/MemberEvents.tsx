import { EmptyState } from "@/components/dashboard/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { formatDate } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Loader2,
  MapPin,
  PartyPopper,
  Plane,
  Flower2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

const EVENT_TYPE_META: Record<
  string,
  { label: string; icon: typeof Plane; classes: string }
> = {
  excursion: {
    label: "Excursion",
    icon: Plane,
    classes:
      "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
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

export default function MemberEvents() {
  const events = useQuery(api.welfare.listEvents);
  const register = useMutation(api.welfare.registerForEvent);
  const unregister = useMutation(api.welfare.unregisterFromEvent);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (events === undefined) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  const handleRegister = async (eventId: string, title: string) => {
    setBusyId(eventId);
    try {
      await register({ eventId: eventId as any });
      toast.success(`You are registered for ${title}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not register");
    } finally {
      setBusyId(null);
    }
  };

  const handleUnregister = async (eventId: string, title: string) => {
    setBusyId(eventId);
    try {
      await unregister({ eventId: eventId as any });
      toast.success(`Registration removed for ${title}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Events</h2>
        <p className="text-sm text-muted-foreground">
          Excursions, funerals, and weddings organised by the welfare —
          register here to attend.
        </p>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No events yet"
          description="When the admin publishes an excursion, funeral, or wedding, it will appear here for you to register."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((e) => {
            const busy = busyId === e._id;
            return (
              <Card key={e._id} className="card-layer">
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[15px] font-semibold leading-snug tracking-tight">
                      {e.title}
                    </h3>
                    <EventTypeBadge type={e.type} />
                  </div>
                  {e.description && (
                    <p className="text-sm leading-6 text-muted-foreground">
                      {e.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      {formatDate(e.eventDate)}
                    </span>
                    {e.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-3.5" />
                        {e.location}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-3">
                    {e.registered ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        disabled={busy}
                        onClick={() => void handleUnregister(e._id, e.title)}
                      >
                        {busy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                        You're going — withdraw
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="gap-2"
                        disabled={busy}
                        onClick={() => void handleRegister(e._id, e.title)}
                      >
                        {busy && <Loader2 className="size-4 animate-spin" />}
                        Register to attend
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {e.registrationCount} registered
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
