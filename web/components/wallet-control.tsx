"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ChevronDown, ExternalLink, LogOut, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useWalletBalances } from "@/lib/solana/use-wallet-balances";

export function WalletControl() {
  const { connected, connecting, disconnect, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);
  const { balances } = useWalletBalances();

  useEffect(() => {
    if (!connected) setOpen(false);
  }, [connected]);

  if (!connected || !publicKey) {
    return (
      <button className="account-button" type="button" onClick={() => setVisible(true)} disabled={connecting}>
        <Wallet size={15} />
        <span>{connecting ? "Connecting" : "Connect wallet"}</span>
      </button>
    );
  }

  const address = publicKey.toBase58();
  return (
    <div className="wallet-control">
      <button className="account-button" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <Wallet size={15} />
        <span>{address.slice(0, 4)}...{address.slice(-4)}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="account-popover">
          <div className="popover-label">Connected on Solana devnet</div>
          <strong>{address.slice(0, 8)}...{address.slice(-8)}</strong>
          <div className="account-balance"><span>USDC balance</span><b>{balances ? balances.usdc.toFixed(2) : "..."} USDC</b></div>
          <div className="account-balance compact"><span>Network fees</span><b>{balances ? balances.sol.toFixed(4) : "..."} SOL</b></div>
          <div className="wallet-popover-actions">
            <a href={`https://explorer.solana.com/address/${address}?cluster=devnet`} target="_blank" rel="noreferrer">Explorer <ExternalLink size={12} /></a>
            <button type="button" onClick={() => void disconnect()}><LogOut size={12} />Disconnect</button>
          </div>
        </div>
      )}
    </div>
  );
}
