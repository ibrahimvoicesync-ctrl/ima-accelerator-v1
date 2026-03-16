---
phase: 04-student-roadmap
plan: "01"
subsystem: ui-primitives, api
tags: [ui, api, roadmap, primitives, cva]
dependency_graph:
  requires: []
  provides: [ui-primitives, patch-api-roadmap]
  affects: [04-02-roadmap-client]
tech_stack:
  added: []
  patterns: [CVA variants, forwardRef, createPortal, focus-trap, ToastContext, Zod safeParse]
key_files:
  created:
    - src/components/ui/Spinner.tsx
    - src/components/ui/Button.tsx
    - src/components/ui/Badge.tsx
    - src/components/ui/Modal.tsx
    - src/components/ui/Toast.tsx
    - src/components/ui/index.ts
    - src/app/api/roadmap/route.ts
  modified: []
decisions:
  - "UI primitives ported verbatim from reference-old — all ima-* tokens are V1-valid, no changes needed"
  - "PATCH /api/roadmap ported verbatim from reference-old — import paths match V1 lib structure exactly"
metrics:
  duration: 2 min
  completed_date: "2026-03-16"
  tasks_completed: 2
  files_created: 7
  files_modified: 0
---

# Phase 4 Plan 01: UI Primitives and PATCH /api/roadmap Summary

Ported 5 CVA-based UI primitive components from reference-old and created the PATCH /api/roadmap route for sequential roadmap step completion, all with V1 ima-* tokens and full TypeScript compliance.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Port UI primitives from reference-old | 155033f | Spinner, Button, Badge, Modal, Toast, index.ts |
| 2 | Create PATCH /api/roadmap route | 9562b82 | src/app/api/roadmap/route.ts |

## What Was Built

**UI Primitives (src/components/ui/):**
- `Spinner` — SVG spin animation with `motion-safe:animate-spin`, `role="status"`, `sr-only` label
- `Button` — CVA with primary/secondary/ghost/danger/outline variants, `forwardRef`, loading state shows Spinner, `aria-busy`
- `Badge` — CVA with default/success/warning/error/info/outline variants, no client directive needed
- `Modal` — `"use client"`, focus trap (Tab/Shift+Tab), Escape key close, `inert` on `#__next`, `createPortal` to `document.body`
- `Toast` — `"use client"`, `ToastContext`, `ToastProvider`, `useToast` hook, auto-dismiss 5s, max 5 toasts, ARIA live region
- `index.ts` — Barrel export for Button, buttonVariants, Badge, Modal, Spinner, ToastProvider, useToast

**API Route (src/app/api/roadmap/route.ts):**
- Auth guard → 401 if no session
- Profile lookup via admin client → 404 if missing
- Role guard: student-only → 403 for non-students
- JSON parse with try-catch → 400 on invalid JSON
- Zod `patchSchema.safeParse` → 400 on invalid step_number
- Step fetch by student_id + step_number → 404 if not found
- Status guard: `status !== "active"` → 400
- Marks step `completed` with `completed_at` timestamp
- Unlocks next step (`step_number + 1`) if not last step
- Outer try-catch with `console.error` — never swallows errors

## Verification

- `npx tsc --noEmit` — PASS (0 errors)
- `npm run build` — PASS (`/api/roadmap` listed as dynamic route)
- No reference-old tokens (ima-brand-gold, ima-border-warm, ima-surface-warm) — PASS
- All animate-* classes use motion-safe: prefix — PASS
- All interactive elements have min-h-[44px] touch targets — PASS

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files confirmed:
- src/components/ui/Spinner.tsx — FOUND
- src/components/ui/Button.tsx — FOUND
- src/components/ui/Badge.tsx — FOUND
- src/components/ui/Modal.tsx — FOUND
- src/components/ui/Toast.tsx — FOUND
- src/components/ui/index.ts — FOUND
- src/app/api/roadmap/route.ts — FOUND

Commits confirmed:
- 155033f — FOUND (feat(04-01): port UI primitives from reference-old)
- 9562b82 — FOUND (feat(04-01): create PATCH /api/roadmap route)
