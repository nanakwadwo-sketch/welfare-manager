import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowRight,
  CalendarCheck,
  FileCheck2,
  HeartHandshake,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55, ease: "easeOut" as const },
};

const BENEFITS = [
  { label: "Death of a parent", amount: "GH¢500" },
  { label: "Death of a spouse", amount: "GH¢1,000" },
  { label: "Death of a child", amount: "GH¢1,000" },
  { label: "Wedding benefit", amount: "GH¢500" },
  { label: "Exit benefits", amount: "70% payout" },
];

const FEATURES = [
  {
    icon: Users,
    title: "Member profiles",
    body: "Every member gets a personal account showing their contribution history, maturity progress, and benefits applied.",
  },
  {
    icon: Upload,
    title: "Bulk onboarding",
    body: "Admins can add the whole workforce in one go with Excel-based bulk import — codes and records are generated automatically.",
  },
  {
    icon: CalendarCheck,
    title: "Dues tracking",
    body: "Monthly dues are recorded against each member, with configurable amounts that can change any time.",
  },
  {
    icon: FileCheck2,
    title: "Documented claims",
    body: "Claims are backed by payslips, invitation or transfer letters, and retirement letters — uploaded and reviewed in one place.",
  },
  {
    icon: ShieldCheck,
    title: "Six-month maturity",
    body: "Members mature after six months of membership, unlocking the full benefit package automatically.",
  },
  {
    icon: TrendingUp,
    title: "Live reports",
    body: "Dashboards for admins and members: dues collected, claims by status, and total funds at a glance.",
  },
];

export default function Landing() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <HeartHandshake className="size-4.5" strokeWidth={2.2} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">
              KGH Staff <span className="text-primary">Welfare</span>
            </span>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#benefits" className="transition-colors hover:text-foreground">
              Benefits
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#cta" className="transition-colors hover:text-foreground">
              Get started
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => navigate("/dashboard")}
              >
                <LayoutDashboard className="size-4" />
                Dashboard
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="hidden sm:inline-flex"
                  onClick={() => navigate("/auth")}
                >
                  Sign in
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => navigate("/auth")}>
                  Get started
                  <ArrowRight className="size-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[480px] max-w-4xl rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-6 pb-20 pt-20 text-center sm:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge
              variant="secondary"
              className="gap-1.5 rounded-full border-border/60 bg-secondary/70 px-3 py-1 text-[13px] font-medium text-secondary-foreground"
            >
              <Sparkles className="size-3.5 text-primary" />
              Mutual support, managed properly
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="mt-6 max-w-3xl text-balance-tight text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
          >
            Welfare your members can{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              actually rely on
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16 }}
            className="mt-5 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8"
          >
            KGH Staff Welfare keeps monthly dues, maturity, and benefit claims
            in one clean system — so when life happens, support arrives without
            the paperwork scramble.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.24 }}
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row"
          >
            <Button
              size="lg"
              className="h-11 gap-2 px-6 text-[15px] shadow-md shadow-primary/25"
              onClick={() =>
                isAuthenticated ? navigate("/dashboard") : navigate("/auth")
              }
            >
              {isAuthenticated ? "Open your dashboard" : "Sign in to your account"}
              <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-6 text-[15px]"
              onClick={() =>
                document.getElementById("benefits")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              See the benefit package
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-4 text-xs text-muted-foreground"
          >
            Email sign-in · Member &amp; admin workspaces · Claims with document proof
          </motion.p>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="mx-auto w-full max-w-6xl px-6 pb-24">
        <motion.div {...fadeUp} className="flex flex-col items-center text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-primary">
            Benefit package
          </span>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Clear payouts for the moments that matter
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            After six months of membership, matured members can claim these
            benefits. Admins can update amounts any time.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {BENEFITS.map((b, i) => (
            <motion.div
              key={b.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
            >
              <Card className="card-layer h-full rounded-xl border-border/70 transition-shadow hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-2 p-6">
                  <span className="text-2xl font-bold tracking-tight text-primary">
                    {b.amount}
                  </span>
                  <span className="text-sm font-medium leading-6 text-foreground/90">
                    {b.label}
                  </span>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>        <p className="mt-4 text-center text-xs text-muted-foreground">
          Exit benefits — retirement, transfer, and resignation — pay 70% of
          your total contribution. Repeat beneficiaries on other benefit types
          receive 60% of their total contribution.
        </p>
      </section>

      {/* Features */}
      <section
        id="features"
        className="border-y border-border/70 bg-secondary/40 py-24"
      >
        <div className="mx-auto w-full max-w-6xl px-6">
          <motion.div {...fadeUp} className="max-w-2xl">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">
              How it works
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything the scheme needs, nothing it doesn&apos;t
            </h2>
          </motion.div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: (i % 3) * 0.07 }}
              >
                <Card className="card-layer h-full rounded-xl border-border/70 transition-shadow hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-3 p-6">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <f.icon className="size-5" />
                    </div>
                    <h3 className="text-[15px] font-semibold tracking-tight">
                      {f.title}
                    </h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {f.body}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="mx-auto w-full max-w-6xl px-6 py-24">
        <motion.div {...fadeUp}>
          <Card className="card-layer-lg overflow-hidden rounded-2xl border-border/70">
            <div className="relative bg-primary px-6 py-14 text-center text-primary-foreground sm:px-16">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.16),transparent_55%)]"
              />
              <div className="relative">
                <h2 className="mx-auto max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
                  Ready to join the scheme?
                </h2>
                <p className="mx-auto mt-3 max-w-md text-[15px] leading-7 text-primary-foreground/80">
                  Sign in with your email to view your maturity progress, file a
                  claim, or manage the fund as an admin.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="h-11 gap-2 px-6 text-[15px] font-semibold"
                    onClick={() => navigate("/auth")}
                  >
                    Sign in / Sign up
                    <ArrowRight className="size-4" />
                  </Button>
                  <Link
                    to="/auth"
                    className="text-sm font-medium text-primary-foreground/80 underline-offset-4 hover:underline"
                  >
                    New here? Create your account with email
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </section>

      <footer className="border-t border-border/70 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <HeartHandshake className="size-3.5" />
            </div>
            <span className="font-medium text-foreground/80">KGH Staff Welfare</span>
          </div>
          <p>Monthly dues · 6-month maturity · Documented claims</p>
        </div>
        <p className="mt-4 border-t border-border/50 pt-4 text-center text-xs text-muted-foreground sm:border-t-0 sm:pt-0">
          System developed by: Richard Osei
        </p>
      </footer>
    </div>
  );
}
