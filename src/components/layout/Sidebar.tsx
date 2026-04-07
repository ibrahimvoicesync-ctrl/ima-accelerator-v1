"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  LayoutDashboard,
  Shield,
  Users,
  UserPlus,
  ArrowLeftRight,
  Bell,
  FileText,
  Timer,
  Map,
  BarChart3,
  MessageSquare,
  BookOpen,
  LogOut,
  Menu,
  X,
  GraduationCap,
  ChevronRight,
  DollarSign,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Role, NavItem } from "@/lib/config";
import { NAVIGATION, APP_CONFIG, ROLE_LABELS } from "@/lib/config";

// V1 icon map — only icons used in V1 navigation
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Shield,
  Users,
  UserPlus,
  ArrowLeftRight,
  Bell,
  FileText,
  Timer,
  Map,
  BarChart3,
  MessageSquare,
  BookOpen,
  LogOut,
  Menu,
  X,
  GraduationCap,
  ChevronRight,
  DollarSign,
};

export function Sidebar({
  role,
  userName,
  badgeCounts = {},
}: {
  role: Role;
  userName: string;
  badgeCounts?: Record<string, number>;
}) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const links: NavItem[] = NAVIGATION[role];

  const close = useCallback(() => setOpen(false), []);

  // Focus close button when sidebar opens, handle Escape key + focus trap
  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key === "Tab" && sidebarRef.current) {
        const focusable = sidebarRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign out failed:", err);
    }
    window.location.href = "/login";
  };

  const isActive = (href: string) =>
    href === `/${role}` ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* Skip to content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:p-4
          focus:bg-ima-surface focus:text-ima-text focus:rounded-lg"
      >
        Skip to main content
      </a>

      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden bg-ima-surface border border-ima-border
          rounded-xl p-3 min-h-[44px] min-w-[44px] flex items-center justify-center
          shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ima-primary"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5 text-ima-text" aria-hidden="true" />
      </button>

      {/* Backdrop — mobile overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            className="fixed inset-0 z-40 bg-ima-overlay md:hidden"
            aria-hidden="true"
            onClick={close}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label="Navigation menu"
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 h-screen",
          "bg-ima-surface border-r border-ima-border",
          "flex flex-col",
          "motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out",
          open ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0"
        )}
      >
        {/* Logo area */}
        <div className="flex items-center justify-between px-4 h-16 shrink-0">
          <Link
            href={`/${role}`}
            className="flex items-center gap-2.5 min-h-[44px] group"
          >
            <div className="h-8 w-8 rounded-lg bg-ima-primary flex items-center justify-center shrink-0">
              <GraduationCap className="h-[18px] w-[18px] text-white" aria-hidden="true" />
            </div>
            <span className="text-sm font-bold text-ima-text tracking-tight group-hover:text-ima-primary motion-safe:transition-colors">
              {APP_CONFIG.name}
            </span>
          </Link>
          <button
            ref={closeButtonRef}
            onClick={close}
            className="md:hidden p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ima-primary rounded-lg
              hover:bg-ima-surface-light motion-safe:transition-colors"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5 text-ima-text-secondary" aria-hidden="true" />
          </button>
        </div>

        {/* Divider below logo */}
        <div className="mx-3 border-b border-ima-border" />

        {/* Main nav links */}
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-ima-text-muted select-none">
            Menu
          </p>
          <ul role="list" className="space-y-0.5">
            {links.map((item) => {
              const Icon = ICON_MAP[item.icon];
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  {/* Render separator divider BEFORE items with separator: true */}
                  {item.separator && (
                    <div
                      className="my-2 mx-3 border-t border-ima-border -mt-0.5 mb-2"
                      aria-hidden="true"
                    />
                  )}
                    <Link
                      href={item.href}
                      onClick={close}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm",
                        "motion-safe:transition-all motion-safe:duration-150",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ima-primary focus-visible:ring-offset-1",
                        active
                          ? "bg-ima-surface-accent text-ima-primary font-semibold"
                          : "text-ima-text-secondary hover:bg-ima-surface-light hover:text-ima-text font-medium"
                      )}
                    >
                      {/* Animated active indicator bar */}
                      {active && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-ima-primary"
                          transition={
                            prefersReducedMotion
                              ? { duration: 0 }
                              : { type: "spring", stiffness: 350, damping: 30 }
                          }
                        />
                      )}
                      {Icon && (
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0",
                            active ? "text-ima-primary" : "text-ima-text-muted"
                          )}
                          aria-hidden="true"
                        />
                      )}
                      <span className="truncate">{item.label}</span>
                      {/* Badge — only rendered when count > 0 */}
                      {item.badge && (badgeCounts[item.badge] ?? 0) > 0 && (
                        <span className="ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full bg-ima-primary/10 text-ima-primary shrink-0">
                          {badgeCounts[item.badge]}
                        </span>
                      )}
                      {active && !item.badge && (
                        <ChevronRight
                          className="ml-auto h-3.5 w-3.5 text-ima-primary/50 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom section: User info + Sign out */}
        <div className="shrink-0 border-t border-ima-border">
          <div className="px-3 py-3">
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
              role="group"
              aria-label="User account"
            >
              <div
                className="h-8 w-8 rounded-full bg-gradient-to-br from-ima-primary to-ima-secondary flex items-center justify-center text-xs font-bold text-white shrink-0"
                aria-hidden="true"
              >
                {userName?.charAt(0)?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ima-text truncate">{userName}</p>
                <p className="text-xs text-ima-text-muted">{ROLE_LABELS[role]}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-3 min-h-[44px] rounded-lg text-sm font-medium
                cursor-pointer text-ima-text-secondary hover:bg-ima-surface-light hover:text-ima-error
                motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-ima-primary focus-visible:ring-offset-1"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
