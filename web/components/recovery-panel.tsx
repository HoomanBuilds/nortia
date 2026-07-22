"use client";

import { Check, Download, EyeOff, Fingerprint, KeyRound, Search, ShieldCheck, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { findPrivatePosition, type PrivatePosition } from "@/lib/positions";

export function RecoveryPanel({
  positions,
  onRecovered,
  onExport,
  onImport,
}: {
  positions: readonly PrivatePosition[];
  onRecovered?: (position: PrivatePosition) => void;
  onExport?: () => Promise<void>;
  onImport?: (file: File) => Promise<number>;
}) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<"found" | "missing" | null>(null);
  const [backupState, setBackupState] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const recover = () => {
    const position = findPrivatePosition(positions, value);
    setResult(position ? "found" : "missing");
    if (position) onRecovered?.(position);
  };

  const exportBackup = async () => {
    if (!onExport) return;
    setBackupBusy(true);
    setBackupState(null);
    try {
      await onExport();
      setBackupState("Encrypted backup downloaded");
    } catch (error) {
      setBackupState(error instanceof Error ? error.message : "Backup export failed");
    } finally {
      setBackupBusy(false);
    }
  };

  const importBackup = async (file: File | undefined) => {
    if (!file || !onImport) return;
    setBackupBusy(true);
    setBackupState(null);
    try {
      const count = await onImport(file);
      setBackupState(`${count} encrypted position${count === 1 ? "" : "s"} available`);
    } catch (error) {
      setBackupState(error instanceof Error ? error.message : "Backup import failed");
    } finally {
      setBackupBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  return (
    <div className="recovery-card">
      <div className="recovery-card-heading"><span><KeyRound size={18} /></span><div><small>Private recovery</small><h2>Find a committed position</h2></div></div>
      <p>Enter the secret created when you placed the order. Nortia searches your unlocked encrypted vault and public pool state without sending the secret to a search service.</p>
      <label><span>Position secret or commitment</span><div><Fingerprint size={16} /><input type="password" value={value} onChange={(event) => { setValue(event.target.value); setResult(null); }} placeholder="Paste your recovery value" autoComplete="off" /><EyeOff size={15} /></div></label>
      <button type="button" disabled={value.length < 8} onClick={recover}><Search size={15} />Recover position</button>
      <small className="local-only"><ShieldCheck size={13} />The secret stays inside this unlocked browser session.</small>
      {result && <div className={result === "found" ? "recovery-result" : "recovery-result missing"}><Check size={15} /><div><strong>{result === "found" ? "Position recovered" : "No local commitment found"}</strong><span>{result === "found" ? "The position is now visible below." : "Import the browser backup used when the order was created."}</span></div></div>}
      <div className="backup-actions">
        <button type="button" disabled={backupBusy || !onExport} onClick={() => void exportBackup()}><Download size={14} />Export encrypted backup</button>
        <button type="button" disabled={backupBusy || !onImport} onClick={() => fileInput.current?.click()}><Upload size={14} />Import encrypted backup</button>
        <input ref={fileInput} type="file" accept="application/json,.json" onChange={(event) => void importBackup(event.target.files?.[0])} />
      </div>
      {backupState && <small className="backup-state">{backupState}</small>}
    </div>
  );
}
