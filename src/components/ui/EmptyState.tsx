interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** "default" = full vertical centered layout (default). "compact" = horizontal inline layout for use within cards/sections. */
  variant?: "default" | "compact";
}

export function EmptyState({ icon, title, description, action, variant = "default" }: EmptyStateProps) {
  if (variant === "compact") {
    return (
      <div className="flex items-center gap-4 py-6 px-4" role="status">
        {icon && (
          <div className="text-ima-text-muted p-3 rounded-full bg-ima-surface-light flex-shrink-0" aria-hidden="true">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-ima-text">{title}</h3>
          {description && (
            <p className="text-sm text-ima-text-secondary mt-1 leading-relaxed">{description}</p>
          )}
          {/* CTA buttons passed via `action` should use the Button component which enforces min-h-[44px] */}
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="py-16 flex flex-col items-center text-center px-4" role="status">
      {icon && (
        <div className="text-ima-text-muted mb-5 p-4 rounded-full bg-ima-surface-light" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-ima-text">{title}</h3>
      {description && (
        <p className="text-sm text-ima-text-secondary mt-2 max-w-sm leading-relaxed">{description}</p>
      )}
      {/* CTA buttons passed via `action` should use the Button component which enforces min-h-[44px] */}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
