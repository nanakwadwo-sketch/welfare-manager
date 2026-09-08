import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";

const MATURITY_MONTHS = 6;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export const BENEFIT_KEYS = [
  "death_parent",
  "death_spouse",
  "death_child",
  "retirement",
  "transfer",
  "resignation",
] as const;
export type BenefitKey = (typeof BENEFIT_KEYS)[number];

export const BENEFIT_LABELS: Record<BenefitKey, string> = {
  death_parent: "Death of a parent",
  death_spouse: "Death of a spouse",
  death_child: "Death of a child",
  retirement: "Retirement",
  transfer: "Transfer",
  resignation: "Resignation",
};

const DEFAULT_PACKAGES: Array<{
  key: BenefitKey;
  label: string;
  kind: "fixed" | "percent";
  amount: number;
  percentOfContribution?: number;
}> = [
  { key: "death_parent", label: "Death of a parent", kind: "fixed", amount: 500 },
  { key: "death_spouse", label: "Death of a spouse", kind: "fixed", amount: 1000 },
  { key: "death_child", label: "Death of a child", kind: "fixed", amount: 1000 },
  { key: "retirement", label: "Retirement", kind: "percent", amount: 70, percentOfContribution: 70 },
  { key: "transfer", label: "Transfer", kind: "percent", amount: 70, percentOfContribution: 70 },
  { key: "resignation", label: "Resignation", kind: "percent", amount: 70, percentOfContribution: 70 },
];

export function monthsBetween(fromMs: number, toMs: number): number {
  return Math.max(0, Math.floor((toMs - fromMs) / MONTH_MS));
}

export function maturityInfo(joinedAt: number, now: number) {
  const monthsActive = monthsBetween(joinedAt, now);
  const matured = monthsActive >= MATURITY_MONTHS;
  const maturityDate = joinedAt + MATURITY_MONTHS * MONTH_MS;
  return {
    monthsActive,
    monthsRemaining: matured ? 0 : MATURITY_MONTHS - monthsActive,
    matured,
    maturityDate,
  };
}

async function requireAdmin(ctx: QueryCtx | any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not signed in");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") throw new Error("Admin access required");
  return { userId, user };
}

async function logActivity(
  ctx: any,
  actorId: string | undefined,
  actorName: string | undefined,
  action: string,
  detail?: string,
) {
  await ctx.db.insert("activityLog", {
    actorId,
    actorName,
    action,
    detail,
    createdAt: Date.now(),
  });
}

function memberMaturity(member: { joinedAt: number }, now: number) {
  return maturityInfo(member.joinedAt, now);
}

// ---------- Queries ----------

export const getMyMemberProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const email = user?.email ?? null;
    if (!email) return null;
    const member = await ctx.db
      .query("members")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .first();
    if (!member) return null;
    const payments = await ctx.db
      .query("duesPayments")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .collect();
    return {
      ...member,
      maturity: memberMaturity(member, Date.now()),
      totalPaid: payments.reduce((sum, p) => sum + p.amount, 0),
      paymentCount: payments.length,
    };
  },
});

export const getMyClaims = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    const email = user?.email ?? null;
    if (!email) return [];
    const member = await ctx.db
      .query("members")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .first();
    if (!member) return [];
    const claims = await ctx.db
      .query("claims")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .collect();
    return claims.sort((a, b) => b.filedAt - a.filedAt);
  },
});

export const adminListMembers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const members = await ctx.db.query("members").collect();
    const now = Date.now();
    const enriched = await Promise.all(
      members.map(async (m) => {
        const payments = await ctx.db
          .query("duesPayments")
          .withIndex("by_member", (q) => q.eq("memberId", m._id))
          .collect();
        return {
          ...m,
          maturity: memberMaturity(m, now),
          totalPaid: payments.reduce((s, p) => s + p.amount, 0),
          paymentCount: payments.length,
        };
      }),
    );
    return enriched.sort((a, b) => a.fullName.localeCompare(b.fullName));
  },
});

export const adminListClaims = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const claims = await ctx.db.query("claims").collect();
    const members = await ctx.db.query("members").collect();
    const byId = new Map(members.map((m) => [m._id, m]));
    return claims
      .map((c) => ({
        ...c,
        memberName: byId.get(c.memberId)?.fullName ?? "Unknown",
        memberCode: byId.get(c.memberId)?.memberCode ?? "—",
      }))
      .sort((a, b) => b.filedAt - a.filedAt);
  },
});

