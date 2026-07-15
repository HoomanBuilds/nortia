use anchor_lang::prelude::*;
use switchboard_on_demand::on_demand::oracle_quote::{
    ParsedEd25519Instruction, ParsedQuotePayload,
};

use crate::{
    constants::{SWITCHBOARD_DEVNET_QUEUE, SWITCHBOARD_QUOTE_PROGRAM_ID},
    error::NortiaError,
    oracles::{compare_values, NormalizedObservation},
    state::{OracleConfig, OracleResolverV2},
};

const SWITCHBOARD_QUOTE_DISCRIMINATOR: &[u8; 8] = b"SBOracle";
const SWITCHBOARD_TAIL_DISCRIMINATOR: [u8; 4] = *b"SBOD";
const SWITCHBOARD_VALUE_EXPONENT: i32 = -18;

pub fn validate_switchboard_account(
    quote_account: &AccountInfo<'_>,
    oracle: &OracleConfig,
    clock: &Clock,
) -> Result<NormalizedObservation> {
    require!(
        oracle.resolver == OracleResolverV2::SwitchboardQuoteV1
            && oracle.source_program == SWITCHBOARD_QUOTE_PROGRAM_ID
            && oracle.source_queue == SWITCHBOARD_DEVNET_QUEUE,
        NortiaError::InvalidOracleConfiguration
    );
    require_keys_eq!(
        *quote_account.owner,
        oracle.source_program,
        NortiaError::InvalidSwitchboardQuote
    );
    let canonical_key = Pubkey::find_program_address(
        &[oracle.source_queue.as_ref(), oracle.source_id.as_ref()],
        &oracle.source_program,
    )
    .0;
    require_keys_eq!(
        *quote_account.key,
        canonical_key,
        NortiaError::InvalidSwitchboardQuote
    );

    let account_data = quote_account
        .try_borrow_data()
        .map_err(|_| error!(NortiaError::InvalidSwitchboardQuote))?;
    require!(
        account_data.len() >= 42 && &account_data[..8] == SWITCHBOARD_QUOTE_DISCRIMINATOR,
        NortiaError::InvalidSwitchboardQuote
    );
    let queue = Pubkey::new_from_array(
        account_data[8..40]
            .try_into()
            .map_err(|_| error!(NortiaError::InvalidSwitchboardQuote))?,
    );
    require_keys_eq!(
        queue,
        oracle.source_queue,
        NortiaError::InvalidSwitchboardQuote
    );
    let payload_len = u16::from_le_bytes([account_data[40], account_data[41]]) as usize;
    let payload_end = 42usize
        .checked_add(payload_len)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    require!(
        payload_len > 0 && payload_end <= account_data.len(),
        NortiaError::InvalidSwitchboardQuote
    );
    let parsed = ParsedQuotePayload::parse(&account_data[42..payload_end])
        .map_err(|_| error!(NortiaError::InvalidSwitchboardQuote))?;
    let ParsedQuotePayload::Oracle(quote) = parsed else {
        return err!(NortiaError::InvalidSwitchboardQuote);
    };
    validate_switchboard_quote(&quote, oracle, clock)
}

