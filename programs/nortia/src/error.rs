use anchor_lang::prelude::*;

#[error_code]
pub enum NortiaError {
    #[msg("Protocol configuration is invalid")]
    InvalidProtocolConfiguration,
    #[msg("Market configuration is invalid")]
    InvalidMarketConfiguration,
    #[msg("Market phase does not allow this instruction")]
    InvalidPhase,
    #[msg("The market is locked")]
    MarketLocked,
    #[msg("The requested transition is too early")]
    TooEarly,
    #[msg("The deadline has elapsed")]
    DeadlineElapsed,
    #[msg("Committee quorum was not met")]
    CommitteeQuorumNotMet,
    #[msg("A duplicate committee signer was supplied")]
    DuplicateCommitteeSigner,
    #[msg("Batch counts do not match accepted orders")]
    BatchCountMismatch,
    #[msg("The market has no accepted orders")]
    NoOrders,
    #[msg("A zero commitment or root is not allowed")]
    ZeroCommitment,
    #[msg("The public witness has an invalid length")]
    InvalidWitnessLength,
    #[msg("The public witness does not match the instruction context")]
    PublicWitnessMismatch,
    #[msg("The proof payload has an invalid length")]
    InvalidProofLength,
    #[msg("The verifier program is invalid")]
    InvalidVerifierProgram,
    #[msg("Poseidon hashing failed")]
    PoseidonHashFailed,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("The resolved side has no winning tickets")]
    NoWinners,
    #[msg("The order has already been refunded")]
    AlreadyRefunded,
    #[msg("The order does not belong to this market or payer")]
    InvalidOrder,
    #[msg("The collateral mint is invalid")]
    InvalidCollateralMint,
    #[msg("A token account does not match the required owner or mint")]
    InvalidTokenAccount,
    #[msg("The protocol fee is invalid")]
    InvalidProtocolFee,
    #[msg("The protocol treasury is invalid")]
    InvalidTreasury,
    #[msg("The vault does not have enough ticket collateral")]
    InsufficientVaultBalance,
    #[msg("The TxLINE program is invalid")]
    InvalidTxlineProgram,
    #[msg("The TxLINE daily root account is invalid")]
    InvalidTxlineRoot,
    #[msg("The TxLINE score payload is invalid for this market")]
    InvalidScorePayload,
    #[msg("TxLINE did not return a valid boolean")]
    InvalidTxlineReturn,
}