export const adminListPayments = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const payments = await ctx.db.query("duesPayments").collect();
    const members = await ctx.db.query("members").collect();
    const byId = new Map(members.map((m) => [m._id, m]));
    return payments
      .map((p) => ({
        ...p,
        memberName: byId.get(p.memberId)?.fullName ?? "Unknown",
        memberCode: byId.get(p.memberId)?.memberCode ?? "—",
      }))
      .sort((a, b) => b.recordedAt - a.recordedAt);
  },
});

export const getMyPayments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    const email = user?.email ?? null;
    if (!email) return [];
    const member = await ctx.db
      .query("members")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .first();
    if (!member) return [];
    const payments = await ctx.db
      .query("duesPayments")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .collect();
    return payments.sort((a, b) => b.recordedAt - a.recordedAt);
  },
});

export const adminListUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const members = await ctx.db.query("members").collect();
    const memberByEmail = new Map(members.map((m) => [m.email, m]));
    return users
      .map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        isAnonymous: u.isAnonymous,
        memberCode: u.email ? memberByEmail.get(u.email.toLowerCase())?.memberCode : undefined,
        memberStatus: u.email ? memberByEmail.get(u.email.toLowerCase())?.status : undefined,
      }))
      .sort((a, b) => (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? ""));
  },
});

export const listPackages = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db.query("benefitPackages").collect();
  },
});

export const adminListPackages = query({
  args: {},
  handler: async (ctx) => requireAdmin(ctx).then(() =>
    ctx.db.query("benefitPackages").collect(),
  ),
});

export const adminReports = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const members = await ctx.db.query("members").collect();
    const payments = await ctx.db.query("duesPayments").collect();
    const claims = await ctx.db.query("claims").collect();
    const now = Date.now();

    const matured = members.filter((m) => memberMaturity(m, now).matured).length;
    const totalContributed = payments.reduce((s, p) => s + p.amount, 0);
    const pendingClaims = claims.filter((c) => c.status === "pending").length;
    const approvedUnpaid = claims.filter(
      (c) => c.status === "approved",
    ).length;
    const paidClaims = claims.filter((c) => c.status === "paid");
    const totalPaidOut = paidClaims.reduce((s, c) => s + c.amount, 0);

    // dues collected by month
    const byMonth = new Map<string, number>();
    for (const p of payments) {
      byMonth.set(p.periodMonth, (byMonth.get(p.periodMonth) ?? 0) + p.amount);
    }
    const duesByMonth = Array.from(byMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, total]) => ({ month, total }));

    const claimsByStatus = ["pending", "approved", "rejected", "paid"].map(
      (status) => ({
        status,
        count: claims.filter((c) => c.status === status).length,
      }),
    );

    return {
      totalMembers: members.length,
      activeMembers: members.filter((m) => m.status === "active").length,
      maturedMembers: matured,
      totalContributed,
      pendingClaims,
      approvedUnpaid,
      totalPaidOut,
      duesByMonth,
      claimsByStatus,
      recentActivity: (
        await ctx.db.query("activityLog").withIndex("by_created").order("desc").take(12)
      ),
    };
  },
});

export const adminListActivity = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db
      .query("activityLog")
      .withIndex("by_created")
      .order("desc")
      .take(50);
  },
});

// ---------- Mutations ----------

