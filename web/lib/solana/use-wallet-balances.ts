"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useCallback, useEffect, useState } from "react";
import { DEVNET_USDC_MINT_KEY } from "@/lib/solana/constants";

export type WalletBalances = {
  sol: number;
  usdc: number;
};

export function useWalletBalances() {
  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const [lamports, token] = await Promise.all([
        connection.getBalance(publicKey, "confirmed"),
        connection
          .getTokenAccountBalance(getAssociatedTokenAddressSync(DEVNET_USDC_MINT_KEY, publicKey), "confirmed")
          .catch(() => null),
      ]);
      setBalances({ sol: lamports / 1_000_000_000, usdc: token?.value.uiAmount ?? 0 });
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    if (!connected) {
      setBalances(null);
      return;
    }
    void refresh();
  }, [connected, refresh]);

  return { balances, loading, refresh };
}
