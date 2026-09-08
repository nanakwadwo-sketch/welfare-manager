import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // ---- Welfare management tables (v1) ----

    // A member profile attached to a users record. Created by admin (single or bulk).
    members: defineTable({
      userId: v.optional(v.id("users")), // linked once the member signs in with this email
      email: v.string(),
      memberCode: v.string(), // human friendly unique code, e.g. WMS-0001
      fullName: v.string(),
      staffId: v.optional(v.string()), // employer staff ID
      phone: v.optional(v.string()),
      department: v.optional(v.string()),
      joinedAt: v.number(), // epoch ms
      status: v.union(
        v.literal("active"),
        v.literal("inactive"),
        v.literal("terminated"),
      ),
      totalContributed: v.number(), // cumulative GH¢ paid
    })
      .index("by_email", ["email"])
      .index("by_user", ["userId"])
      .index("by_code", ["memberCode"]),

    // Monthly dues payments recorded by admin (v1 keeps payment entry admin-side).
    duesPayments: defineTable({
      memberId: v.id("members"),
      amount: v.number(),
      periodMonth: v.string(), // "YYYY-MM"
      recordedAt: v.number(),
      note: v.optional(v.string()),
    }).index("by_member", ["memberId"]),

    // Configurable benefit packages. Seeded with the default GH¢ amounts.
    benefitPackages: defineTable({
      key: v.string(), // "death_parent" | "death_spouse" | "death_child" | "exit"
      label: v.string(),
      kind: v.union(v.literal("fixed"), v.literal("percent")),
      amount: v.number(), // fixed GH¢ value, or percent of total contribution
      percentOfContribution: v.optional(v.number()), // e.g. 70 for exit claims
      updatedAt: v.number(),
    }).index("by_key", ["key"]),

    // Claims filed by members, reviewed by admin.
    claims: defineTable({
      memberId: v.id("members"),
      benefitKey: v.string(),
      amount: v.number(), // computed at filing time from active packages
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("paid"),
      ),
      details: v.optional(v.string()),
      reviewedBy: v.optional(v.id("users")),
      reviewedAt: v.optional(v.number()),
      reviewNote: v.optional(v.string()),
      filedAt: v.number(),
    })
      .index("by_member", ["memberId"])
      .index("by_status", ["status"]),

    // Supporting documents attached to a claim (stored as data URLs for v1).
    claimDocuments: defineTable({
      claimId: v.id("claims"),
      name: v.string(),
      mimeType: v.string(),
      dataUrl: v.string(),
      uploadedAt: v.number(),
      uploadedBy: v.id("users"),
    }).index("by_claim", ["claimId"]),

    // System activity log surfaced as reports.
    activityLog: defineTable({
      actorId: v.optional(v.id("users")),
      actorName: v.optional(v.string()),
      action: v.string(),
      detail: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
