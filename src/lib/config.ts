// ============================================================================
// IMA ACCELERATOR — V1 Platform Configuration
// Version: 1.0.0
// Stack: Next.js 16 + Supabase + Tailwind CSS + Google OAuth
// V1 ONLY — no leaderboard, tiers, player cards, streaks, focus mode, deals,
// analytics config, notification types, feature flags, rate limits, or DB schema
// ============================================================================

// ---------------------------------------------------------------------------
// 1. APP META
// ---------------------------------------------------------------------------
export const APP_CONFIG = {
  name: "IMA Accelerator",
  slug: "ima-accelerator",
  version: "1.0.0",
  description: "Student Performance & Coaching Management Platform",
  url: "https://ima-accelerator-v1.vercel.app",
  supportEmail: "support@imaccelerator.com",
  timezone: "UTC",
  locale: "en",
} as const;

// ---------------------------------------------------------------------------
// 2. ROLES
// ---------------------------------------------------------------------------
export const ROLES = {
  OWNER: "owner",
  COACH: "coach",
  STUDENT: "student",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 3,
  coach: 2,
  student: 1,
};

// ---------------------------------------------------------------------------
// 3. ROUTES (V1 only — no leaderboard, card, calls, settings)
// ---------------------------------------------------------------------------
export const ROUTES = {
  auth: {
    login: "/login",
    register: "/register",
    noAccess: "/no-access",
    callback: "/api/auth/callback",
  },
  owner: {
    dashboard: "/owner",
    coaches: "/owner/coaches",
    coachDetail: "/owner/coaches/[coachId]",
    students: "/owner/students",
    studentDetail: "/owner/students/[studentId]",
    invites: "/owner/invites",
    assignments: "/owner/assignments",
    alerts: "/owner/alerts",
  },
  coach: {
    dashboard: "/coach",
    students: "/coach/students",
    studentDetail: "/coach/students/[studentId]",
    invites: "/coach/invites",
    reports: "/coach/reports",
    analytics: "/coach/analytics",
  },
  student: {
    dashboard: "/student",
    workTracker: "/student/work",
    roadmap: "/student/roadmap",
    askAI: "/student/ask",
    report: "/student/report",
  },
  api: {
    auth: "/api/auth",
    callback: "/api/auth/callback",
  },
} as const;

export const ROLE_REDIRECTS: Record<Role, string> = {
  owner: ROUTES.owner.dashboard,
  coach: ROUTES.coach.dashboard,
  student: ROUTES.student.dashboard,
};

// ---------------------------------------------------------------------------
// 4. AUTH CONFIG
// ---------------------------------------------------------------------------
export const AUTH_CONFIG = {
  provider: "google" as const,
  inviteOnly: true,
  matchInviteByEmail: true,
  noAccessRedirect: "/no-access",
} as const;

// ---------------------------------------------------------------------------
// 5. WORK TRACKER CONFIG
// ---------------------------------------------------------------------------
export const WORK_TRACKER = {
  sessionMinutes: 45,
  breakMinutes: 15,
  cyclesPerDay: 4,
  dailyGoalHours: 4,
  abandonGraceSeconds: 300,
  sessionDurationOptions: [30, 45, 60] as const,
  defaultSessionMinutes: 45,
  breakOptions: {
    short: { label: "Short Break", presets: [5, 10] as const },
    long: { label: "Long Break", presets: [10, 15, 20, 30] as const },
  } as const,
} as const;

// ---------------------------------------------------------------------------
// 5.5 KPI TARGETS
// ---------------------------------------------------------------------------
export const KPI_TARGETS = {
  lifetimeOutreach: 2500,
  dailyOutreach: 50,
} as const;

