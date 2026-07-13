"use client";

import { AnchorProvider, Program } from "@anchor-lang/core";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useEffect, useMemo, useState } from "react";
import idl from "@/lib/solana/idl/nortia.json";
import type { Nortia } from "@/lib/solana/idl/nortia";
import { NORTIA_PROGRAM_KEY, TXLINE_PROGRAM_KEY } from "@/lib/solana/constants";
import { protocolPda } from "@/lib/solana/pdas";

export function useNortiaProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  return useMemo(() => {
    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed", preflightCommitment: "confirmed" });
    return new Program<Nortia>(idl as Nortia, provider);
  }, [connection, wallet]);
}

export function useProtocolStatus() {
  const { connection } = useConnection();
  const [status, setStatus] = useState({ loading: true, program: false, protocol: false, txline: false });

  useEffect(() => {
    let active = true;
    void Promise.all([
      connection.getAccountInfo(NORTIA_PROGRAM_KEY, "confirmed"),
      connection.getAccountInfo(protocolPda(), "confirmed"),
      connection.getAccountInfo(TXLINE_PROGRAM_KEY, "confirmed"),
    ]).then(([program, protocol, txline]) => {
      if (active) setStatus({ loading: false, program: Boolean(program?.executable), protocol: Boolean(protocol), txline: Boolean(txline?.executable) });
    }).catch(() => {
      if (active) setStatus({ loading: false, program: false, protocol: false, txline: false });
    });
    return () => { active = false; };
  }, [connection]);

  return status;
}
