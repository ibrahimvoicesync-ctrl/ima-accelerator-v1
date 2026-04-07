"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export type TabKey = "calendar" | "roadmap" | "deals";

interface StudentDetailTabsProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

const tabs: { key: TabKey; label: string }[] = [
  { key: "calendar", label: "Calendar" },
  { key: "roadmap", label: "Roadmap" },
  { key: "deals", label: "Deals" },
];

export function StudentDetailTabs({ activeTab, onTabChange }: StudentDetailTabsProps) {
  return (
    <div
      className="flex gap-1 overflow-x-auto border-b border-ima-border pb-1"
      role="tablist"
    >
      {tabs.map((tab) => (
        <Button
          key={tab.key}
          id={`tab-${tab.key}`}
          role="tab"
          aria-selected={activeTab === tab.key}
          aria-controls={`tabpanel-${tab.key}`}
          variant={activeTab === tab.key ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "shrink-0",
            activeTab === tab.key && "border-b-2 border-ima-primary"
          )}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}
