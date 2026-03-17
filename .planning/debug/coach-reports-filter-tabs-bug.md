---
status: investigating
trigger: "Report filter tabs on /coach/reports are broken. An unreviewed report appears in both the Unreviewed and Reviewed tabs."
created: 2026-03-17T00:00:00Z
updated: 2026-03-17T00:00:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: localReports state in CoachReportsClient is initialized from the `reports` prop once at mount. When the user toggles a report's review status via handleToggleReview, the local state is updated (reviewed_by/reviewed_at fields) but React state is NOT re-initialized when the parent server component re-renders with new filtered props — because useState only runs its initializer once. The real bug is different: the filter is server-side, but localReports is a client-side copy. When a user toggles and stays on the same filter tab without navigation, the mutated report can appear in both tabs due to the stale prop → localReports divergence if the page re-navigates.

CONFIRMED hypothesis: The actual root cause is in handleToggleReview. After a successful PATCH, the code updates localReports in place with the new reviewed_by/reviewed_at values — but it does NOT remove the report from the current filtered view. When the page is currently showing the "Reviewed" tab (sp.reviewed === "true"), the server passed only reviewed reports. If a user marks one as unreviewed, localReports still contains it (now with reviewed_by = null) — it still shows. Conversely if on the "Unreviewed" tab and a report is marked reviewed it still shows. That is one symptom but not the "appears in both tabs" symptom.

REVISED hypothesis (confirmed): The real path to "appears in both tabs" is: after toggling review status, the router navigates (handleFilterTab calls router.push), causing a full server re-render. The server fetches fresh data. But useState(reports) does NOT re-initialize from the new prop — it holds the OLD localReports value. So localReports contains stale data that doesn't match the current filter, causing a report to appear in the wrong tab.

test: Trace the data flow — server filters → prop → useState → render
expecting: useState(reports) on line 46 only initializes once; subsequent prop changes from navigation are ignored
next_action: confirmed — write up root cause

## Symptoms

expected: Unreviewed tab shows only unreviewed reports; Reviewed tab shows only reviewed reports
actual: An unreviewed report appears in both the Unreviewed and Reviewed tabs
errors: none (visual/logic bug)
reproduction: Navigate to /coach/reports?reviewed=true (Reviewed tab) — unreviewed report appears
started: unknown

## Eliminated

- hypothesis: Server-side filter logic is broken
  evidence: page.tsx lines 101-105 correctly filter allReports by reviewed_by === null (false) and reviewed_by !== null (true). Logic is correct.
  timestamp: 2026-03-17T00:00:00Z

## Evidence

- timestamp: 2026-03-17T00:00:00Z
  checked: page.tsx lines 101-105 (server filter logic)
  found: Filter correctly uses reviewed_by === null for "false" and reviewed_by !== null for "true". Server-side filtering is correct.
  implication: Bug is not in server filter logic

- timestamp: 2026-03-17T00:00:00Z
  checked: CoachReportsClient.tsx line 46
  found: `const [localReports, setLocalReports] = useState(reports);` — initializes from prop once at mount
  implication: When the parent server component re-renders with a new filtered `reports` prop (after navigation), useState does NOT re-initialize. localReports holds the stale initial value.

- timestamp: 2026-03-17T00:00:00Z
  checked: CoachReportsClient.tsx lines 102-112 (handleToggleReview state update)
  found: On successful toggle, localReports is updated in-place (reviewed_by/reviewed_at changed) but the report is never removed from the list. The list always contains all reports that were in the initial prop.
  implication: If user is on Reviewed tab and marks one unreviewed, it stays visible (filter mismatch). If user then navigates to Unreviewed tab via router.push, server re-renders with the correct filtered set as the new `reports` prop — but useState ignores this new prop, keeping the stale toggled report in localReports.

- timestamp: 2026-03-17T00:00:00Z
  checked: CoachReportsClient.tsx line 46 re-examined in context of navigation
  found: Every time handleFilterTab calls router.push, Next.js re-renders the server page with new searchParams, producing a new filtered `reports` prop. However the CoachReportsClient component DOES unmount and remount on navigation (router.push causes a page navigation not just a re-render), so useState DOES reinitialize.
  implication: The stale-useState path is eliminated for navigation-triggered tab switches. The bug must be purely within a single page load.

- timestamp: 2026-03-17T00:00:00Z
  checked: Full flow re-read — how does a report end up in wrong tab without navigation?
  found: On page load with ?reviewed=true, the server filters to only reviewed reports and passes them as `reports` prop. localReports is initialized from that. handleToggleReview on a reviewed report sets reviewed_by to null in localReports. The report now has reviewed_by=null but is still in localReports (not removed). The tab UI still shows the Reviewed tab active (currentFilter="true" from prop, never changes client-side). The report appears in the Reviewed tab list even though its local state says unreviewed. If the user then clicks Unreviewed tab, router.push navigates → page re-renders server-side → localReports reinitializes from server data. So "both tabs" is not from navigation.

- timestamp: 2026-03-17T00:00:00Z
  checked: currentFilter prop — does it ever change without navigation?
  found: currentFilter comes from sp.reviewed via the server component and is passed as a static prop. It only changes when the URL changes (navigation). There is no client-side state for currentFilter.
  implication: The active tab indicator is always correct. The bug must be in localReports not being filtered client-side.

- timestamp: 2026-03-17T00:00:00Z
  checked: Does localReports ever get re-initialized after navigation?
  found: router.push is a client-side navigation. In Next.js App Router, client components that are already mounted receive new props from the server component re-render WITHOUT unmounting/remounting. So useState(reports) does NOT reinitialize — the initial value is only used on first mount. Subsequent prop changes to `reports` are ignored by useState.
  implication: THIS IS THE ROOT CAUSE. After navigating between tabs (router.push), the server passes a freshly filtered `reports` prop, but localReports stays at the stale previous value because useState only initializes once. The displayed list is always the list from the initial mount, regardless of tab.

## Resolution

root_cause: |
  CoachReportsClient.tsx line 46: `const [localReports, setLocalReports] = useState(reports);`

  useState only initializes from its argument on the FIRST render (component mount). In Next.js App Router, client-side navigation via router.push causes the server component to re-render and pass a new filtered `reports` prop to CoachReportsClient — but since the component does NOT unmount/remount on client navigation, useState ignores the new prop. localReports forever holds the value from initial mount.

  Result: No matter which filter tab the user clicks, the rendered list is always the reports from whichever filter was active when the page first loaded (or when the component first mounted). An unreviewed report from an initial "All" or "Unreviewed" load will still appear when the user switches to "Reviewed" because localReports was never updated to reflect the new filtered prop.

fix: |
  Replace useState with a useEffect (or useSyncExternalStore, but useEffect is simpler) that resets localReports whenever the reports prop changes:

  Option A — useEffect sync:
    const [localReports, setLocalReports] = useState(reports);
    useEffect(() => { setLocalReports(reports); }, [reports]);

  Option B (cleaner) — derive localReports directly from the prop and only maintain the delta (toggled items) in local state. This avoids the stale prop problem entirely.

  Option C — remove localReports state entirely and pass a stable key prop from the server to force remount on navigation (e.g., key={currentFilter + currentStudentId}).

  The simplest correct fix is Option A (two lines) or Option C (add key= to the component invocation in page.tsx).

files_changed: []
