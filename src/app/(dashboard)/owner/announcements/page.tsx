/**
 * Phase 56: Owner announcements route.
 * Thin delegation — role auth + fetch + render live in <AnnouncementsPage>.
 */

import { AnnouncementsPage } from "@/components/announcements/AnnouncementsPage";

export default async function OwnerAnnouncementsPage() {
  return <AnnouncementsPage role="owner" />;
}