async function nextMemberCode(ctx: any): Promise<string> {
  const all = await ctx.db.query("members").collect();
  const max = all.reduce((acc: number, m: any) => {
    const n = parseInt(m.memberCode.replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `WMS-${String(max + 1).padStart(4, "0")}`;
}

/**
 * One-time bootstrap, safe to call on every dashboard load:
 * - seeds the default benefit packages when the table is empty
 * - promotes the first signed-in user to admin when no admin exists yet
 */
export const bootstrapWelfare = mutation({
  args: {},
  handler: async (ctx) => {
    const packages = await ctx.db.query("benefitPackages").collect();
    if (packages.length === 0) {
      const now = Date.now();
      for (const pkg of DEFAULT_PACKAGES) {
        await ctx.db.insert("benefitPackages", { ...pkg, updatedAt: now });
      }
    }

    const anyAdmin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();
    if (!anyAdmin) {
      const userId = await getAuthUserId(ctx);
      if (userId) {
        await ctx.db.patch(userId, { role: "admin" });
        await logActivity(ctx, userId, (await ctx.db.get(userId))?.name, "admin.bootstrapped", "First user promoted to admin");
      }
    }
  },
});

export const adminAddMember = mutation({
  args: {
    fullName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    department: v.optional(v.string()),
    joinedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAdmin(ctx);
    const email = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query("members")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) throw new Error("A member with this email already exists");
    const joinedAt = args.joinedAt ?? Date.now();
    const memberCode = await nextMemberCode(ctx);
    const memberId = await ctx.db.insert("members", {
      email,
      memberCode,
      fullName: args.fullName.trim(),
      phone: args.phone?.trim() || undefined,
      department: args.department?.trim() || undefined,
      joinedAt,
      status: "active",
      totalContributed: 0,
    });
    await logActivity(
      ctx,
      userId,
      user?.name,
      "member.added",
      `${args.fullName.trim()} (${memberCode}) added by admin`,
    );
    return memberId;
  },
});

export const adminBulkAddMembers = mutation({
  args: {
    rows: v.array(
      v.object({
        fullName: v.string(),
        email: v.string(),
        phone: v.optional(v.string()),
        department: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAdmin(ctx);
    const results = { added: 0, skipped: 0, errors: [] as string[] };
    const all = await ctx.db.query("members").collect();
    const takenEmails = new Set(all.map((m) => m.email.toLowerCase()));
    let nextNum =
      all.reduce((acc: number, m: any) => {
        const n = parseInt(m.memberCode.replace(/\D/g, ""), 10);
        return Number.isFinite(n) && n > acc ? n : acc;
      }, 0) + 1;

    for (const row of args.rows) {
      const email = row.email.trim().toLowerCase();
      const fullName = row.fullName.trim();
      if (!fullName || !email || !email.includes("@")) {
        results.errors.push(`Invalid row: "${fullName || "?"}" ${email || "(no email)"}`);
        results.skipped++;
        continue;
      }
      if (takenEmails.has(email)) {
        results.skipped++;
        continue;
      }
      const memberCode = `WMS-${String(nextNum).padStart(4, "0")}`;
      nextNum++;
      takenEmails.add(email);
      await ctx.db.insert("members", {
        email,
        memberCode,
        fullName,
        phone: row.phone?.trim() || undefined,
        department: row.department?.trim() || undefined,
        joinedAt: Date.now(),
        status: "active",
        totalContributed: 0,
      });
      results.added++;
    }
    await logActivity(
      ctx,
      userId,
      user?.name,
      "member.bulk_added",
      `${results.added} members added, ${results.skipped} skipped`,
    );
    return results;
  },
});

export const adminUpdateMember = mutation({
  args: {
    memberId: v.id("members"),
    fullName: v.optional(v.string()),
    phone: v.optional(v.string()),
    department: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("inactive"),
        v.literal("terminated"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAdmin(ctx);
    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Member not found");
    const patch: Record<string, unknown> = {};
    if (args.fullName !== undefined) patch.fullName = args.fullName.trim();
    if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
    if (args.department !== undefined)
      patch.department = args.department.trim() || undefined;
    if (args.status !== undefined) patch.status = args.status;
    if (Object.keys(patch).length === 0) return;
    await ctx.db.patch(args.memberId, patch);
    await logActivity(
      ctx,
      userId,
      user?.name,
      "member.updated",
      `${member.fullName} (${member.memberCode}) updated`,
    );
  },
});

export const adminRecordDues = mutation({
  args: {
    memberId: v.id("members"),
    amount: v.number(),
    periodMonth: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAdmin(ctx);
    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Member not found");
    if (!/^\d{4}-\d{2}$/.test(args.periodMonth))
      throw new Error("Period must be in YYYY-MM format");
    if (args.amount <= 0) throw new Error("Amount must be positive");
    const dup = await ctx.db
      .query("duesPayments")
      .withIndex("by_member", (q) => q.eq("memberId", args.memberId))
      .collect();
    if (dup.some((p) => p.periodMonth === args.periodMonth))
      throw new Error(
        `A payment for ${args.periodMonth} already exists for this member`,
      );
    await ctx.db.insert("duesPayments", {
      memberId: args.memberId,
      amount: args.amount,
      periodMonth: args.periodMonth,
      recordedAt: Date.now(),
      note: args.note?.trim() || undefined,
    });
    await ctx.db.patch(args.memberId, {
      totalContributed: member.totalContributed + args.amount,
    });
    await logActivity(
      ctx,
      userId,
      user?.name,
      "dues.recorded",
      `GH¢${args.amount.toFixed(2)} for ${member.fullName} (${args.periodMonth})`,
    );
  },
});

export const adminSetUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("user")),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAdmin(ctx);
    if (args.userId === userId && args.role !== "admin")
      throw new Error("You cannot remove your own admin access");
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");
    await ctx.db.patch(args.userId, { role: args.role });
    await logActivity(
      ctx,
      userId,
      user?.name,
      "user.role_changed",
      `${target.name ?? target.email ?? "User"} is now ${args.role}`,
    );
  },
});

export const adminUpdatePackage = mutation({
  args: {
    key: v.string(),
    label: v.string(),
    kind: v.union(v.literal("fixed"), v.literal("percent")),
    amount: v.number(),
    percentOfContribution: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("benefitPackages")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (args.kind === "fixed" && args.amount <= 0)
      throw new Error("Amount must be positive");
    if (args.kind === "percent" && (args.amount < 0 || args.amount > 100))
      throw new Error("Percent must be between 0 and 100");
    if (existing) {
      await ctx.db.patch(existing._id, {
        label: args.label,
        kind: args.kind,
        amount: args.amount,
        percentOfContribution: args.percentOfContribution,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("benefitPackages", {
        key: args.key,
        label: args.label,
        kind: args.kind,
        amount: args.amount,
        percentOfContribution: args.percentOfContribution,
        updatedAt: Date.now(),
      });
    }
    await logActivity(
      ctx,
      userId,
      user?.name,
      "package.updated",
      `${args.label} updated to ${args.kind === "fixed" ? `GH¢${args.amount}` : `${args.amount}%`}`,
    );
  },
});

export const fileClaim = mutation({
  args: {
    benefitKey: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const user = await ctx.db.get(userId);
    const email = user?.email ?? null;
    if (!email) throw new Error("No email on account");
    const member = await ctx.db
      .query("members")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .first();
    if (!member) throw new Error("You are not registered as a member");
    const maturity = memberMaturity(member, Date.now());
    if (!maturity.matured)
      throw new Error(
        `You mature after ${MATURITY_MONTHS} months of membership (${maturity.monthsRemaining} month(s) remaining).`,
      );
    if (member.status !== "active")
      throw new Error("Only active members can file claims");

    const pkg = await ctx.db
      .query("benefitPackages")
      .withIndex("by_key", (q) => q.eq("key", args.benefitKey))
      .first();
    if (!pkg) throw new Error("Unknown benefit type");

    const payments = await ctx.db
      .query("duesPayments")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .collect();
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const amount =
      pkg.kind === "percent"
        ? Math.round(((pkg.percentOfContribution ?? pkg.amount) / 100) * totalPaid * 100) / 100
        : pkg.amount;

    const claimId = await ctx.db.insert("claims", {
      memberId: member._id,
      benefitKey: args.benefitKey,
      amount,
      status: "pending",
      details: args.details?.trim() || undefined,
      filedAt: Date.now(),
    });
    await logActivity(
      ctx,
      userId,
      user?.name,
      "claim.filed",
      `${member.fullName} filed ${BENEFIT_LABELS[args.benefitKey as BenefitKey] ?? args.benefitKey} (GH¢${amount.toFixed(2)})`,
    );
    return claimId;
  },
});

export const addClaimDocument = mutation({
  args: {
    claimId: v.id("claims"),
    name: v.string(),
    mimeType: v.string(),
    dataUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");
    const user = await ctx.db.get(userId);
    const member = claim ? await ctx.db.get(claim.memberId) : null;
    const isAdmin = user?.role === "admin";
    const isOwner =
      member && user?.email && member.email === user.email.toLowerCase();
    if (!isAdmin && !isOwner) throw new Error("Not allowed");
    if (args.dataUrl.length > 4_000_000)
      throw new Error("File too large (max ~3MB)");
    await ctx.db.insert("claimDocuments", {
      claimId: args.claimId,
      name: args.name,
      mimeType: args.mimeType,
      dataUrl: args.dataUrl,
      uploadedAt: Date.now(),
      uploadedBy: userId,
    });
    await logActivity(
      ctx,
      userId,
      user?.name,
      "claim.document_added",
      `${args.name} attached to claim by ${isAdmin ? "admin" : "member"}`,
    );
  },
});

export const listClaimDocuments = query({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (!user) return [];
    const claim = await ctx.db.get(args.claimId);
    if (!claim) return [];
    const member = await ctx.db.get(claim.memberId);
    const isAdmin = user.role === "admin";
    const isOwner =
      member && user.email && member.email === user.email.toLowerCase();
    if (!isAdmin && !isOwner) return [];
    return ctx.db
      .query("claimDocuments")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .collect();
  },
});

export const adminReviewClaim = mutation({
  args: {
    claimId: v.id("claims"),
    decision: v.union(
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("paid"),
    ),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAdmin(ctx);
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");
    if (claim.status === "paid")
      throw new Error("This claim has already been paid");
    if (args.decision === "paid" && claim.status !== "approved")
      throw new Error("Only approved claims can be marked as paid");
    await ctx.db.patch(args.claimId, {
      status: args.decision,
      reviewedBy: userId,
      reviewedAt: Date.now(),
      reviewNote: args.reviewNote?.trim() || undefined,
    });
    await logActivity(
      ctx,
      userId,
      user?.name,
      `claim.${args.decision}`,
      `Claim for GH¢${claim.amount.toFixed(2)} marked ${args.decision}`,
    );
  },
});
