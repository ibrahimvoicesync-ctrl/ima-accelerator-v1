# Deferred Items — Phase 06

## Pre-existing lint errors (out of scope for 06-02)

**File:** `src/app/(dashboard)/coach/page.tsx`

Lines 97 and 126 use `Date.now()` which triggers `react-hooks/purity` lint error. This is a false positive for async server components, but the ESLint rule does not distinguish. These errors exist before phase 06-02 execution and are not caused by 06-02 changes.

**Fix:** Add `// eslint-disable-next-line react-hooks/purity -- async server component` comments to both lines in `coach/page.tsx`.

**Priority:** Low — does not affect runtime or type safety.
