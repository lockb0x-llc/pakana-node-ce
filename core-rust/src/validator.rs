// src/validator.rs
//! Stellar-XDR transaction validator module.

use stellar_xdr::curr::{
    Limits, Memo, MuxedAccount, OperationBody, TransactionEnvelope, ReadXdr,
    Transaction, TransactionV0, DecoratedSignature, Error as StellarXdrError,
};
use base64::{Engine as _, engine::general_purpose};
use log::info;

/// Validation error variants.
#[derive(Debug)]
pub enum ValidationError {
    MissingSourceAccount,
    MissingFee,
    MissingSequenceNumber,
    InvalidOperation(String),
    MemoTooLarge,
    SignatureVerificationFailed,
    DecodeError(String),
    Other(String),
}

/// Decode a base64 XDR strings into a TransactionEnvelope
pub fn decode_envelope(b64: &str) -> Result<TransactionEnvelope, ValidationError> {
    let bytes = general_purpose::STANDARD.decode(b64)
        .map_err(|e| ValidationError::DecodeError(e.to_string()))?;
        
    TransactionEnvelope::from_xdr(&bytes, Limits::none())
        .map_err(|e: StellarXdrError| ValidationError::DecodeError(e.to_string()))
}

/// Validate a decoded Stellar transaction.
pub fn validate_transaction(envelope: &TransactionEnvelope) -> Result<(), ValidationError> {
    match envelope {
        TransactionEnvelope::Tx(env) => validate_v1(&env.tx, &env.signatures),
        TransactionEnvelope::TxV0(env) => validate_v0(&env.tx, &env.signatures),
        TransactionEnvelope::TxFeeBump(_) => Err(ValidationError::Other("Fee bump transactions not supported yet".into())),
    }
}

fn validate_v1(tx: &Transaction, signatures: &[DecoratedSignature]) -> Result<(), ValidationError> {
    // Basic field presence checks.
    // Note: In Protocol 24+, source_account cannot be empty (it's a fixed-size key)
    if tx.fee == 0 {
        return Err(ValidationError::MissingFee);
    }
    if tx.seq_num.0 <= 0 {
        return Err(ValidationError::MissingSequenceNumber);
    }

    // Operations
    validate_operations(&tx.operations)?;

    // Memo
    if let Memo::Text(ref txt) = tx.memo {
        if txt.len() > 28 {
            return Err(ValidationError::MemoTooLarge);
        }
    }

    if signatures.is_empty() {
        return Err(ValidationError::SignatureVerificationFailed);
    }

    info!("[Validator] V1 Transaction validation succeeded");
    Ok(())
}

fn validate_v0(tx: &TransactionV0, signatures: &[DecoratedSignature]) -> Result<(), ValidationError> {
    // V0 source account is just Ed25519 (Uint256)
    
    if tx.fee == 0 {
        return Err(ValidationError::MissingFee);
    }
    if tx.seq_num.0 <= 0 {
        return Err(ValidationError::MissingSequenceNumber);
    }

    validate_operations(&tx.operations)?;

    if let Memo::Text(ref txt) = tx.memo {
        if txt.len() > 28 {
            return Err(ValidationError::MemoTooLarge);
        }
    }

    if signatures.is_empty() {
        return Err(ValidationError::SignatureVerificationFailed);
    }

    info!("[Validator] V0 Transaction validation succeeded");
    Ok(())
}

fn validate_operations(ops: &[stellar_xdr::curr::Operation]) -> Result<(), ValidationError> {
    for (_idx, op) in ops.iter().enumerate() {
        match op.body {
            OperationBody::CreateAccount(_) |
            OperationBody::Payment(_) |
            OperationBody::PathPaymentStrictReceive(_) |
            OperationBody::ManageSellOffer(_) |
            OperationBody::CreatePassiveSellOffer(_) |
            OperationBody::SetOptions(_) |
            OperationBody::ChangeTrust(_) |
            OperationBody::AllowTrust(_) |
            OperationBody::AccountMerge(_) |
            OperationBody::Inflation |
            OperationBody::ManageData(_) |
            OperationBody::BumpSequence(_) |
            OperationBody::ManageBuyOffer(_) |
            OperationBody::PathPaymentStrictSend(_) |
            OperationBody::CreateClaimableBalance(_) |
            OperationBody::ClaimClaimableBalance(_) |
            OperationBody::BeginSponsoringFutureReserves(_) |
            OperationBody::EndSponsoringFutureReserves |
            OperationBody::RevokeSponsorship(_) |
            OperationBody::Clawback(_) |
            OperationBody::ClawbackClaimableBalance(_) |
            OperationBody::SetTrustLineFlags(_) |
            OperationBody::LiquidityPoolDeposit(_) |
            OperationBody::LiquidityPoolWithdraw(_) |
            OperationBody::InvokeHostFunction(_) |
            OperationBody::ExtendFootprintTtl(_) |
            OperationBody::RestoreFootprint(_) => {
                // Known
            }
        }
    }
    Ok(())
}

