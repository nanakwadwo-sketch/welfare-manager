import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";

const MATURITY_MONTHS = 6;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// Maximum size of a single supporting document upload.
export const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB
// Legacy data-URL documents: base64 inflates files by ~1.37x plus the
// data: prefix, so cap the stored string just above a 2MB file.
const MAX_DATA_URL_CHARS = 2_950_000;

export const BENEFIT_KEYS = [
  "death_parent",
  "death_spouse",
  "death_child",
  "wedding",
  "retirement",
  "transfer",
  "resignation",
] as const;
export type BenefitKey = (typeof BENEFIT_KEYS)[number];

export const BENEFIT_LABELS: Record<BenefitKey, string> = {
  death_parent: "Death of a parent",
  death_spouse: "Death of a spouse",
  death_child: "Death of a child",
  wedding: "Wedding",
  retirement: "Retirement",
  transfer: "Transfer",
  resignation: "Resignation",
};

// Claims that always pay their full configured amount. Every other benefit
// pays only 60% of the total contribution once a member has already been
// paid a benefit before.
const REPEAT_EXEMPT_KEYS: ReadonlySet<string> = new Set([
  "retirement",
  "wedding",
  "death_parent",
  "death_spouse",
  "death_child",
]);
export const REPEAT_BENEFICIARY_PERCENT = 60;

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
  { key: "wedding", label: "Wedding", kind: "fixed", amount: 500 },
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

/**
 * Remove a sign-in account entirely: sessions, refresh tokens, auth provider
 * accounts, verification codes, then the users row itself. Safe on already-
 * deleted ids.
 */
async function purgeAuthAccount(ctx: any, targetUserId: string) {
  for (const session of await ctx.db
    .query("authSessions")
    .withIndex("userId", (q: any) => q.eq("userId", targetUserId))
    .collect()) {
    for (const token of await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q: any) => q.eq("sessionId", session._id))
      .collect()) {
      await ctx.db.delete(token._id);
    }
    await ctx.db.delete(session._id);
  }
  for (const account of await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q: any) => q.eq("userId", targetUserId))
    .collect()) {
    for (const code of await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q: any) => q.eq("accountId", account._id))
      .collect()) {
      await ctx.db.delete(code._id);
    }
    await ctx.db.delete(account._id);
  }
  await ctx.db.delete(targetUserId);
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
    const myClaims = await ctx.db
      .query("claims")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .collect();
    return {
      ...member,
      maturity: memberMaturity(member, Date.now()),
      totalPaid: payments.reduce((sum, p) => sum + p.amount, 0),
      paymentCount: payments.length,
      hasBenefitedBefore: myClaims.some(
        (c) => c.status === "approved" || c.status === "paid",
      ),
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
      .map((u) => {
        const linked = u.email ? memberByEmail.get(u.email.toLowerCase()) : undefined;
        return {
          _id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          memberId: linked?._id,
          memberCode: linked?.memberCode,
          memberStatus: linked?.status,
          memberProfilePic: linked?.profilePicStorageId,
        };
      })
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

// ---------- Events ----------

export const listEvents = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    const email = user?.email ?? null;
    const myMember = email
      ? await ctx.db
          .query("members")
          .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
          .first()
      : null;

    const events = await ctx.db
      .query("welfareEvents")
      .withIndex("by_date")
      .order("desc")
      .collect();
    const registrations = await ctx.db.query("eventRegistrations").collect();

    return events.map((e) => {
      const forEvent = registrations.filter((r) => r.eventId === e._id);
      return {
        ...e,
        registrationCount: forEvent.length,
        registered: !!myMember && forEvent.some((r) => r.memberId === myMember._id),
      };
    });
  },
});

