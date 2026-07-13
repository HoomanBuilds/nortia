const palettes: Record<string, [string, string]> = {
  BRA: ["#f7db37", "#229852"], FRA: ["#3158c9", "#f2f3f7"], ARG: ["#8bd4f5", "#f2f3f7"],
  ENG: ["#f4f4f2", "#ce3446"], ESP: ["#f2c23e", "#d63832"], POR: ["#d63843", "#1a8b55"],
  GER: ["#e7c84c", "#c83b36"], NED: ["#ef7734", "#f5f1e8"], USA: ["#e9edf4", "#345bb5"],
  MEX: ["#1c9a5d", "#e8ebe7"], JPN: ["#f2f2f0", "#d53d4b"], KOR: ["#f0f1ed", "#3460b9"],
};

export function TeamMark({ code, size = "md" }: { code: string; size?: "sm" | "md" | "lg" }) {
  const [primary, secondary] = palettes[code] ?? ["#f97316", "#23251f"];
  return (
    <span className={`team-mark team-mark-${size}`} style={{ background: `linear-gradient(135deg, ${primary} 0 50%, ${secondary} 50%)` }}>
      <span>{code.slice(0, 2)}</span>
    </span>
  );
}
