import { BN } from "@anchor-lang/core";
import { PublicKey } from "@solana/web3.js";
import { NORTIA_PROGRAM_KEY } from "@/lib/solana/constants";

export function protocolPda() {
  return PublicKey.findProgramAddressSync([Buffer.from("protocol")], NORTIA_PROGRAM_KEY)[0];
}

export function marketPda(creator: PublicKey, marketId: BN) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("market"), creator.toBuffer(), marketId.toArrayLike(Buffer, "le", 8)],
    NORTIA_PROGRAM_KEY,
  )[0];
}

export function vaultPda(market: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], NORTIA_PROGRAM_KEY)[0];
}