// ---------------------------------------------------------------------------
// 6. ROADMAP MILESTONES (10 steps)
// target_days = cumulative days from student's joined_at date
// TODO: Confirm target_days values with Abu Lahya before Phase 18 ships
// ---------------------------------------------------------------------------
export const ROADMAP_STEPS = [
  { step: 1, title: "Join the Course", description: "Complete your onboarding and set up your profile", autoComplete: true, target_days: 1 },
  { step: 2, title: "Plan Your Work", description: "Set up your daily schedule and commit to 4 hours of focused work per day", target_days: 3 },
  { step: 3, title: "Pick Your Niche", description: "Choose the influencer niche you will focus on (fitness, lifestyle, tech, etc.)", target_days: 7 },
  { step: 4, title: "Build Your Website", description: "Create your agency website — your professional face to brands and influencers", target_days: 14 },
  { step: 5, title: "Send Your First Email", description: "Reach out to your first influencer with a personalized pitch", target_days: 21 },
  { step: 6, title: "Get Your First Response", description: "Receive a reply from an influencer — positive or negative, it counts", target_days: 28 },
  { step: 7, title: "Close Your First Influencer", description: "Sign your first influencer to your roster — you are officially an agent", target_days: 35 },
  { step: 8, title: "Close 5 Influencers", description: "Build your roster to 5 signed influencers ready for brand deals", target_days: 42 },
  { step: 9, title: "Brand Outreach", description: "Start pitching brands with your roster — send your first brand proposals", target_days: 49 },
  { step: 10, title: "Close Your First Brand Deal", description: "Negotiate and close your first paid brand deal — this is where it all pays off", target_days: 56 },
] as const;

// ---------------------------------------------------------------------------
// 7. DAILY REPORT CONFIG
// ---------------------------------------------------------------------------
export const DAILY_REPORT = {
  autoFillHours: true,
  ratingMin: 1,
  ratingMax: 5,
  fields: {
    starRating: { label: "Rate your day", required: true },
    outreachCount: { label: "How many influencers did you reach out to today?", required: true },
    wins: { label: "What went well today?", required: false, maxLength: 500 },
    improvements: { label: "What could you improve tomorrow?", required: false, maxLength: 500 },
  },
  deadlineHour: 23,
} as const;

// ---------------------------------------------------------------------------
// 8. COACH DASHBOARD CONFIG
// ---------------------------------------------------------------------------
export const COACH_CONFIG = {
  atRiskInactiveDays: 3,
  atRiskRatingThreshold: 2,
  maxStudentsPerCoach: 50,
  reportInboxDays: 7,
} as const;

// ---------------------------------------------------------------------------
// 9. OWNER DASHBOARD CONFIG
// ---------------------------------------------------------------------------
export const OWNER_CONFIG = {
  statCards: [
    { key: "total_students", label: "Total Students", icon: "GraduationCap" },
    { key: "total_coaches", label: "Total Coaches", icon: "Shield" },
    { key: "daily_active_students", label: "Active Today", icon: "Users" },
    { key: "reports_submitted_today", label: "Reports Today", icon: "FileText" },
  ],
  alertThresholds: {
    studentInactiveDays: 3,
    studentDropoffDays: 7,
    coachUnderperformingRating: 2.5,
    coachUnderperformingWindowDays: 14,
  },
} as const;

// ---------------------------------------------------------------------------
// 10. INVITE CONFIG
// ---------------------------------------------------------------------------
export const INVITE_CONFIG = {
  codeExpiryHours: 72,
  inviteRules: {
    owner: ["coach", "student"] as Role[],
    coach: ["student"] as Role[],
    student: [] as Role[],
  },
} as const;

// ---------------------------------------------------------------------------
// 11. AI ASSISTANT CONFIG
// ---------------------------------------------------------------------------
export const AI_CONFIG = {
  method: "iframe" as const,
  iframeUrl: "", // TODO: Get URL from Abu Lahya before ship
  title: "Ask Abu Lahya",
  subtitle: "Your 24/7 AI mentor",
} as const;

// ---------------------------------------------------------------------------
// 12. THEME
// ---------------------------------------------------------------------------
export const THEME = {
  mode: "light" as const,
  colors: {
    primary: "#2563EB",
    primaryHover: "#1D4ED8",
    background: "#F8FAFC",
    surface: "#FFFFFF",
    border: "#E2E8F0",
    text: "#1E293B",
    textSecondary: "#64748B",
  },
  fonts: {
    heading: "Inter, system-ui, sans-serif",
    body: "Inter, system-ui, sans-serif",
  },
} as const;

