/**
 * Phase 56: Student announcements route (ANNOUNCE-05 — read-only feed).
 * Thin delegation — role auth + fetch + render live in <AnnouncementsPage>.
 */

import { AnnouncementsPage } from "@/components/announcements/AnnouncementsPage";

export default async function StudentAnnouncementsPage() {
  return <AnnouncementsPage role="student" />;
}
