// src/balance.rs
//! Account balance tracking module for Stellar transactions.
//! 
//! Calculates balance deltas from transaction operations and applies them to YottaDB.

use stellar_xdr::curr::{
    TransactionEnvelope, OperationBody, Asset, MuxedAccount,
};
use yottadb::{Context, KeyContext};
use log::info;

/// Represents a balance change for an account
#[derive(Debug, Clone)]
pub struct BalanceDelta {
    /// Account ID (hex-encoded Ed25519 public key)
    pub account_id: String,
    /// Delta amount in stroops (positive = credit, negative = debit)
    pub delta: i64,
    /// Asset type ("native" for XLM, "asset_code:issuer" for others)
    pub asset: String,
    /// Description of the operation that caused this delta
    pub reason: String,
}

/// Calculate all balance deltas from a transaction envelope.
/// 
/// Returns a vector of BalanceDeltas representing all balance changes,
/// including fee deduction from the source account.
pub fn calculate_balance_deltas(envelope: &TransactionEnvelope) -> Vec<BalanceDelta> {
    let mut deltas = Vec::new();
    
    match envelope {
        TransactionEnvelope::Tx(env) => {
            let source = muxed_to_hex(&env.tx.source_account);
            let fee = env.tx.fee as i64;
            
            // Fee deduction from source account
            deltas.push(BalanceDelta {
                account_id: source.clone(),
                delta: -fee,
                asset: "native".to_string(),
                reason: "tx_fee".to_string(),
            });
            
            // Process each operation
            for op in env.tx.operations.iter() {
                let op_source = op.source_account.as_ref()
                    .map(|s| muxed_to_hex(s))
                    .unwrap_or_else(|| source.clone());
                
                let op_deltas = process_operation(&op.body, &op_source);
                deltas.extend(op_deltas);
            }
        }
        TransactionEnvelope::TxV0(env) => {
            let source = hex::encode(env.tx.source_account_ed25519.0);
            let fee = env.tx.fee as i64;
            
            // Fee deduction
            deltas.push(BalanceDelta {
                account_id: source.clone(),
                delta: -fee,
                asset: "native".to_string(),
                reason: "tx_fee".to_string(),
            });
            
            for op in env.tx.operations.iter() {
                let op_source = op.source_account.as_ref()
                    .map(|s| muxed_to_hex(s))
                    .unwrap_or_else(|| source.clone());
                
                let op_deltas = process_operation(&op.body, &op_source);
                deltas.extend(op_deltas);
            }
        }
        TransactionEnvelope::TxFeeBump(env) => {
            // Fee bump: outer fee payer pays the fee
            let fee_source = muxed_to_hex(&env.tx.fee_source);
            let fee = env.tx.fee as i64;
            
            deltas.push(BalanceDelta {
                account_id: fee_source,
                delta: -fee,
                asset: "native".to_string(),
                reason: "fee_bump".to_string(),
            });
            
            // Process inner transaction operations
            match &env.tx.inner_tx {
                stellar_xdr::curr::FeeBumpTransactionInnerTx::Tx(inner) => {
                    let inner_source = muxed_to_hex(&inner.tx.source_account);
                    for op in inner.tx.operations.iter() {
                        let op_source = op.source_account.as_ref()
                            .map(|s| muxed_to_hex(s))
                            .unwrap_or_else(|| inner_source.clone());
                        
                        let op_deltas = process_operation(&op.body, &op_source);
                        deltas.extend(op_deltas);
                    }
                }
            }
        }
    }
    
    deltas
}