// ---------------------------------------------------------------------------
// 13. NAVIGATION — V1 with separators and badge support
// Locked decision from CONTEXT.md:
//   - Owner: Dashboard, Coaches, Students | Invites, Assignments, Alerts
//   - Coach: Dashboard, My Students, Reports | Invite Students, Analytics
//     (Reports has badge for unreviewed count)
//   - Student: Dashboard, Work Tracker, Roadmap, Ask Abu Lahya, Daily Report
//     (Ask Abu Lahya is 4th position, before Daily Report)
// ---------------------------------------------------------------------------
export type NavItem = {
  label: string;
  href: string;
  icon: string;
  separator?: boolean; // render divider BEFORE this item
  badge?: string;      // key for dynamic badge count
};

export const NAVIGATION: Record<Role, NavItem[]> = {
  owner: [
    { label: "Dashboard",   href: "/owner",             icon: "LayoutDashboard" },
    { label: "Coaches",     href: "/owner/coaches",     icon: "Shield" },
    { label: "Students",    href: "/owner/students",    icon: "Users" },
    { label: "Invites",     href: "/owner/invites",     icon: "UserPlus",      separator: true },
    { label: "Assignments", href: "/owner/assignments", icon: "ArrowLeftRight" },
    { label: "Alerts",      href: "/owner/alerts",      icon: "Bell",          badge: "active_alerts" },
  ],
  coach: [
    { label: "Dashboard",       href: "/coach",           icon: "LayoutDashboard" },
    { label: "My Students",     href: "/coach/students",  icon: "Users" },
    { label: "Reports",         href: "/coach/reports",   icon: "FileText",      badge: "unreviewed_reports" },
    { label: "Invite Students", href: "/coach/invites",   icon: "UserPlus",      separator: true },
    { label: "Analytics",       href: "/coach/analytics", icon: "BarChart3" },
  ],
  student: [
    { label: "Dashboard",     href: "/student",        icon: "LayoutDashboard" },
    { label: "Work Tracker",  href: "/student/work",   icon: "Timer" },
    { label: "Roadmap",       href: "/student/roadmap", icon: "Map" },
    { label: "Ask Abu Lahya", href: "/student/ask",    icon: "MessageSquare" },
    { label: "Daily Report",  href: "/student/report", icon: "FileText" },
  ],
};

// ---------------------------------------------------------------------------
// 14. VALIDATION
// ---------------------------------------------------------------------------
export const VALIDATION = {
  name: { min: 2, max: 100 },
  email: { max: 255 },
  niche: { max: 100 },
  reportWins: { max: 500 },
  reportImprovements: { max: 500 },
  outreachCount: { min: 0, max: 500 },
  outreachBrands: { min: 0, max: 500 },
  outreachInfluencers: { min: 0, max: 500 },
  brandsContacted: { min: 0, max: 500 },
  influencersContacted: { min: 0, max: 500 },
  callsJoined: { min: 0, max: 100 },
  starRating: { min: 1, max: 5 },
} as const;

// ---------------------------------------------------------------------------
// 15. DEFAULT EXPORT — aggregate all V1 configs
// ---------------------------------------------------------------------------
const config = {
  app: APP_CONFIG,
  auth: AUTH_CONFIG,
  roles: ROLES,
  routes: ROUTES,
  roleRedirects: ROLE_REDIRECTS,
  workTracker: WORK_TRACKER,
  kpiTargets: KPI_TARGETS,
  roadmap: ROADMAP_STEPS,
  dailyReport: DAILY_REPORT,
  coach: COACH_CONFIG,
  owner: OWNER_CONFIG,
  ai: AI_CONFIG,
  invites: INVITE_CONFIG,
  theme: THEME,
  navigation: NAVIGATION,
  validation: VALIDATION,
} as const;

export default config;