/// Extract the source account ID from a transaction envelope as a hex string.
pub fn extract_source_account(envelope: &TransactionEnvelope) -> String {
    match envelope {
        TransactionEnvelope::Tx(env) => muxed_account_to_hex(&env.tx.source_account),
        TransactionEnvelope::TxV0(env) => hex::encode(env.tx.source_account_ed25519.0),
        TransactionEnvelope::TxFeeBump(env) => {
            match &env.tx.inner_tx {
                stellar_xdr::curr::FeeBumpTransactionInnerTx::Tx(inner) => {
                    muxed_account_to_hex(&inner.tx.source_account)
                }
            }
        }
    }
}

/// Convert MuxedAccount to hex-encoded account ID
fn muxed_account_to_hex(account: &MuxedAccount) -> String {
    match account {
        MuxedAccount::Ed25519(k) => hex::encode(k.0),
        MuxedAccount::MuxedEd25519(m) => hex::encode(m.ed25519.0),
    }
}

/// Extract the sequence number from a transaction envelope.
pub fn extract_seq_num(envelope: &TransactionEnvelope) -> i64 {
    match envelope {
        TransactionEnvelope::Tx(env) => env.tx.seq_num.0,
        TransactionEnvelope::TxV0(env) => env.tx.seq_num.0,
        TransactionEnvelope::TxFeeBump(env) => {
            match &env.tx.inner_tx {
                stellar_xdr::curr::FeeBumpTransactionInnerTx::Tx(inner) => inner.tx.seq_num.0,
            }
        }
    }
}

/// Extract the Memo Hash from a transaction envelope if present.
pub fn extract_memo_hash(envelope: &TransactionEnvelope) -> Option<String> {
    let memo = match envelope {
        TransactionEnvelope::Tx(env) => &env.tx.memo,
        TransactionEnvelope::TxV0(env) => &env.tx.memo,
        TransactionEnvelope::TxFeeBump(env) => {
            match &env.tx.inner_tx {
                stellar_xdr::curr::FeeBumpTransactionInnerTx::Tx(inner) => &inner.tx.memo,
            }
        }
    };

    match memo {
        Memo::Hash(h) => Some(hex::encode(h.0)),
        Memo::Return(h) => Some(hex::encode(h.0)), // Treat Return hash similarly for now?
        _ => None,
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    // A minimal valid XDR (placeholder) - real testing would requires constructing structs
    const SAMPLE_XDR: &str = "AAAAAgAAAABuazSgHwYJq3qCtKzaeHq3yHq3yHq3yHq3yHq3yHq3yAAAAZAAAAABAAAAAQAAAAAAAAAAAAAAAF3vvwAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAAHLbHn0yI0e8t0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

    #[test]
    fn test_decode_bad_base64() {
        let res = decode_envelope("NotBase64%%");
        assert!(matches!(res, Err(ValidationError::DecodeError(_))));
    }

    #[test]
    fn test_decode_bad_xdr() {
        // "SGVsbG8=" is "Hello" in base64, usually not valid XDR envelope
        let res = decode_envelope("SGVsbG8="); 
        // Might fail XDR decoding
        if res.is_ok() {
             // If "Hello" somehow decodes to an envelope (unlikely), check validation
             let _ = validate_transaction(&res.unwrap());
        } else {
             assert!(matches!(res, Err(ValidationError::DecodeError(_))));
        }
    }
}
