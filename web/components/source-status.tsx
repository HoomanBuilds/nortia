import { Database, Radio } from "lucide-react";

export function SourceStatus({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "source-status compact" : "source-status"}>
      <span className="source-icon"><Radio size={16} aria-hidden="true" /></span>
      <span>
        <strong>TXLINE SIMULATION</strong>
        {!compact && <small>Normalized World Cup replay schema</small>}
      </span>
      <span className="source-health"><Database size={14} aria-hidden="true" /> READY</span>
    </div>
  );
}
