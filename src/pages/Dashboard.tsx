import AdminClaims from "@/components/dashboard/AdminClaims";
import AdminMembers from "@/components/dashboard/AdminMembers";
import AdminPackages from "@/components/dashboard/AdminPackages";
import AdminReports from "@/components/dashboard/AdminReports";
import AdminUsers from "@/components/dashboard/AdminUsers";
import MemberBenefits from "@/components/dashboard/MemberBenefits";
import MemberClaims from "@/components/dashboard/MemberClaims";
import MemberOverview from "@/components/dashboard/MemberOverview";
import MemberReports from "@/components/dashboard/MemberReports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { HeartHandshake, Info, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router";

const MEMBER_TABS = [
  { value: "overview", label: "Overview" },
  { value: "benefits", label: "Benefits" },
  { value: "claims", label: "My claims" },
  { value: "reports", label: "My reports" },
];

const ADMIN_TABS = [
  { value: "reports", label: "Reports" },
  { value: "members", label: "Members" },
  { value: "claims", label: "Claims" },
  { value: "packages", label: "Benefit packages" },
  { value: "users", label: "Users" },
];

export default function Dashboard() {
  const { user, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  const bootstrap = useMutation(api.welfare.bootstrapWelfare);

  // Seed benefit packages and promote the first user to admin (idempotent).
  useEffect(() => {
    void bootstrap().catch(() => undefined);
  }, [bootstrap]);

  const isAdmin = user?.role === "admin";
  const isGuest = user?.isAnonymous === true;
  const tabs = isAdmin ? ADMIN_TABS : MEMBER_TABS;
  const defaultTab = isAdmin ? "reports" : "overview";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-64 w-full max-w-3xl animate-pulse rounded-xl bg-muted" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <HeartHandshake className="size-4.5" strokeWidth={2.2} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">
              Welfare<span className="text-primary">Fund</span>
            </span>
            {isAdmin && (
              <Badge className="ml-1 gap-1 bg-primary/10 text-primary hover:bg-primary/10">
                <ShieldCheck className="size-3" />
                Admin
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">
                {isGuest ? "Guest" : user?.name ?? user?.email ?? "Account"}
              </p>
              <p className="text-xs leading-tight text-muted-foreground">
                {user?.email ?? "Not linked to an email"}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleSignOut}
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <LayoutDashboard className="size-4" />
          <span>
            {isAdmin
              ? "Fund administration workspace"
              : "Your membership workspace"}
          </span>
        </div>

        {isGuest && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <Info className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                You are browsing as a guest. Sign in with your email to link
                your membership — guest accounts cannot hold data or become
                admins.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-2 border-amber-500/40"
              onClick={() => {
                void signOut().then(() => navigate("/auth"));
              }}
            >
              Sign in with email
            </Button>
          </div>
        )}

        <Tabs defaultValue={defaultTab} className="gap-6">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-lg bg-secondary/60 p-1 sm:w-auto">
            {tabs.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="whitespace-nowrap px-4 py-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {isAdmin ? (
            <>
              <TabsContent value="reports">
                <AdminReports />
              </TabsContent>
              <TabsContent value="members">
                <AdminMembers />
              </TabsContent>
              <TabsContent value="claims">
                <AdminClaims />
              </TabsContent>
              <TabsContent value="packages">
                <AdminPackages />
              </TabsContent>
              <TabsContent value="users">
                <AdminUsers />
              </TabsContent>
            </>
          ) : (
            <>
              <TabsContent value="overview">
                <MemberOverview />
              </TabsContent>
              <TabsContent value="benefits">
                <MemberBenefits />
              </TabsContent>
              <TabsContent value="claims">
                <MemberClaims />
              </TabsContent>
              <TabsContent value="reports">
                <MemberReports />
              </TabsContent>
            </>
          )}
        </Tabs>

        {!isAdmin && !isGuest && (
          <p className="mt-10 rounded-lg border border-border/70 bg-card/60 px-4 py-3 text-sm text-muted-foreground">
            Not registered as a member yet? The fund admin adds members by
            email — ask them to add <span className="font-medium text-foreground">{user?.email}</span>{" "}
            so your membership appears here.
          </p>
        )}
      </div>
    </main>
  );
}
