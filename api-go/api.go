package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/stellar/go-stellar-sdk/clients/horizonclient"
	"lang.yottadb.com/go/yottadb/v2"
)

// BlockList holds the set of blocked account IDs
var BlockList = make(map[string]bool)

func initBlockList() {
	blockListEnv := os.Getenv("BLOCK_LIST")
	if blockListEnv == "" {
		return
	}
	ids := strings.Split(blockListEnv, ",")
	for _, id := range ids {
		trimmed := strings.TrimSpace(id)
		if trimmed != "" {
			BlockList[trimmed] = true
			log.Printf("Blocked configuration loaded for account: %s", trimmed)
		}
	}
}

func isBlocked(accountID string) bool {
	return BlockList[accountID]
}

// StartInternalServer starts the internal HTTP server for hydration requests
func StartInternalServer(conn *yottadb.Conn, client *horizonclient.Client) {
	http.HandleFunc("/internal/cache-account", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			AccountID string `json:"account_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		log.Printf("Received hydration request for account: %s", req.AccountID)

		// Debug logging for request tracing
		fmt.Printf("[DEBUG] Processing hydration for: %s\n", req.AccountID)

		// 1. Fetch from Horizon
		accountReq := horizonclient.AccountRequest{AccountID: req.AccountID}
		hAccount, err := client.AccountDetail(accountReq)
		if err != nil {
			log.Printf("Error fetching account %s from Horizon: %v", req.AccountID, err)
			fmt.Printf("[DEBUG] Horizon fetch failed for %s: %v\n", req.AccountID, err)
			http.Error(w, fmt.Sprintf("Horizon error: %v", err), http.StatusBadGateway)
			return
		}
		fmt.Printf("[DEBUG] Successfully fetched account %s from Horizon (Seq: %d)\n", req.AccountID, hAccount.Sequence)

		// 2. Persist to YottaDB (Hydrate)
		// Use a transaction for atomicity
		ok := conn.Transaction("", nil, func() int {
			// Store balances
			for _, bal := range hAccount.Balances {
				if bal.Asset.Type == "native" {
					conn.Node("^Account", req.AccountID, "balance").Set(bal.Balance)
				} else {
					assetCode := bal.Asset.Code
					if assetCode == "" {
						assetCode = bal.Asset.Type // fallback
					}
					// Standardized Schema: ^Account(req.AccountID, "trustlines", code, issuer, "balance")
					conn.Node("^Account", req.AccountID, "trustlines", assetCode, bal.Issuer, "balance").Set(bal.Balance)
					conn.Node("^Account", req.AccountID, "trustlines", assetCode, bal.Issuer, "limit").Set(bal.Limit)
				}
			}
			conn.Node("^Account", req.AccountID, "seq_num").Set(hAccount.Sequence)

			// Mark as Tracked for Sparse History
			conn.Node("^Tracked", req.AccountID).Set("1")

			return yottadb.YDB_OK
		})

		if !ok {
			log.Printf("ERROR: Hydration transaction failed for account %s", req.AccountID)
			http.Error(w, "Hydration failed", http.StatusInternalServerError)
			return
		}

		log.Printf("Hydrated account %s (Seq: %d)", req.AccountID, hAccount.Sequence)

		// 3. Gap Detection & Backfill (Robust Hydration)
		go backfillHistory(conn, client, req.AccountID)

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"hydrated"}`))
	})

	log.Println("INTERNAL API STARTING ON :8081...")
	go func() {
		if err := http.ListenAndServe(":8081", nil); err != nil {
			log.Fatalf("INTERNAL SERVER CRASHED: %v", err)
		}
	}()
}

func backfillHistory(conn *yottadb.Conn, client *horizonclient.Client, accountID string) {
	log.Printf("Starting history backfill for %s...", accountID)

	cursor := "now"
	count := 0
	maxTx := 1000 // Safety limit for Community Node

	for {
		if count >= maxTx {
			log.Printf("Backfill limit reached (%d txs) for %s", maxTx, accountID)
			break
		}

		txReq := horizonclient.TransactionRequest{
			ForAccount: accountID,
			Order:      horizonclient.OrderDesc,
			Limit:      200,
			Cursor:     cursor,
		}

		page, err := client.Transactions(txReq)
		if err != nil {
			log.Printf("Error backfilling history for %s: %v", accountID, err)
			return
		}

		if len(page.Embedded.Records) == 0 {
			log.Printf("Backfill complete for %s (End of history)", accountID)
			break
		}

		for _, tx := range page.Embedded.Records {
			// Check if we already have this tx
			// Using the index we added in main.go: ^Stellar("tx_hash", hash)
			if conn.Node("^Stellar", "tx_hash", tx.Hash).HasValue() {
				log.Printf("Backfill overlap found at tx %s. Stopping.", tx.Hash)
				return
			}

			// Persist
			seqStr := fmt.Sprintf("%d", tx.Ledger)
			idxStr := "0" // We don't know the exact index within ledger easily here without parsing logic, using 0 for cache
			// Wait, main.go uses a counter. Here we are inserting potentially out of order or duplicating index 0.
			// Ideally we should query the ledger node to find the next index.
			// But for "Community" cache, maybe we just store passing "999" or hash-based?
			// Better to use a hash-based index or just increment.
			// Let's use a high number + loop to find generic slot?
			// Or just simple scan for next slot.

			txRoot := conn.Node("^Stellar", "ledger", seqStr, "tx")
			nextIdx := 0
			for range txRoot.Children() {
				nextIdx++
			}
			idxStr = fmt.Sprintf("%d", nextIdx) // Append mode

			txNode := conn.Node("^Stellar", "ledger", seqStr, "tx", idxStr)
			txNode.Child("xdr").Set(tx.EnvelopeXdr)
			txNode.Child("hash").Set(tx.Hash)

			// Update Index
			conn.Node("^Stellar", "tx_hash", tx.Hash).Set(seqStr)

			count++
			cursor = tx.PagingToken()
		}
	}
}