/// Process a single operation and return balance deltas
fn process_operation(body: &OperationBody, source: &str) -> Vec<BalanceDelta> {
    let mut deltas = Vec::new();
    
    match body {
        OperationBody::CreateAccount(op) => {
            // Source loses starting_balance, destination gains it
            let dest = account_id_to_hex(&op.destination);
            let amount = op.starting_balance as i64;
            
            deltas.push(BalanceDelta {
                account_id: source.to_string(),
                delta: -amount,
                asset: "native".to_string(),
                reason: "create_account".to_string(),
            });
            deltas.push(BalanceDelta {
                account_id: dest,
                delta: amount,
                asset: "native".to_string(),
                reason: "create_account".to_string(),
            });
        }
        
        OperationBody::Payment(op) => {
            let dest = muxed_to_hex(&op.destination);
            let amount = op.amount as i64;
            let asset = asset_to_string(&op.asset);
            
            deltas.push(BalanceDelta {
                account_id: source.to_string(),
                delta: -amount,
                asset: asset.clone(),
                reason: "payment".to_string(),
            });
            deltas.push(BalanceDelta {
                account_id: dest,
                delta: amount,
                asset,
                reason: "payment".to_string(),
            });
        }
        
        OperationBody::PathPaymentStrictSend(op) => {
            let dest = muxed_to_hex(&op.destination);
            let send_amount = op.send_amount as i64;
            let send_asset = asset_to_string(&op.send_asset);
            // Note: dest_min is minimum, actual received could be higher
            // For now, we track the send amount from source only
            
            deltas.push(BalanceDelta {
                account_id: source.to_string(),
                delta: -send_amount,
                asset: send_asset,
                reason: "path_payment_strict_send".to_string(),
            });
            // Destination receives in dest_asset - amount determined by path
            // We'd need transaction result to know exact amount
            let _ = dest; // Track destination for future enhancement
        }
        
        OperationBody::PathPaymentStrictReceive(op) => {
            let dest = muxed_to_hex(&op.destination);
            let dest_amount = op.dest_amount as i64;
            let dest_asset = asset_to_string(&op.dest_asset);
            // Source pays up to send_max in send_asset
            // Destination receives exact dest_amount in dest_asset
            
            deltas.push(BalanceDelta {
                account_id: dest,
                delta: dest_amount,
                asset: dest_asset,
                reason: "path_payment_strict_receive".to_string(),
            });
            // Source debit amount determined by path - would need tx result
        }
        
        OperationBody::AccountMerge(destination) => {
            // Source account is deleted, all XLM goes to destination
            // Note: Actual balance comes from ledger state, not transaction
            let dest = muxed_to_hex(destination);
            
            // We can't know the exact amount without querying current balance
            // This creates a "merge marker" - actual balance transfer needs
            // to be calculated from the transaction result meta
            deltas.push(BalanceDelta {
                account_id: source.to_string(),
                delta: 0, // Marker: source merges out
                asset: "native:merge_out".to_string(),
                reason: "account_merge".to_string(),
            });
            deltas.push(BalanceDelta {
                account_id: dest,
                delta: 0, // Marker: destination receives merge
                asset: "native:merge_in".to_string(),
                reason: "account_merge".to_string(),
            });
        }
        
        // Operations that don't directly affect XLM balance but affect trustlines
        OperationBody::ChangeTrust(op) => {
            // ChangeTrust creates, updates, or removes a trustline
            let asset_key = match &op.line {
                stellar_xdr::curr::ChangeTrustAsset::Native => "native".to_string(),
                stellar_xdr::curr::ChangeTrustAsset::CreditAlphanum4(a) => {
                    let code = String::from_utf8_lossy(&a.asset_code.0)
                        .trim_end_matches('\0')
                        .to_string();
                    let issuer = account_id_to_hex(&a.issuer);
                    format!("{}:{}", code, issuer)
                }
                stellar_xdr::curr::ChangeTrustAsset::CreditAlphanum12(a) => {
                    let code = String::from_utf8_lossy(&a.asset_code.0)
                        .trim_end_matches('\0')
                        .to_string();
                    let issuer = account_id_to_hex(&a.issuer);
                    format!("{}:{}", code, issuer)
                }
                stellar_xdr::curr::ChangeTrustAsset::PoolShare(_) => "pool_share".to_string(),
            };
            
            let limit = op.limit as i64;
            deltas.push(BalanceDelta {
                account_id: source.to_string(),
                delta: 0, // Marker - ChangeTrust doesn't move balance
                asset: format!("trustline:{}", asset_key),
                reason: if limit == 0 { 
                    "remove_trustline".to_string() 
                } else { 
                    format!("set_trustline_limit:{}", limit)
                },
            });
        }
        
        OperationBody::AllowTrust(_) |
        OperationBody::SetOptions(_) |
        OperationBody::ManageData(_) |
        OperationBody::BumpSequence(_) |
        OperationBody::SetTrustLineFlags(_) |
        OperationBody::BeginSponsoringFutureReserves(_) |
        OperationBody::EndSponsoringFutureReserves |
        OperationBody::RevokeSponsorship(_) |
        OperationBody::ExtendFootprintTtl(_) |
        OperationBody::RestoreFootprint(_) => {
            // No direct balance effect
        }
        
        // Operations with complex balance effects (Phase 2)
        OperationBody::ManageSellOffer(_) |
        OperationBody::ManageBuyOffer(_) |
        OperationBody::CreatePassiveSellOffer(_) |
        OperationBody::CreateClaimableBalance(_) |
        OperationBody::ClaimClaimableBalance(_) |
        OperationBody::LiquidityPoolDeposit(_) |
        OperationBody::LiquidityPoolWithdraw(_) |
        OperationBody::Clawback(_) |
        OperationBody::ClawbackClaimableBalance(_) |
        OperationBody::InvokeHostFunction(_) |
        OperationBody::Inflation => {
            // Complex operations - require transaction result meta for accuracy
            // Phase 2: Implement detailed tracking
        }
    }
    
    deltas
}

