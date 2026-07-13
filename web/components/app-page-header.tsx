import type { ReactNode } from "react";

export function AppPageHeader({ eyebrow, title, accent, description, aside }: { eyebrow: ReactNode; title: string; accent: string; description: string; aside?: ReactNode }) {
  return (
    <section className="app-page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}<br /><em>{accent}</em></h1>
        <p>{description}</p>
      </div>
      {aside && <div className="app-page-header-aside">{aside}</div>}
    </section>
  );
}