fn validate_switchboard_quote(
    quote: &ParsedEd25519Instruction,
    oracle: &OracleConfig,
    clock: &Clock,
) -> Result<NormalizedObservation> {
    require!(
        quote.padding == 0
            && quote.version > 0
            && quote.discriminator == SWITCHBOARD_TAIL_DISCRIMINATOR
            && quote.quote_header.signed_slothash != [0; 32]
            && quote.feeds.len() == 1
            && quote.signatures.len() == quote.num_signatures as usize
            && quote.oracle_idxs.len() == quote.signatures.len()
            && quote.signatures.len() >= oracle.min_samples as usize
            && quote.signatures[0].offsets.message_data_size as usize == 32 + 49,
        NortiaError::InvalidSwitchboardQuote
    );
    for (index, oracle_index) in quote.oracle_idxs.iter().enumerate() {
        require!(
            !quote.oracle_idxs[..index].contains(oracle_index),
            NortiaError::InvalidSwitchboardQuote
        );
        require!(
            quote.signatures[index].pubkey != [0; 32]
                && quote.signatures[index].signature != [0; 64]
                && !quote.signatures[..index]
                    .iter()
                    .any(|signature| signature.pubkey == quote.signatures[index].pubkey),
            NortiaError::InvalidSwitchboardQuote
        );
    }
    let feed = &quote.feeds[0];
    require!(
        feed.feed_id() == &oracle.source_id && feed.min_oracle_samples() >= oracle.min_samples,
        NortiaError::InvalidSwitchboardQuote
    );
    require!(
        quote.slot <= clock.slot && clock.slot - quote.slot <= oracle.max_staleness_slots,
        NortiaError::InvalidObservationTime
    );
    let window_end = oracle
        .observation_ts
        .checked_add(oracle.observation_window_secs as i64)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    require!(
        clock.unix_timestamp >= oracle.observation_ts && clock.unix_timestamp <= window_end,
        NortiaError::InvalidObservationTime
    );
    let value = feed.feed_value();
    let outcome = u8::from(compare_values(
        value,
        SWITCHBOARD_VALUE_EXPONENT,
        oracle.threshold,
        oracle.threshold_exponent,
        oracle.comparator,
    )?);
    Ok(NormalizedObservation {
        outcome,
        value,
        exponent: SWITCHBOARD_VALUE_EXPONENT,
        timestamp: clock.unix_timestamp,
        slot: quote.slot,
        confidence: 0,
        sample_count: quote.num_signatures,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use switchboard_on_demand::{
        on_demand::oracle_quote::{
            build_authority_quote_payload, OracleSignatureData, PackedFeedInfo, PackedQuoteHeader,
        },
        sysvar::ed25519_sysvar::Ed25519SignatureOffsets,
    };

    const FEED_ID: [u8; 32] = [7; 32];
    const OBSERVATION_TS: i64 = 2_000;

    fn oracle_config(queue: Pubkey) -> OracleConfig {
        OracleConfig {
            bump: 1,
            version: OracleConfig::VERSION,
            market: Pubkey::new_unique(),
            resolver: OracleResolverV2::SwitchboardQuoteV1,
            source_program: SWITCHBOARD_QUOTE_PROGRAM_ID,
            source_queue: queue,
            source_id: FEED_ID,
            comparator: crate::state::ValueComparator::GreaterThanOrEqual,
            threshold: 100_000_000_000_000_000_000,
            threshold_exponent: -18,
            observation_ts: OBSERVATION_TS,
            observation_window_secs: 60,
            max_staleness_secs: 0,
            max_staleness_slots: 20,
            max_confidence_bps: 0,
            min_samples: 2,
            challenge_period_secs: 0,
            config_hash: [8; 32],
            consumed: false,
        }
    }

    fn signature(pubkey_byte: u8) -> OracleSignatureData {
        OracleSignatureData {
            offsets: Ed25519SignatureOffsets {
                signature_offset: 0,
                signature_instruction_index: 0,
                public_key_offset: 0,
                public_key_instruction_index: 0,
                message_data_offset: 0,
                message_data_size: 81,
                message_instruction_index: 0,
            },
            pubkey: [pubkey_byte; 32],
            signature: [pubkey_byte; 64],
        }
    }

    fn parsed_quote() -> ParsedEd25519Instruction {
        ParsedEd25519Instruction {
            num_signatures: 2,
            padding: 0,
            signatures: vec![signature(1), signature(2)],
            quote_header: PackedQuoteHeader {
                signed_slothash: [3; 32],
            },
            feeds: vec![PackedFeedInfo {
                feed_id: FEED_ID,
                feed_value: 100_000_000_000_000_000_000,
                min_oracle_samples: 2,
            }],
            oracle_idxs: vec![1, 2],
            slot: 100,
            version: 1,
            discriminator: SWITCHBOARD_TAIL_DISCRIMINATOR,
        }
    }

    fn quote_account_data(queue: Pubkey) -> Vec<u8> {
        let quote = parsed_quote();
        let signature_count = quote.num_signatures as usize;
        let offsets_size = signature_count * 14;
        let pubkeys_offset = 2 + offsets_size;
        let signatures_offset = pubkeys_offset + signature_count * 32;
        let message_offset = signatures_offset + signature_count * 64;
        let message_size = 32 + quote.feeds.len() * 49;
        let mut payload = vec![quote.num_signatures, quote.padding];
        for index in 0..signature_count {
            payload.extend_from_slice(&((signatures_offset + index * 64) as u16).to_le_bytes());
            payload.extend_from_slice(&u16::MAX.to_le_bytes());
            payload.extend_from_slice(&((pubkeys_offset + index * 32) as u16).to_le_bytes());
            payload.extend_from_slice(&u16::MAX.to_le_bytes());
            payload.extend_from_slice(&(message_offset as u16).to_le_bytes());
            payload.extend_from_slice(&(message_size as u16).to_le_bytes());
            payload.extend_from_slice(&u16::MAX.to_le_bytes());
        }
        for signature in &quote.signatures {
            payload.extend_from_slice(&signature.pubkey);
        }
        for signature in &quote.signatures {
            payload.extend_from_slice(&signature.signature);
        }
        payload.extend_from_slice(&quote.quote_header.signed_slothash);
        for feed in &quote.feeds {
            payload.extend_from_slice(feed.feed_id());
            payload.extend_from_slice(&feed.feed_value().to_le_bytes());
            payload.push(feed.min_oracle_samples());
        }
        payload.extend_from_slice(&quote.oracle_idxs);
        payload.extend_from_slice(&quote.slot.to_le_bytes());
        payload.push(quote.version);
        payload.extend_from_slice(&quote.discriminator);

        let mut account_data = Vec::with_capacity(42 + payload.len());
        account_data.extend_from_slice(SWITCHBOARD_QUOTE_DISCRIMINATOR);
        account_data.extend_from_slice(queue.as_ref());
        account_data.extend_from_slice(&(payload.len() as u16).to_le_bytes());
        account_data.extend_from_slice(&payload);
        account_data
    }

    fn clock() -> Clock {
        Clock {
            slot: 110,
            epoch_start_timestamp: 0,
            epoch: 0,
            leader_schedule_epoch: 0,
            unix_timestamp: OBSERVATION_TS + 10,
        }
    }

    #[test]
    fn quote_accepts_canonical_multi_oracle_value() {
        let observation = validate_switchboard_quote(
            &parsed_quote(),
            &oracle_config(SWITCHBOARD_DEVNET_QUEUE),
            &clock(),
        )
        .unwrap();
        assert_eq!(observation.outcome, 1);
        assert_eq!(observation.value, 100_000_000_000_000_000_000);
        assert_eq!(observation.exponent, -18);
        assert_eq!(observation.slot, 100);
        assert_eq!(observation.sample_count, 2);
    }

    #[test]
    fn account_parser_accepts_only_canonical_quote_program_account() {
        let queue = SWITCHBOARD_DEVNET_QUEUE;
        let oracle = oracle_config(queue);
        let canonical_key = Pubkey::find_program_address(
            &[queue.as_ref(), FEED_ID.as_ref()],
            &SWITCHBOARD_QUOTE_PROGRAM_ID,
        )
        .0;
        let owner = SWITCHBOARD_QUOTE_PROGRAM_ID;
        let mut lamports = 1;
        let mut data = quote_account_data(queue);
        let account = AccountInfo::new(
            &canonical_key,
            false,
            false,
            &mut lamports,
            &mut data,
            &owner,
            false,
        );
        let observation = validate_switchboard_account(&account, &oracle, &clock()).unwrap();
        assert_eq!(observation.value, 100_000_000_000_000_000_000);
        drop(account);

        let wrong_key = Pubkey::new_unique();
        let wrong_account = AccountInfo::new(
            &wrong_key,
            false,
            false,
            &mut lamports,
            &mut data,
            &owner,
            false,
        );
        assert!(validate_switchboard_account(&wrong_account, &oracle, &clock()).is_err());
    }

    #[test]
    fn quote_rejects_wrong_feed_and_insufficient_samples() {
        let oracle = oracle_config(SWITCHBOARD_DEVNET_QUEUE);
        let mut wrong_feed = parsed_quote();
        wrong_feed.feeds[0].feed_id = [9; 32];
        assert!(validate_switchboard_quote(&wrong_feed, &oracle, &clock()).is_err());

        let mut insufficient = parsed_quote();
        insufficient.num_signatures = 1;
        insufficient.signatures.pop();
        insufficient.oracle_idxs.pop();
        assert!(validate_switchboard_quote(&insufficient, &oracle, &clock()).is_err());
    }

    #[test]
    fn quote_rejects_duplicate_oracles_and_authority_shape() {
        let oracle = oracle_config(SWITCHBOARD_DEVNET_QUEUE);
        let mut duplicate = parsed_quote();
        duplicate.oracle_idxs[1] = duplicate.oracle_idxs[0];
        assert!(validate_switchboard_quote(&duplicate, &oracle, &clock()).is_err());

        let authority = build_authority_quote_payload(
            &[PackedFeedInfo {
                feed_id: FEED_ID,
                feed_value: 100_000_000_000_000_000_000,
                min_oracle_samples: 1,
            }],
            100,
            1,
        )
        .unwrap();
        assert!(matches!(
            ParsedQuotePayload::parse(&authority).unwrap(),
            ParsedQuotePayload::Authority(_)
        ));
    }

    #[test]
    fn quote_rejects_stale_future_and_out_of_window_observations() {
        let oracle = oracle_config(SWITCHBOARD_DEVNET_QUEUE);
        let mut stale = parsed_quote();
        stale.slot = 89;
        assert!(validate_switchboard_quote(&stale, &oracle, &clock()).is_err());

        let mut future = parsed_quote();
        future.slot = 111;
        assert!(validate_switchboard_quote(&future, &oracle, &clock()).is_err());

        let mut late_clock = clock();
        late_clock.unix_timestamp = OBSERVATION_TS + 61;
        assert!(validate_switchboard_quote(&parsed_quote(), &oracle, &late_clock).is_err());
    }
}
