/**
 * Phase 56: Shared types for the announcements feature.
 *
 * This file is the source of truth for the client-facing Announcement shape.
 * The server API (/api/announcements) returns rows in exactly this shape —
 * keep this file in lockstep with the `toAnnouncementPayload` helper in
 * src/app/api/announcements/route.ts. Client components import from here;
 * the server route handlers redeclare the shape inline because route files
 * cannot export non-HTTP-verb symbols (Next.js constraint).
 *
 * Safe to import from both client and server components — no server-only deps.
 */

export type AnnouncementAuthor = {
  id: string;
  name: string;
  role: "owner" | "coach";
};

export type Announcement = {
  id: string;
  author_id: string;
  content: string;
  created_at: string;   // ISO 8601 from Postgres timestamptz
  updated_at: string;   // ISO 8601 from Postgres timestamptz
  is_edited: boolean;   // server-computed: updated_at - created_at > 2000ms (D-56-07)
  author: AnnouncementAuthor | null;
};

/**
 * The four roles that can view the /announcements page.
 * Owner + coach see create/edit/delete controls; student + student_diy are
 * read-only (D-56-12).
 */
export type AnnouncementsPageRole = "owner" | "coach" | "student" | "student_diy";
