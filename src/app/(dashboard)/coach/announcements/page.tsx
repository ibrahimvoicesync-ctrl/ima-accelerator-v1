/**
 * Phase 56: Coach announcements route.
 * Thin delegation — role auth + fetch + render live in <AnnouncementsPage>.
 */

import { AnnouncementsPage } from "@/components/announcements/AnnouncementsPage";

export default async function CoachAnnouncementsPage() {
  return <AnnouncementsPage role="coach" />;
}