/// Convert MuxedAccount to hex-encoded account ID
fn muxed_to_hex(account: &MuxedAccount) -> String {
    match account {
        MuxedAccount::Ed25519(k) => hex::encode(k.0),
        MuxedAccount::MuxedEd25519(m) => hex::encode(m.ed25519.0),
    }
}

/// Convert Asset to string representation
fn asset_to_string(asset: &Asset) -> String {
    match asset {
        Asset::Native => "native".to_string(),
        Asset::CreditAlphanum4(a) => {
            let code = String::from_utf8_lossy(&a.asset_code.0)
                .trim_end_matches('\0')
                .to_string();
            let issuer = account_id_to_hex(&a.issuer);
            format!("{}:{}", code, issuer)
        }
        Asset::CreditAlphanum12(a) => {
            let code = String::from_utf8_lossy(&a.asset_code.0)
                .trim_end_matches('\0')
                .to_string();
            let issuer = account_id_to_hex(&a.issuer);
            format!("{}:{}", code, issuer)
        }
    }
}

/// Convert AccountId to hex-encoded string
fn account_id_to_hex(account_id: &stellar_xdr::curr::AccountId) -> String {
    match &account_id.0 {
        stellar_xdr::curr::PublicKey::PublicKeyTypeEd25519(k) => hex::encode(k.0),
    }
}

