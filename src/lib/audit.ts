import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import type { SessionUser } from "./session";

type LogInput = {
  actor: Pick<SessionUser, "id" | "name"> | null;
  action: "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "LOGIN" | "SETTINGS";
  entity: string;
  entityId?: number | null;
  before?: unknown;
  after?: unknown;
};

/**
 * Setiap perubahan angka dicatat. Baris audit tidak pernah di-update atau
 * dihapus — itu inti gunanya: kalau saldo berubah, harus selalu bisa dijawab
 * siapa yang mengubah dan kapan.
 */
export async function logAudit({
  actor,
  action,
  entity,
  entityId = null,
  before,
  after,
}: LogInput) {
  await db.insert(auditLogs).values({
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? "sistem",
    action,
    entity,
    entityId,
    beforeJson: before === undefined ? null : JSON.stringify(before),
    afterJson: after === undefined ? null : JSON.stringify(after),
  });
}

export async function getAuditTrail(entity: string, entityId: number) {
  return db.query.auditLogs.findMany({
    where: (t, { and, eq: e }) => and(e(t.entity, entity), e(t.entityId, entityId)),
    orderBy: [desc(auditLogs.at)],
  });
}

export async function getRecentAudit(limit = 50) {
  return db.query.auditLogs.findMany({
    orderBy: [desc(auditLogs.at)],
    limit,
  });
}

export async function getLoginHistory(limit = 20) {
  return db.query.auditLogs.findMany({
    where: eq(auditLogs.action, "LOGIN"),
    orderBy: [desc(auditLogs.at)],
    limit,
  });
}
