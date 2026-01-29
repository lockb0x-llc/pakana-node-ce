use log::{info, warn};
use std::env;
use std::thread;
use std::time::Duration;
use yottadb::{Context, KeyContext};
mod validator;
mod balance;

/// Pakana Core: Monitors Stellar activity in YottaDB and processes transitions
fn main() {
    println!("[DEBUG] Pakana Core-Rust starting...");
    
    env_logger::init();
    
    println!("[DEBUG] env_logger initialized");
    info!("Pakana Core-Rust Service Starting...");

    // Set YottaDB environment variables if not already set (fallback)
    if env::var("ydb_gbldir").is_err() {
        env::set_var("ydb_gbldir", "/data/r2.03_x86_64/g/yottadb.gld");
    }

    // Initialize YottaDB context
    let ctx = Context::new();
    info!("YottaDB initialized successfully");

    // Diagnostic Phase: Test ^Account writes
    {
        info!("Running diagnostic write tests...");
        
        // Test 1: Simple short key
        let mut account_key = KeyContext::variable(&ctx, "^Account");
        account_key.push(b"test_account".to_vec());
        account_key.push(b"balance".to_vec());
        match account_key.set(b"100") {
            Ok(_) => info!("Diagnostic 1: Write to ^Account(\"test_account\", \"balance\") succeeded"),
            Err(e) => warn!("Diagnostic 1: FAILED: {:?}", e),
        }

        // Test 2: Standard 64-char hex key (Simulating Stellar Account ID)
        let huge_id = "688ffbe725c48731383827d04222045508827725049363063517616670860888";
        let mut huge_key = KeyContext::variable(&ctx, "^Account");
        huge_key.push(huge_id.as_bytes().to_vec());
        huge_key.push(b"seq_num".to_vec());
        match huge_key.set(b"123") {
             Ok(_) => info!("Diagnostic 2: Write of 64-char key succeeded"),
             Err(e) => warn!("Diagnostic 2: FAILED: {:?}", e),
        }
    }

    let mut last_processed_ledger: i64 = 0;

    info!("Starting Stellar Ledger Monitor Loop...");

    loop {
        // Monitor ^Stellar("latest")
        let mut latest_key = KeyContext::variable(&ctx, "^Stellar");
        latest_key.push(b"latest".to_vec());
        
        match latest_key.get() {
            Ok(value_bytes) => {
                let sequence_str = String::from_utf8_lossy(&value_bytes).to_string();
                if let Ok(sequence) = sequence_str.parse::<i64>() {
                    if sequence > last_processed_ledger {
                        info!("✓ Detected new Stellar Ledger: {}", sequence);
                        
                        // Fetch ledger details: ^Stellar("ledger", sequence, "closed_at")
                        let mut ledger_key = KeyContext::variable(&ctx, "^Stellar");
                        ledger_key.push(b"ledger".to_vec());
                        ledger_key.push(sequence_str.as_bytes().to_vec());
                        
                        let mut closed_at_key = ledger_key.clone();
                        closed_at_key.push(b"closed_at".to_vec());

                        if let Ok(closed_at_bytes) = closed_at_key.get() {
                            let closed_at = String::from_utf8_lossy(&closed_at_bytes);
                            info!("  Closed at: {}", closed_at);
                        }

                        // Phase 3: Process all transactions in this ledger
                        process_ledger_transactions(&ctx, &sequence_str);

                        last_processed_ledger = sequence;
                    }
                }
            }
            Err(e) => {
                // Ignore "Node not found" errors as they are expected before first ingestion
                let err_str = format!("{:?}", e);
                if !err_str.contains("GVUNDEF") && !err_str.contains("LVUNDEF") {
                    warn!("Error reading ^Stellar(\"latest\"): {:?}", e);
                }
            }
        }

        thread::sleep(Duration::from_millis(500));
    }
}

/// Process all transactions in a given ledger by iterating ^Stellar("ledger", seq, "tx", *)
fn process_ledger_transactions(ctx: &Context, sequence_str: &str) {
    let mut tx_count = 0;
    let mut tx_idx = 0;
    let ledger_seq: i64 = sequence_str.parse().unwrap_or(0);

    loop {
        let idx_str = format!("{}", tx_idx);
        
        // Try to read ^Stellar("ledger", seq, "tx", idx, "xdr")
        let mut xdr_key = KeyContext::variable(ctx, "^Stellar");
        xdr_key.push(b"ledger".to_vec());
        xdr_key.push(sequence_str.as_bytes().to_vec());
        xdr_key.push(b"tx".to_vec());
        xdr_key.push(idx_str.as_bytes().to_vec());
        xdr_key.push(b"xdr".to_vec());

        match xdr_key.get() {
            Ok(xdr_bytes) => {
                let xdr_base64 = String::from_utf8_lossy(&xdr_bytes);
                
                // Decode and validate the transaction
                match validator::decode_envelope(&xdr_base64) {
                    Ok(envelope) => {
                        // Validate basic structure
                        match validator::validate_transaction(&envelope) {
                            Ok(_) => {
                                // Extract source account and sequence number
                                let source_account = validator::extract_source_account(&envelope);
                                let seq_num = validator::extract_seq_num(&envelope);

                                // Update ^Account(source_account, "seq_num") = seq_num
                                if let Err(e) = update_account_state(ctx, &source_account, seq_num) {
                                    warn!("  Error updating account {}: {:?}", &source_account[..8], e);
                                } else {
                                    info!("  ✓ Updated Account {}... sequence to {}", &source_account[..12.min(source_account.len())], seq_num);
                                }

                                // Phase 4: Calculate and apply balance deltas
                                let deltas = balance::calculate_balance_deltas(&envelope);
                                match balance::apply_balance_updates(ctx, &deltas, ledger_seq) {
                                    Ok(count) => {
                                        if count > 0 {
                                            info!("  💰 Applied {} balance updates", count);
                                        }
                                    }
                                    Err(e) => warn!("  Error applying balance updates: {:?}", e),
                                }
                            }
                            Err(e) => warn!("  Transaction {} validation failed: {:?}", tx_idx, e),
                        }
                    }
                    Err(e) => warn!("  Failed to decode XDR for tx {}: {:?}", tx_idx, e),
                }
                
                tx_count += 1;
                tx_idx += 1;
            }
            Err(_) => {
                // No more transactions at this index
                break;
            }
        }
    }

    if tx_count > 0 {
        info!("  Processed {} transactions for ledger {}", tx_count, sequence_str);
    }
}

/// Update account state in YottaDB using a transaction (TP): ^Account(account_id, "seq_num") = seq_num
fn update_account_state(ctx: &Context, account_id: &str, seq_num: i64) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    ctx.tp(|_t_ctx| {
        let mut account_key = KeyContext::variable(ctx, "^Account");
        account_key.push(account_id.as_bytes().to_vec());
        account_key.push(b"seq_num".to_vec());
        
        let seq_str = format!("{}", seq_num);
        account_key.set(seq_str.as_bytes())?;
        
        Ok(yottadb::TransactionStatus::Ok)
    }, "UPDATE_SEQ", &[])?;
    
    Ok(())
}
