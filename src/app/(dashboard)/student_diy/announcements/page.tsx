/**
 * Phase 56: Student_diy announcements route (ANNOUNCE-06 — same feed as students).
 * Thin delegation — role auth + fetch + render live in <AnnouncementsPage>.
 */

import { AnnouncementsPage } from "@/components/announcements/AnnouncementsPage";

export default async function StudentDIYAnnouncementsPage() {
  return <AnnouncementsPage role="student_diy" />;
}
