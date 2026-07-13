"use client";

import { Check, EyeOff, Fingerprint, KeyRound, Search, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { findPrivatePosition, type PrivatePosition } from "@/lib/positions";

export function RecoveryPanel({ onRecovered }: { onRecovered?: (position: PrivatePosition) => void }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<"found" | "missing" | null>(null);

  const recover = () => {
    const position = findPrivatePosition(value);
    setResult(position ? "found" : "missing");
    if (position) onRecovered?.(position);
  };
  return (
    <div className="recovery-card">
      <div className="recovery-card-heading"><span><KeyRound size={18} /></span><div><small>Private recovery</small><h2>Find a committed position</h2></div></div>
      <p>Enter the secret created when you placed the order. Nortia derives the commitment locally and searches public pool state without revealing your wallet.</p>
      <label><span>Position secret or commitment</span><div><Fingerprint size={16} /><input type="password" value={value} onChange={(event) => { setValue(event.target.value); setResult(null); }} placeholder="Paste your recovery value" autoComplete="off" /><EyeOff size={15} /></div></label>
      <button type="button" disabled={value.length < 8} onClick={recover}><Search size={15} />Recover position</button>
      <small className="local-only"><ShieldCheck size={13} />The secret stays in this browser.</small>
      {result && <div className={result === "found" ? "recovery-result" : "recovery-result missing"}><Check size={15} /><div><strong>{result === "found" ? "Position recovered" : "No local commitment found"}</strong><span>{result === "found" ? "The position is now visible below." : "Import the browser backup used when the order was created."}</span></div></div>}
    </div>
  );
}