/// Apply balance deltas to YottaDB.
/// 
/// Updates:
/// - ^Account(account_id, "balance") for native XLM
/// - ^Account(account_id, "trustlines", asset_key) for non-native assets
/// Apply balance deltas to YottaDB using a transaction (TP).
/// 
/// Updates:
/// - ^Account(account_id, "balance") for native XLM
/// - ^Account(account_id, "trustlines", asset_key) for non-native assets
pub fn apply_balance_updates(
    ctx: &Context,
    deltas: &[BalanceDelta],
    ledger_seq: i64,
) -> Result<usize, yottadb::YDBError> {
    if deltas.is_empty() {
        return Ok(0);
    }

    let mut updates = 0;
    // Use YottaDB TP for atomic batch updates
    ctx.tp(|_| {
        for delta in deltas {
            // Handle trustline markers (ChangeTrust operations)
            if delta.asset.starts_with("trustline:") {
                let asset_key = delta.asset.strip_prefix("trustline:").unwrap_or(&delta.asset);
                let mut code = asset_key.to_string();
                let mut issuer = String::new();
                
                if asset_key.contains(':') {
                    let parts: Vec<&str> = asset_key.split(':').collect();
                    if parts.len() >= 2 {
                        code = parts[0].to_string();
                        issuer = parts[1].to_string();
                    }
                }

                if delta.reason == "remove_trustline" {
                    let mut trustline_key = KeyContext::variable(ctx, "^Account");
                    trustline_key.push(delta.account_id.as_bytes().to_vec());
                    trustline_key.push(b"trustlines".to_vec());
                    trustline_key.push(code.as_bytes().to_vec());
                    if !issuer.is_empty() {
                        trustline_key.push(issuer.as_bytes().to_vec());
                    }
                    let _ = trustline_key.delete(yottadb::DeleteType::DelTree);
                } else {
                    let mut trustline_key = KeyContext::variable(ctx, "^Account");
                    trustline_key.push(delta.account_id.as_bytes().to_vec());
                    trustline_key.push(b"trustlines".to_vec());
                    trustline_key.push(code.as_bytes().to_vec());
                    if !issuer.is_empty() {
                        trustline_key.push(issuer.as_bytes().to_vec());
                    }
                    
                    let mut limit_key = trustline_key.clone();
                    limit_key.push(b"limit".to_vec());
                    let limit = delta.reason.strip_prefix("set_trustline_limit:")
                        .and_then(|s| s.parse::<i64>().ok())
                        .unwrap_or(0);
                    limit_key.set(limit.to_string().as_bytes())?;
                    
                    let mut balance_key = trustline_key.clone();
                    balance_key.push(b"balance".to_vec());
                    if balance_key.get().is_err() {
                        balance_key.set(b"0")?;
                    }
                }
                updates += 1;
                continue;
            }
            
            if delta.delta == 0 {
                continue;
            }
            
            if delta.asset == "native" {
                let mut balance_key = KeyContext::variable(ctx, "^Account");
                balance_key.push(delta.account_id.as_bytes().to_vec());
                balance_key.push(b"balance".to_vec());
                
                let current_balance: i64 = match balance_key.get() {
                    Ok(bytes) => {
                        let s = String::from_utf8_lossy(&bytes);
                        s.parse().unwrap_or(0)
                    }
                    Err(_) => 0,
                };
                
                let new_balance = current_balance + delta.delta;
                balance_key.set(new_balance.to_string().as_bytes())?;
                
                let mut modified_key = KeyContext::variable(ctx, "^Account");
                modified_key.push(delta.account_id.as_bytes().to_vec());
                modified_key.push(b"last_modified".to_vec());
                modified_key.set(ledger_seq.to_string().as_bytes())?;
                
                updates += 1;
            } else {
                let mut trustline_balance = KeyContext::variable(ctx, "^Account");
                trustline_balance.push(delta.account_id.as_bytes().to_vec());
                trustline_balance.push(b"trustlines".to_vec());
                
                if delta.asset.contains(':') {
                    let parts: Vec<&str> = delta.asset.split(':').collect();
                    if parts.len() >= 2 {
                        trustline_balance.push(parts[0].as_bytes().to_vec());
                        trustline_balance.push(parts[1].as_bytes().to_vec());
                    } else {
                        trustline_balance.push(delta.asset.as_bytes().to_vec());
                    }
                } else {
                    trustline_balance.push(delta.asset.as_bytes().to_vec());
                }
                
                trustline_balance.push(b"balance".to_vec());
                
                let current: i64 = match trustline_balance.get() {
                    Ok(bytes) => {
                        let s = String::from_utf8_lossy(&bytes);
                        s.parse().unwrap_or(0)
                    }
                    Err(_) => 0,
                };
                
                let new_balance = current + delta.delta;
                trustline_balance.set(new_balance.to_string().as_bytes())?;
                
                let mut modified_key = KeyContext::variable(ctx, "^Account");
                modified_key.push(delta.account_id.as_bytes().to_vec());
                modified_key.push(b"last_modified".to_vec());
                modified_key.set(ledger_seq.to_string().as_bytes())?;
                
                updates += 1;
            }
        }
        Ok(yottadb::TransactionStatus::Ok)
    }, "APPLY_BALANCES", &[]).map_err(|e| {
        yottadb::YDBError::from_str(&format!("{:?}", e))
    })?;

    Ok(updates)
}
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_asset_to_string_native() {
        assert_eq!(asset_to_string(&Asset::Native), "native");
    }
}
