import { db } from "../../../db/src/index.js";
import { notificationsTable } from "../../../db/src/index.js";

export type NotifType =
  | "REGISTRATION"
  | "LEAVE_REQUEST"
  | "LATE_CHECKIN"
  | "LATE_JUSTIFICATION"
  | "EARLY_LEAVE"
  | "OVERTIME_DECISION"
  | "SYSTEM_ALERT"
  | "PAYROLL_AUTO_SENT"
  | "ANNOUNCEMENT"
  | "MONTHLY_REPORT_SENT";

/** Admin-visible global notification (userId = null) */
export async function createNotification(params: {
  type: NotifType;
  title: string;
  message: string;
  relatedId?: number;
  relatedType?: string;
}) {
  try {
    await db.insert(notificationsTable).values({
      type: params.type,
      title: params.title,
      message: params.message,
      relatedId: params.relatedId ?? null,
      relatedType: params.relatedType ?? null,
      status: "unread",
      userId: null,
    });
  } catch (err) {
    console.error("[notify] Failed to create notification:", err);
  }
}

/** Per-employee notification (userId = specific employee) */
export async function createNotificationForUser(params: {
  userId: number;
  type: NotifType;
  title: string;
  message: string;
  relatedId?: number;
  relatedType?: string;
}) {
  try {
    await db.insert(notificationsTable).values({
      type: params.type,
      title: params.title,
      message: params.message,
      relatedId: params.relatedId ?? null,
      relatedType: params.relatedType ?? null,
      status: "unread",
      userId: params.userId,
    });
  } catch (err) {
    console.error("[notify] Failed to create user notification:", err);
  }
}
