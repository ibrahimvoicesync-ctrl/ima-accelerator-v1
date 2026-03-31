"use client";

import { Modal } from "@/components/ui/Modal";

interface MotivationalCardProps {
  onStartNextSession: () => void;
  onDismiss: () => void;
}

export function MotivationalCard({ onStartNextSession, onDismiss }: MotivationalCardProps) {
  return (
    <Modal open={true} onClose={onDismiss} size="sm">
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        {/* Arabic motivational text — per D-06, COMP-01 */}
        <p
          dir="rtl"
          lang="ar"
          className="text-4xl font-bold text-ima-text"
        >
          اللهم بارك
        </p>

        {/* English encouragement text — per COMP-01 */}
        <p className="text-base text-ima-text-secondary">
          You have done the bare minimum! Continue with your next work session
        </p>

        {/* Action buttons — per D-07, COMP-02 */}
        <div className="flex gap-3 mt-2 w-full">
          <button
            onClick={onStartNextSession}
            className="flex-1 bg-ima-primary text-white rounded-lg min-h-[44px] font-medium hover:bg-ima-primary-hover motion-safe:transition-colors"
          >
            Start Next Session
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 bg-ima-surface border border-ima-border text-ima-text rounded-lg min-h-[44px] font-medium hover:bg-ima-bg motion-safe:transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </Modal>
  );
}
