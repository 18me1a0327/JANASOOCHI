import type { ReactNode } from "react";
import { Inbox, LoaderCircle } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: Readonly<{ eyebrow: string; title: string; description: string; actions?: ReactNode }>) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
}: Readonly<{ title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }>) {
  return (
    <section className={`surface-panel ${className}`.trim()}>
      <header className="panel-header">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="panel-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export function EmptyState({ title, description, loading = false }: Readonly<{ title: string; description: string; loading?: boolean }>) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-icon">
        {loading ? <LoaderCircle className="spin" aria-hidden="true" /> : <Inbox aria-hidden="true" />}
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function MetricCard({ label, value, note, tone = "default" }: Readonly<{ label: string; value: string; note: string; tone?: "default" | "positive" | "warning" }>) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
