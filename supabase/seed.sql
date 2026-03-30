-- ============================================================================
-- IMA Accelerator V1 — Seed Data
-- Deterministic UUIDs for predictable testing.
-- ALL auth_id values are NULL — linked post-OAuth by email match.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Users (1 owner, 2 coaches, 5 students)
-- ---------------------------------------------------------------------------

INSERT INTO public.users (id, auth_id, email, name, role, coach_id, niche, status, joined_at, created_at, updated_at)
VALUES
  -- Owner
  ('00000000-0000-0000-0000-000000000001', NULL, 'ibrahim@inityx.org', 'Ibrahim', 'owner', NULL, NULL, 'active',
   NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days'),

  -- Coaches
  ('00000000-0000-0000-0000-000000000002', NULL, 'coach1@ima.test', 'Sarah Ahmed', 'coach', NULL, NULL, 'active',
   NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days'),
  ('00000000-0000-0000-0000-000000000003', NULL, 'coach2@ima.test', 'Omar Hassan', 'coach', NULL, NULL, 'active',
   NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days'),

  -- Students assigned to coach1 (Sarah Ahmed — 3 students)
  ('00000000-0000-0000-0000-000000000004', NULL, 'amira@ima.test', 'Amira Malik', 'student',
   '00000000-0000-0000-0000-000000000002', 'fitness', 'active',
   NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
  ('00000000-0000-0000-0000-000000000005', NULL, 'yusuf@ima.test', 'Yusuf Ibrahim', 'student',
   '00000000-0000-0000-0000-000000000002', 'tech', 'active',
   NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0000-000000000006', NULL, 'layla@ima.test', 'Layla Osman', 'student',
   '00000000-0000-0000-0000-000000000002', 'lifestyle', 'inactive',
   NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days'),

  -- Students assigned to coach2 (Omar Hassan — 2 students)
  ('00000000-0000-0000-0000-000000000007', NULL, 'tariq@ima.test', 'Tariq Ali', 'student',
   '00000000-0000-0000-0000-000000000003', 'beauty', 'active',
   NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
  ('00000000-0000-0000-0000-000000000008', NULL, 'nadia@ima.test', 'Nadia Farouk', 'student',
   '00000000-0000-0000-0000-000000000003', 'finance', 'active',
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days');

-- ---------------------------------------------------------------------------
-- Invites (1 used, 1 unused)
-- ---------------------------------------------------------------------------

INSERT INTO public.invites (id, email, role, invited_by, coach_id, code, used, expires_at, created_at)
VALUES
  -- Used invite (student, invited by owner, assigned to coach1)
  ('00000000-0000-0000-0000-000000000010', 'used-student@ima.test', 'student',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000002',
   'INVITE-USED-001', true,
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '10 days'),

  -- Active unused invite (student, invited by owner, expires in 48 hours)
  ('00000000-0000-0000-0000-000000000011', 'new-student@ima.test', 'student',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000002',
   'INVITE-OPEN-002', false,
   NOW() + INTERVAL '48 hours', NOW() - INTERVAL '1 day');

-- ---------------------------------------------------------------------------
-- Magic Links (1 active, created by owner, role student)
-- ---------------------------------------------------------------------------

INSERT INTO public.magic_links (id, code, role, created_by, expires_at, max_uses, use_count, is_active, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000020', 'MAGIC-LINK-STUDENT-001', 'student',
   '00000000-0000-0000-0000-000000000001',
   NOW() + INTERVAL '7 days', 10, 2, true,
   NOW() - INTERVAL '3 days');

-- ---------------------------------------------------------------------------
-- Work Sessions
-- Students 004, 005, 006 have sessions today; 007, 008 have sessions from yesterday
-- Mix of cycle numbers 1-3, mix of statuses
-- ---------------------------------------------------------------------------

INSERT INTO public.work_sessions (id, student_id, date, cycle_number, session_minutes, started_at, completed_at, duration_minutes, status, created_at)
VALUES
  -- Amira (004) — today, cycle 1 completed
  ('00000000-0000-0000-0000-000000000030',
   '00000000-0000-0000-0000-000000000004',
   CURRENT_DATE, 1, 45,
   NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 15 minutes', 45, 'completed',
   NOW() - INTERVAL '3 hours'),

  -- Amira (004) — today, cycle 2 in progress
  ('00000000-0000-0000-0000-000000000031',
   '00000000-0000-0000-0000-000000000004',
   CURRENT_DATE, 2, 45,
   NOW() - INTERVAL '1 hour', NULL, 0, 'in_progress',
   NOW() - INTERVAL '1 hour'),

  -- Yusuf (005) — today, cycle 1 completed
  ('00000000-0000-0000-0000-000000000032',
   '00000000-0000-0000-0000-000000000005',
   CURRENT_DATE, 1, 45,
   NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours 15 minutes', 45, 'completed',
   NOW() - INTERVAL '4 hours'),

  -- Yusuf (005) — today, cycle 2 completed
  ('00000000-0000-0000-0000-000000000033',
   '00000000-0000-0000-0000-000000000005',
   CURRENT_DATE, 2, 45,
   NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 15 minutes', 45, 'completed',
   NOW() - INTERVAL '2 hours'),

  -- Yusuf (005) — today, cycle 3 abandoned
  ('00000000-0000-0000-0000-000000000034',
   '00000000-0000-0000-0000-000000000005',
   CURRENT_DATE, 3, 30,
   NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '15 minutes', 15, 'abandoned',
   NOW() - INTERVAL '30 minutes'),

  -- Layla (006) — today, cycle 1 completed
  ('00000000-0000-0000-0000-000000000035',
   '00000000-0000-0000-0000-000000000006',
   CURRENT_DATE, 1, 45,
   NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours 15 minutes', 45, 'completed',
   NOW() - INTERVAL '5 hours'),

  -- Tariq (007) — yesterday, cycle 1 completed
  ('00000000-0000-0000-0000-000000000036',
   '00000000-0000-0000-0000-000000000007',
   CURRENT_DATE - 1, 1, 45,
   NOW() - INTERVAL '26 hours', NOW() - INTERVAL '25 hours 15 minutes', 45, 'completed',
   NOW() - INTERVAL '26 hours'),

  -- Tariq (007) — yesterday, cycle 2 completed
  ('00000000-0000-0000-0000-000000000037',
   '00000000-0000-0000-0000-000000000007',
   CURRENT_DATE - 1, 2, 45,
   NOW() - INTERVAL '24 hours', NOW() - INTERVAL '23 hours 15 minutes', 45, 'completed',
   NOW() - INTERVAL '24 hours'),

  -- Nadia (008) — yesterday, cycle 1 completed
  ('00000000-0000-0000-0000-000000000038',
   '00000000-0000-0000-0000-000000000008',
   CURRENT_DATE - 1, 1, 45,
   NOW() - INTERVAL '27 hours', NOW() - INTERVAL '26 hours 15 minutes', 45, 'completed',
   NOW() - INTERVAL '27 hours');

-- ---------------------------------------------------------------------------
-- Roadmap Progress
-- Student 1 (Amira/004) at step 5
-- Student 2 (Yusuf/005) at step 3
-- Student 3 (Layla/006) at step 7
-- Student 4 (Tariq/007) at step 2
-- Student 5 (Nadia/008) at step 4
-- Step 1 completed for all; earlier steps completed, current active, later locked
-- ---------------------------------------------------------------------------

-- Step names for the roadmap (15 steps, 3 stages)
-- Stage 1: Setup & Preparation
--   1: Join the Course, 2: Finish Welcome Chapter, 3: Select Niche Chapter,
--   4: Set Up Your Agency, 5: Begin 14 Day Warmup,
--   6: Build 100 Influencer Lead List, 7: Watch 3 Roast My Email Calls + Draft First Outreach Emails
-- Stage 2: Influencer Outreach
--   8: Send Your First Email, 9: Get First Reply,
--   10: Close First Influencer, 11: Close 5 Influencers
-- Stage 3: Brand Outreach
--   12: Enter Brand Outreach, 13: Get Brand Response,
--   14: Receive Your First Brand Rejection, 15: Close First Deal

-- Amira (004) — at step 5: steps 1-4 completed, step 5 active, 6-15 locked
INSERT INTO public.roadmap_progress (id, student_id, step_number, step_name, status, completed_at, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000004', 1, 'Join the Course', 'completed', NOW() - INTERVAL '40 days', NOW() - INTERVAL '45 days', NOW() - INTERVAL '40 days'),
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000004', 2, 'Finish Welcome Chapter', 'completed', NOW() - INTERVAL '35 days', NOW() - INTERVAL '45 days', NOW() - INTERVAL '35 days'),
  ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000004', 3, 'Select Niche Chapter', 'completed', NOW() - INTERVAL '28 days', NOW() - INTERVAL '45 days', NOW() - INTERVAL '28 days'),
  ('00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000004', 4, 'Set Up Your Agency', 'completed', NOW() - INTERVAL '14 days', NOW() - INTERVAL '45 days', NOW() - INTERVAL '14 days'),
  ('00000000-0000-0000-0000-000000000044', '00000000-0000-0000-0000-000000000004', 5, 'Begin 14 Day Warmup', 'active', NULL, NOW() - INTERVAL '45 days', NOW() - INTERVAL '7 days'),
  ('00000000-0000-0000-0000-000000000045', '00000000-0000-0000-0000-000000000004', 6, 'Build 100 Influencer Lead List', 'locked', NULL, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
  ('00000000-0000-0000-0000-000000000046', '00000000-0000-0000-0000-000000000004', 7, 'Watch 3 Roast My Email Calls + Draft First Outreach Emails', 'locked', NULL, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
  ('00000000-0000-0000-0000-000000000047', '00000000-0000-0000-0000-000000000004', 8, 'Send Your First Email', 'locked', NULL, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
  ('00000000-0000-0000-0000-000000000048', '00000000-0000-0000-0000-000000000004', 9, 'Get First Reply', 'locked', NULL, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
  ('00000000-0000-0000-0000-000000000049', '00000000-0000-0000-0000-000000000004', 10, 'Close First Influencer', 'locked', NULL, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
  ('00000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-000000000004', 11, 'Close 5 Influencers', 'locked', NULL, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000004', 12, 'Enter Brand Outreach', 'locked', NULL, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000004', 13, 'Get Brand Response', 'locked', NULL, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000004', 14, 'Receive Your First Brand Rejection', 'locked', NULL, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000004', 15, 'Close First Deal', 'locked', NULL, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days');

-- Yusuf (005) — at step 3: steps 1-2 completed, step 3 active, 4-15 locked
INSERT INTO public.roadmap_progress (id, student_id, step_number, step_name, status, completed_at, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000005', 1, 'Join the Course', 'completed', NOW() - INTERVAL '25 days', NOW() - INTERVAL '30 days', NOW() - INTERVAL '25 days'),
  ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000005', 2, 'Finish Welcome Chapter', 'completed', NOW() - INTERVAL '18 days', NOW() - INTERVAL '30 days', NOW() - INTERVAL '18 days'),
  ('00000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000005', 3, 'Select Niche Chapter', 'active', NULL, NOW() - INTERVAL '30 days', NOW() - INTERVAL '10 days'),
  ('00000000-0000-0000-0000-000000000053', '00000000-0000-0000-0000-000000000005', 4, 'Set Up Your Agency', 'locked', NULL, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0000-000000000054', '00000000-0000-0000-0000-000000000005', 5, 'Begin 14 Day Warmup', 'locked', NULL, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0000-000000000055', '00000000-0000-0000-0000-000000000005', 6, 'Build 100 Influencer Lead List', 'locked', NULL, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0000-000000000056', '00000000-0000-0000-0000-000000000005', 7, 'Watch 3 Roast My Email Calls + Draft First Outreach Emails', 'locked', NULL, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0000-000000000057', '00000000-0000-0000-0000-000000000005', 8, 'Send Your First Email', 'locked', NULL, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0000-000000000058', '00000000-0000-0000-0000-000000000005', 9, 'Get First Reply', 'locked', NULL, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0000-000000000059', '00000000-0000-0000-0000-000000000005', 10, 'Close First Influencer', 'locked', NULL, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000005', 11, 'Close 5 Influencers', 'locked', NULL, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000005', 12, 'Enter Brand Outreach', 'locked', NULL, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-000000000005', 13, 'Get Brand Response', 'locked', NULL, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-000000000005', 14, 'Receive Your First Brand Rejection', 'locked', NULL, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-000000000005', 15, 'Close First Deal', 'locked', NULL, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days');

-- Layla (006) — at step 7: steps 1-6 completed, step 7 active, 8-15 locked
INSERT INTO public.roadmap_progress (id, student_id, step_number, step_name, status, completed_at, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000060', '00000000-0000-0000-0000-000000000006', 1, 'Join the Course', 'completed', NOW() - INTERVAL '19 days', NOW() - INTERVAL '21 days', NOW() - INTERVAL '19 days'),
  ('00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000006', 2, 'Finish Welcome Chapter', 'completed', NOW() - INTERVAL '17 days', NOW() - INTERVAL '21 days', NOW() - INTERVAL '17 days'),
  ('00000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000006', 3, 'Select Niche Chapter', 'completed', NOW() - INTERVAL '14 days', NOW() - INTERVAL '21 days', NOW() - INTERVAL '14 days'),
  ('00000000-0000-0000-0000-000000000063', '00000000-0000-0000-0000-000000000006', 4, 'Set Up Your Agency', 'completed', NOW() - INTERVAL '11 days', NOW() - INTERVAL '21 days', NOW() - INTERVAL '11 days'),
  ('00000000-0000-0000-0000-000000000064', '00000000-0000-0000-0000-000000000006', 5, 'Begin 14 Day Warmup', 'completed', NOW() - INTERVAL '8 days', NOW() - INTERVAL '21 days', NOW() - INTERVAL '8 days'),
  ('00000000-0000-0000-0000-000000000065', '00000000-0000-0000-0000-000000000006', 6, 'Build 100 Influencer Lead List', 'completed', NOW() - INTERVAL '4 days', NOW() - INTERVAL '21 days', NOW() - INTERVAL '4 days'),
  ('00000000-0000-0000-0000-000000000066', '00000000-0000-0000-0000-000000000006', 7, 'Watch 3 Roast My Email Calls + Draft First Outreach Emails', 'active', NULL, NOW() - INTERVAL '21 days', NOW() - INTERVAL '2 days'),
  ('00000000-0000-0000-0000-000000000067', '00000000-0000-0000-0000-000000000006', 8, 'Send Your First Email', 'locked', NULL, NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days'),
  ('00000000-0000-0000-0000-000000000068', '00000000-0000-0000-0000-000000000006', 9, 'Get First Reply', 'locked', NULL, NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days'),
  ('00000000-0000-0000-0000-000000000069', '00000000-0000-0000-0000-000000000006', 10, 'Close First Influencer', 'locked', NULL, NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days'),
  ('00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-000000000006', 11, 'Close 5 Influencers', 'locked', NULL, NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000006', 12, 'Enter Brand Outreach', 'locked', NULL, NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000006', 13, 'Get Brand Response', 'locked', NULL, NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-000000000006', 14, 'Receive Your First Brand Rejection', 'locked', NULL, NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days'),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000006', 15, 'Close First Deal', 'locked', NULL, NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days');

-- Tariq (007) — at step 2: step 1 completed, step 2 active, 3-15 locked
INSERT INTO public.roadmap_progress (id, student_id, step_number, step_name, status, completed_at, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000070', '00000000-0000-0000-0000-000000000007', 1, 'Join the Course', 'completed', NOW() - INTERVAL '15 days', NOW() - INTERVAL '20 days', NOW() - INTERVAL '15 days'),
  ('00000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-000000000007', 2, 'Finish Welcome Chapter', 'active', NULL, NOW() - INTERVAL '20 days', NOW() - INTERVAL '12 days'),
  ('00000000-0000-0000-0000-000000000072', '00000000-0000-0000-0000-000000000007', 3, 'Select Niche Chapter', 'locked', NULL, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
  ('00000000-0000-0000-0000-000000000073', '00000000-0000-0000-0000-000000000007', 4, 'Set Up Your Agency', 'locked', NULL, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
  ('00000000-0000-0000-0000-000000000074', '00000000-0000-0000-0000-000000000007', 5, 'Begin 14 Day Warmup', 'locked', NULL, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
  ('00000000-0000-0000-0000-000000000075', '00000000-0000-0000-0000-000000000007', 6, 'Build 100 Influencer Lead List', 'locked', NULL, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
  ('00000000-0000-0000-0000-000000000076', '00000000-0000-0000-0000-000000000007', 7, 'Watch 3 Roast My Email Calls + Draft First Outreach Emails', 'locked', NULL, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
  ('00000000-0000-0000-0000-000000000077', '00000000-0000-0000-0000-000000000007', 8, 'Send Your First Email', 'locked', NULL, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
  ('00000000-0000-0000-0000-000000000078', '00000000-0000-0000-0000-000000000007', 9, 'Get First Reply', 'locked', NULL, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
  ('00000000-0000-0000-0000-000000000079', '00000000-0000-0000-0000-000000000007', 10, 'Close First Influencer', 'locked', NULL, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
  ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000007', 11, 'Close 5 Influencers', 'locked', NULL, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
  ('00000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-000000000007', 12, 'Enter Brand Outreach', 'locked', NULL, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
  ('00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000007', 13, 'Get Brand Response', 'locked', NULL, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
  ('00000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-000000000007', 14, 'Receive Your First Brand Rejection', 'locked', NULL, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
  ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000007', 15, 'Close First Deal', 'locked', NULL, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days');

-- Nadia (008) — at step 4: steps 1-3 completed, step 4 active, 5-15 locked
INSERT INTO public.roadmap_progress (id, student_id, step_number, step_name, status, completed_at, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000080', '00000000-0000-0000-0000-000000000008', 1, 'Join the Course', 'completed', NOW() - INTERVAL '12 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days'),
  ('00000000-0000-0000-0000-000000000081', '00000000-0000-0000-0000-000000000008', 2, 'Finish Welcome Chapter', 'completed', NOW() - INTERVAL '9 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '9 days'),
  ('00000000-0000-0000-0000-000000000082', '00000000-0000-0000-0000-000000000008', 3, 'Select Niche Chapter', 'completed', NOW() - INTERVAL '5 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '5 days'),
  ('00000000-0000-0000-0000-000000000083', '00000000-0000-0000-0000-000000000008', 4, 'Set Up Your Agency', 'active', NULL, NOW() - INTERVAL '14 days', NOW() - INTERVAL '3 days'),
  ('00000000-0000-0000-0000-000000000084', '00000000-0000-0000-0000-000000000008', 5, 'Begin 14 Day Warmup', 'locked', NULL, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
  ('00000000-0000-0000-0000-000000000085', '00000000-0000-0000-0000-000000000008', 6, 'Build 100 Influencer Lead List', 'locked', NULL, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
  ('00000000-0000-0000-0000-000000000086', '00000000-0000-0000-0000-000000000008', 7, 'Watch 3 Roast My Email Calls + Draft First Outreach Emails', 'locked', NULL, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
  ('00000000-0000-0000-0000-000000000087', '00000000-0000-0000-0000-000000000008', 8, 'Send Your First Email', 'locked', NULL, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
  ('00000000-0000-0000-0000-000000000088', '00000000-0000-0000-0000-000000000008', 9, 'Get First Reply', 'locked', NULL, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
  ('00000000-0000-0000-0000-000000000089', '00000000-0000-0000-0000-000000000008', 10, 'Close First Influencer', 'locked', NULL, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-000000000008', 11, 'Close 5 Influencers', 'locked', NULL, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000008', 12, 'Enter Brand Outreach', 'locked', NULL, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000008', 13, 'Get Brand Response', 'locked', NULL, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000008', 14, 'Receive Your First Brand Rejection', 'locked', NULL, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-000000000008', 15, 'Close First Deal', 'locked', NULL, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days');

-- ---------------------------------------------------------------------------
-- Daily Reports
-- 3 students have submitted today (Amira 004, Yusuf 005, Tariq 007)
-- 1 student report reviewed by coach1 (Amira's report reviewed by Sarah)
-- Plus reports from previous 3 days for variety
-- ---------------------------------------------------------------------------

INSERT INTO public.daily_reports (id, student_id, date, hours_worked, star_rating, outreach_count, wins, improvements, submitted_at, reviewed_by, reviewed_at, created_at)
VALUES
  -- Today's reports

  -- Amira (004) — today, submitted and reviewed by coach1 (Sarah/002)
  ('00000000-0000-0000-0000-000000000090',
   '00000000-0000-0000-0000-000000000004',
   CURRENT_DATE, 6.5, 4, 8,
   'Sent 8 outreach messages to fitness brands. Got 2 positive replies.',
   'Need to improve follow-up timing — some brands replied after 3 days.',
   NOW() - INTERVAL '4 hours',
   '00000000-0000-0000-0000-000000000002',
   NOW() - INTERVAL '2 hours',
   NOW() - INTERVAL '5 hours'),

  -- Yusuf (005) — today, submitted, not yet reviewed
  ('00000000-0000-0000-0000-000000000091',
   '00000000-0000-0000-0000-000000000005',
   CURRENT_DATE, 7.0, 5, 12,
   'Completed outreach scripts for 3 tech brands. Started first contact campaign.',
   'Scripts could be more personalized per brand.',
   NOW() - INTERVAL '2 hours',
   NULL, NULL,
   NOW() - INTERVAL '3 hours'),

  -- Tariq (007) — today, submitted, not yet reviewed
  ('00000000-0000-0000-0000-000000000092',
   '00000000-0000-0000-0000-000000000007',
   CURRENT_DATE, 4.0, 3, 5,
   'Research on beauty brand market. Found 5 potential partners.',
   'Spent too much time on research, not enough on outreach.',
   NOW() - INTERVAL '1 hour',
   NULL, NULL,
   NOW() - INTERVAL '2 hours'),

  -- Yesterday's reports

  -- Amira (004) — yesterday
  ('00000000-0000-0000-0000-000000000093',
   '00000000-0000-0000-0000-000000000004',
   CURRENT_DATE - 1, 6.0, 4, 7,
   'Followed up on 5 previous outreach messages. Got 1 meeting scheduled.',
   'Need to be more consistent with daily message count.',
   NOW() - INTERVAL '1 day 4 hours',
   '00000000-0000-0000-0000-000000000002',
   NOW() - INTERVAL '1 day 2 hours',
   NOW() - INTERVAL '1 day 5 hours'),

  -- Layla (006) — yesterday
  ('00000000-0000-0000-0000-000000000094',
   '00000000-0000-0000-0000-000000000006',
   CURRENT_DATE - 1, 8.0, 5, 15,
   'Closed first deal with a lifestyle brand! 3-post collaboration at AED 2,500.',
   'Need to improve contract review process.',
   NOW() - INTERVAL '1 day 3 hours',
   NULL, NULL,
   NOW() - INTERVAL '1 day 4 hours'),

  -- Nadia (008) — yesterday
  ('00000000-0000-0000-0000-000000000095',
   '00000000-0000-0000-0000-000000000008',
   CURRENT_DATE - 1, 5.0, 3, 6,
   'Completed outreach scripts module. Ready to start first contacts.',
   'Struggled with script personalization — need more examples.',
   NOW() - INTERVAL '1 day 5 hours',
   NULL, NULL,
   NOW() - INTERVAL '1 day 6 hours'),

  -- 2 days ago

  -- Yusuf (005) — 2 days ago
  ('00000000-0000-0000-0000-000000000096',
   '00000000-0000-0000-0000-000000000005',
   CURRENT_DATE - 2, 6.5, 4, 10,
   'Refined outreach script templates. Got feedback from coach.',
   'Need to work on value proposition clarity.',
   NOW() - INTERVAL '2 days 3 hours',
   NULL, NULL,
   NOW() - INTERVAL '2 days 4 hours'),

  -- Tariq (007) — 2 days ago
  ('00000000-0000-0000-0000-000000000097',
   '00000000-0000-0000-0000-000000000007',
   CURRENT_DATE - 2, 3.5, 2, 3,
   'Started brand research phase.',
   'Need to be more focused — got distracted today.',
   NOW() - INTERVAL '2 days 4 hours',
   NULL, NULL,
   NOW() - INTERVAL '2 days 5 hours'),

  -- 3 days ago

  -- Amira (004) — 3 days ago
  ('00000000-0000-0000-0000-000000000098',
   '00000000-0000-0000-0000-000000000004',
   CURRENT_DATE - 3, 7.0, 5, 10,
   'Best day yet! 10 outreach messages, 3 positive replies.',
   'Continue current pace.',
   NOW() - INTERVAL '3 days 3 hours',
   '00000000-0000-0000-0000-000000000002',
   NOW() - INTERVAL '3 days 1 hour',
   NOW() - INTERVAL '3 days 4 hours'),

  -- Layla (006) — 3 days ago
  ('00000000-0000-0000-0000-000000000099',
   '00000000-0000-0000-0000-000000000006',
   CURRENT_DATE - 3, 7.5, 5, 14,
   'Entered negotiations phase with 2 brands. Strong momentum.',
   'Price negotiations could be handled more confidently.',
   NOW() - INTERVAL '3 days 4 hours',
   NULL, NULL,
   NOW() - INTERVAL '3 days 5 hours');
