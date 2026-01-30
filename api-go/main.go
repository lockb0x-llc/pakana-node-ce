package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/stellar/go/clients/horizonclient"
	"github.com/stellar/go/protocols/horizon"
	"lang.yottadb.com/go/yottadb/v2"
)

// Pakana Ingestor: Streams ledgers from Stellar and persists to YottaDB
func main() {
	log.Println("Pakana API-Go Service Starting...")

	// Initialize YottaDB (Standard v2 pattern)
	defer yottadb.Shutdown(yottadb.MustInit())
	conn := yottadb.NewConn()

	// Initialize BlockList
	initBlockList()

	// 1. Steel Thread PoC Verification (Heartbeat)
	timestampStr := fmt.Sprintf("%d", time.Now().Unix())
	conn.Node("^Ledger", "timestamp").Set(timestampStr)

	// 2. Stellar Ingestion Logic
	horizonURL := os.Getenv("HORIZON_URL")
	if horizonURL == "" {
		horizonURL = "https://horizon-testnet.stellar.org"
	}
	client := &horizonclient.Client{
		HorizonURL: horizonURL,
		HTTP:       &http.Client{},
	}
	log.Printf("Horizon client initialized with URL: %s", horizonURL)

	// Start Internal API Server for On-Demand Hydration
	StartInternalServer(conn, client)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	request := horizonclient.LedgerRequest{Cursor: "now"}

	log.Println("Starting Stellar Ledger Ingestion Stream...")

	// Stream ledgers
	err := client.StreamLedgers(ctx, request, func(ledger horizon.Ledger) {
		log.Printf("Ingested Stellar Ledger: %d (Closed at: %s)", ledger.Sequence, ledger.ClosedAt)

		seqStr := fmt.Sprintf("%d", ledger.Sequence)

		// 1. Fetch transactions first (Outside TP to keep txn window small)
		txCount, txs, txErr := fetchTransactions(client, ledger.Sequence)
		if txErr != nil {
			log.Printf("Error fetching transactions for ledger %d: %v", ledger.Sequence, txErr)
			return
		}

		// 2. Atomic Write Block
		ok := conn.Transaction("", nil, func() int {
			// Write Header
			ledgerNode := conn.Node("^Stellar", "ledger", seqStr)
			ledgerNode.Child("closed_at").Set(ledger.ClosedAt.String())
			ledgerNode.Child("total_tx_count").Set(txCount)

			filteredCount := 0
			// Write Transactions
			for i, tx := range txs {
				// Sparse History Filter: REMOVED. Ingest everything.
				// Core-Rust will filter for tracks.

				filteredCount++
				idxStr := fmt.Sprintf("%d", i)
				txNode := ledgerNode.Child("tx", idxStr)
				txNode.Child("xdr").Set(tx.EnvelopeXdr)
				txNode.Child("hash").Set(tx.Hash)

				// Index Hash -> Ledger Sequence (For Gap Detection)
				conn.Node("^Stellar", "tx_hash", tx.Hash).Set(seqStr)
			}

			// Store the filtered count
			ledgerNode.Child("filtered_tx_count").Set(filteredCount)

			// Update ^Stellar("latest") = sequence (The atomic commit pointer)
			conn.Node("^Stellar", "latest").Set(seqStr)

			return yottadb.YDB_OK
		})

		if !ok {
			log.Printf("CRITICAL: Transaction failed for ledger %d", ledger.Sequence)
		} else {
			log.Printf("✓ Committed Ledger %d (%d txs processed)", ledger.Sequence, txCount)
		}
	})

	if err != nil {
		log.Fatalf("Stellar StreamLedgers error: %v", err)
	}

	select {}
}

// fetchTransactions fetches all transactions for a given ledger sequence
func fetchTransactions(client *horizonclient.Client, ledgerSeq int32) (int, []horizon.Transaction, error) {
	txRequest := horizonclient.TransactionRequest{
		ForLedger: uint(ledgerSeq),
		Limit:     200,
	}

	txPage, err := client.Transactions(txRequest)
	if err != nil {
		return 0, nil, fmt.Errorf("failed to fetch transactions: %w", err)
	}

	return len(txPage.Embedded.Records), txPage.Embedded.Records, nil
}