export const adminListEventRegistrations = query({
  args: { eventId: v.id("welfareEvents") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const regs = await ctx.db
      .query("eventRegistrations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const members = await ctx.db.query("members").collect();
    const byId = new Map(members.map((m) => [m._id, m]));
    return regs
      .map((r) => {
        const m = byId.get(r.memberId);
        return {
          _id: r._id,
          registeredAt: r.registeredAt,
          memberId: r.memberId,
          fullName: m?.fullName ?? "Unknown",
          memberCode: m?.memberCode ?? "—",
          email: m?.email ?? "—",
          staffId: m?.staffId,
          phone: m?.phone,
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
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

// The benefit keys seeded into an empty deployment (also used to backfill
// packages added in later app versions, e.g. the wedding benefit).
const SEEDED_PACKAGE_KEYS = new Set(DEFAULT_PACKAGES.map((p) => p.key));

/**
 * One-time bootstrap, safe to call on every dashboard load:
 * - seeds the default benefit packages when the table is empty
 * - backfills benefit packages added in later app versions (e.g. wedding)
 * - promotes the first signed-in user to admin when no admin exists yet
 */
export const bootstrapWelfare = mutation({
  args: {},
  handler: async (ctx) => {
    const packages = await ctx.db.query("benefitPackages").collect();
    const now = Date.now();
    // Seed default packages, backfilling keys added in later app versions
    // (e.g. wedding) so existing deployments pick up new benefits.
    const present = new Set(packages.map((p) => p.key));
    for (const pkg of DEFAULT_PACKAGES) {
      if (!present.has(pkg.key)) {
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
        const user = await ctx.db.get(userId);
        // Only promote real (non-guest) accounts with an email — anonymous
        // sign-ins must never capture the admin role.
        if (user && !user.isAnonymous && user.email) {
          await ctx.db.patch(userId, { role: "admin" });
          await logActivity(
            ctx,
            userId,
            user.name,
            "admin.bootstrapped",
            `First admin: ${user.name ?? user.email}`,
          );
        }
      }
    }

    // Link the signed-in account to its member record (once), so admins can
    // delete a member together with their sign-in account and the member
    // dashboard can resolve the signed-in member directly.
    const linkUserId = await getAuthUserId(ctx);
    if (linkUserId) {
      const linkUser = await ctx.db.get(linkUserId);
      const linkEmail = linkUser?.email?.toLowerCase();
      if (linkEmail) {
        const member = await ctx.db
          .query("members")
          .withIndex("by_email", (q) => q.eq("email", linkEmail))
          .first();
        if (member && member.userId !== linkUserId) {
          await ctx.db.patch(member._id, { userId: linkUserId });
        }
      }
    }

    // Guest (anonymous) accounts are no longer part of the system: every load
    // sweeps the users table and removes any leftover anonymous rows together
    // with their sessions and auth records. Idempotent — no-op once clean.
    const anonymous = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isAnonymous"), true))
      .collect();
    for (const anon of anonymous) {
      try {
        await purgeAuthAccount(ctx, anon._id);
      } catch {
        // The row may have been removed concurrently — keep sweeping.
      }
    }
  },
});

export const adminAddMember = mutation({
  args: {
    fullName: v.string(),
    email: v.string(),
    staffId: v.optional(v.string()),
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
      staffId: args.staffId?.trim() || undefined,
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
        staffId: v.optional(v.string()),
        phone: v.optional(v.string()),
        department: v.optional(v.string()),
        joinedAt: v.optional(v.number()),
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
        staffId: row.staffId?.trim() || undefined,
        phone: row.phone?.trim() || undefined,
        department: row.department?.trim() || undefined,
        joinedAt: row.joinedAt ?? Date.now(),
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
    staffId: v.optional(v.string()),
    phone: v.optional(v.string()),
    department: v.optional(v.string()),
    joinedAt: v.optional(v.number()),
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
    if (args.staffId !== undefined)
      patch.staffId = args.staffId.trim() || undefined;
    if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
    if (args.department !== undefined)
      patch.department = args.department.trim() || undefined;
    if (args.status !== undefined) patch.status = args.status;
    if (args.joinedAt !== undefined) {
      // Sanity checks: join date must be a plausible past date.
      if (
        !Number.isFinite(args.joinedAt) ||
        args.joinedAt > Date.now() + 24 * 60 * 60 * 1000 ||
        args.joinedAt < new Date("1950-01-01").getTime()
      ) {
        throw new Error("Join date must be a valid date (not in the future)");
      }
      patch.joinedAt = args.joinedAt;
    }
    if (Object.keys(patch).length === 0) return;
    await ctx.db.patch(args.memberId, patch);
    const detail =
      patch.joinedAt !== undefined && patch.joinedAt !== member.joinedAt
        ? `${member.fullName} (${member.memberCode}) updated — join date moved to ${new Date(
            patch.joinedAt as number,
          ).toISOString().slice(0, 10)}, which affects maturity`
        : `${member.fullName} (${member.memberCode}) updated`;
    await logActivity(ctx, userId, user?.name, "member.updated", detail);
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

/**
 * Permanently deletes a member and ALL of their welfare data: dues payments,
 * claims with their supporting documents (and the stored files), event
 * registrations, profile picture, plus their linked sign-in account and
 * sessions. There is no undo. The activity log entry survives deletion so
 * the audit trail still shows who was removed and by whom.
 */
export const adminDeleteMember = mutation({
  args: { memberId: v.id("members") },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAdmin(ctx);
    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Member not found");

    // Dues payments.
    for (const payment of await ctx.db
      .query("duesPayments")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .collect()) {
      await ctx.db.delete(payment._id);
    }

    // Claims and their documents (including stored files).
    const docs = new Set<string>();
    for (const claim of await ctx.db
      .query("claims")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .collect()) {
      for (const doc of await ctx.db
        .query("claimDocuments")
        .withIndex("by_claim", (q) => q.eq("claimId", claim._id))
        .collect()) {
        if (doc.storageId) docs.add(doc.storageId);
        await ctx.db.delete(doc._id);
      }
      await ctx.db.delete(claim._id);
    }
    for (const storageId of docs) {
      try {
        await ctx.storage.delete(storageId as any);
      } catch {
        // File may already be gone — continue.
      }
    }

    // Event registrations.
    for (const reg of await ctx.db
      .query("eventRegistrations")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .collect()) {
      await ctx.db.delete(reg._id);
    }

    // Profile picture.
    if (member.profilePicStorageId) {
      try {
        await ctx.storage.delete(member.profilePicStorageId);
      } catch {
        // Already gone.
      }
    }

    // Linked sign-in account (if any): sessions, refresh tokens, accounts,
    // verification codes, then the user record itself. Resolve the account
    // via member.userId first, then fall back to matching by email so a
    // member is never left with an orphaned sign-in account.
    const linkedUserId =
      member.userId ??
      (member.email
        ? (
            await ctx.db
              .query("users")
              .withIndex("email", (q) => q.eq("email", member.email))
              .first()
          )?._id
        : undefined);
    if (linkedUserId) {
      if (linkedUserId === userId) {
        throw new Error("You cannot delete your own account");
      }
      await purgeAuthAccount(ctx, linkedUserId);
    }

    // Finally, the member record itself.
    await ctx.db.delete(member._id);

    await logActivity(
      ctx,
      userId,
      user?.name,
      "member.deleted",
      `${member.fullName} (${member.memberCode}) deleted permanently with all dues, claims, and their sign-in account`,
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

    // Has this member already been paid a benefit before? Repeat
    // beneficiaries on non-exempt benefits receive 60% of their total
    // contribution instead of the fixed package amount.
    const previousClaims = await ctx.db
      .query("claims")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .collect();
    const hasBenefitedBefore = previousClaims.some(
      (c) => c.status === "approved" || c.status === "paid",
    );
    const isRepeatBeneficiary = hasBenefitedBefore;

    let amount: number;
    if (pkg.kind === "percent") {
      amount =
        Math.round(((pkg.percentOfContribution ?? pkg.amount) / 100) * totalPaid * 100) / 100;
    } else if (isRepeatBeneficiary && !REPEAT_EXEMPT_KEYS.has(pkg.key)) {
      amount =
        Math.round((REPEAT_BENEFICIARY_PERCENT / 100) * totalPaid * 100) / 100;
    } else {
      amount = pkg.amount;
    }

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
      `${member.fullName} filed ${BENEFIT_LABELS[args.benefitKey as BenefitKey] ?? args.benefitKey} (GH¢${amount.toFixed(2)})${
        isRepeatBeneficiary && !REPEAT_EXEMPT_KEYS.has(args.benefitKey)
          ? ` — repeat beneficiary at ${REPEAT_BENEFICIARY_PERCENT}% of contribution`
          : ""
      }`,
    );
    return claimId;
  },
});

export const addClaimDocument = mutation({
  args: {
    claimId: v.id("claims"),
    name: v.string(),
    mimeType: v.string(),
    size: v.optional(v.number()),
    storageId: v.optional(v.id("_storage")),
    dataUrl: v.optional(v.string()),
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
    if (args.storageId) {
      // Files are uploaded straight to Convex storage — enforce the 2MB
      // limit server-side using the size reported by the upload.
      if (args.size !== undefined && args.size > MAX_FILE_BYTES)
        throw new Error("File too large (max 2MB)");
    } else if (args.dataUrl) {
      if (args.dataUrl.length > MAX_DATA_URL_CHARS)
        throw new Error("File too large (max 2MB)");
    } else {
      throw new Error("No file content provided");
    }
    await ctx.db.insert("claimDocuments", {
      claimId: args.claimId,
      name: args.name,
      mimeType: args.mimeType,
      storageId: args.storageId,
      dataUrl: args.dataUrl,
      size: args.size,
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

export const getClaimDocumentUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
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

// ---------- Events mutations ----------

export const adminCreateEvent = mutation({
  args: {
    title: v.string(),
    type: v.union(
      v.literal("excursion"),
      v.literal("funeral"),
      v.literal("wedding"),
      v.literal("other"),
    ),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    eventDate: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAdmin(ctx);
    const title = args.title.trim();
    if (!title) throw new Error("Title is required");
    if (!Number.isFinite(args.eventDate))
      throw new Error("Invalid event date");
    await ctx.db.insert("welfareEvents", {
      title,
      type: args.type,
      description: args.description?.trim() || undefined,
      location: args.location?.trim() || undefined,
      eventDate: args.eventDate,
      createdBy: userId,
      createdAt: Date.now(),
    });
    await logActivity(
      ctx,
      userId,
      user?.name,
      "event.created",
      `${title} (${args.type}) created`,
    );
  },
});

export const adminDeleteEvent = mutation({
  args: { eventId: v.id("welfareEvents") },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAdmin(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");
    const regs = await ctx.db
      .query("eventRegistrations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    for (const r of regs) {
      await ctx.db.delete(r._id);
    }
    await ctx.db.delete(args.eventId);
    await logActivity(
      ctx,
      userId,
      user?.name,
      "event.deleted",
      `${event.title} deleted (with ${regs.length} registration(s))`,
    );
  },
});

export const registerForEvent = mutation({
  args: { eventId: v.id("welfareEvents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const user = await ctx.db.get(userId);
    const email = user?.email ?? null;
    if (!email) throw new Error("Sign in with your email to register for events");
    const member = await ctx.db
      .query("members")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .first();
    if (!member) throw new Error("You are not registered as a member");
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    const existing = await ctx.db
      .query("eventRegistrations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    if (existing.some((r) => r.memberId === member._id))
      throw new Error("You have already registered for this event");

    await ctx.db.insert("eventRegistrations", {
      eventId: args.eventId,
      memberId: member._id,
      registeredAt: Date.now(),
    });
    await logActivity(
      ctx,
      userId,
      user?.name,
      "event.registered",
      `${member.fullName} registered for ${event.title}`,
    );
  },
});

export const unregisterFromEvent = mutation({
  args: { eventId: v.id("welfareEvents") },
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

    const regs = await ctx.db
      .query("eventRegistrations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const mine = regs.find((r) => r.memberId === member._id);
    if (!mine) throw new Error("You are not registered for this event");
    await ctx.db.delete(mine._id);
  },
});

/**
 * Generates a short-lived upload URL for the Convex file store. The client
 * POSTs the raw file to this URL (enforcing the 2MB limit), then records the
 * returned storage id via addClaimDocument.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    return await ctx.storage.generateUploadUrl();
  },
});

// ---------- Member profile picture ----------

/**
 * The signed-in member sets their profile picture. The client first POSTs the
 * image to a generated upload URL, then passes the returned storage id here.
 * Images only, max 2MB. Replaces (and deletes) any previous picture.
 */
export const setMyProfilePicture = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const user = await ctx.db.get(userId);
    const email = user?.email ?? null;
    if (!email) throw new Error("Sign in with your email to upload a profile picture");
    const member = await ctx.db
      .query("members")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .first();
    if (!member) throw new Error("Only registered members can upload a profile picture");

    // Validate: image type and size are reported by the storage metadata.
    const metadata = await ctx.db.system.get(args.storageId);
    if (!metadata) throw new Error("Upload not found — try again");
    const mime = metadata.contentType ?? "";
    if (!mime.startsWith("image/")) {
      await ctx.storage.delete(args.storageId);
      throw new Error("Profile picture must be an image (JPG or PNG)");
    }
    const size = metadata.size ?? 0;
    if (size > MAX_FILE_BYTES) {
      await ctx.storage.delete(args.storageId);
      throw new Error("Profile picture must be 2MB or smaller");
    }

    // Remove the old picture so storage doesn't accumulate orphans.
    if (member.profilePicStorageId) {
      try {
        await ctx.storage.delete(member.profilePicStorageId);
      } catch {
        // Old file may already be gone — safe to continue.
      }
    }

    await ctx.db.patch(member._id, { profilePicStorageId: args.storageId });
    await logActivity(ctx, userId, user?.name, "member.profile_picture_updated", `${member.fullName} updated their profile picture`);
  },
});

/** Removes the signed-in member's profile picture. */
export const removeMyProfilePicture = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const user = await ctx.db.get(userId);
    const email = user?.email ?? null;
    if (!email) throw new Error("Not signed in with email");
    const member = await ctx.db
      .query("members")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .first();
    if (!member) throw new Error("Only registered members can edit their profile");
    if (member.profilePicStorageId) {
      try {
        await ctx.storage.delete(member.profilePicStorageId);
      } catch {
        // Already gone — fine.
      }
      await ctx.db.patch(member._id, { profilePicStorageId: undefined });
    }
  },
});

/** Read-only URL for a member's profile picture (admin or the member themself). */
export const getProfilePictureUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    if (user.role === "admin") return await ctx.storage.getUrl(args.storageId);
    // Members may only read their own picture.
    const email = user.email ?? null;
    if (!email) return null;
    const member = await ctx.db
      .query("members")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .first();
    if (member && member.profilePicStorageId === args.storageId) {
      return await ctx.storage.getUrl(args.storageId);
    }
    return null;
  },
});
