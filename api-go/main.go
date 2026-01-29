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

		// Write ledger header: ^Stellar("ledger", sequence, "closed_at")
		conn.Node("^Stellar", "ledger", seqStr, "closed_at").Set(ledger.ClosedAt.String())

		// Phase 3: Fetch transactions for this ledger
		txCount, txErr := fetchAndPersistTransactions(conn, client, ledger.Sequence)
		if txErr != nil {
			log.Printf("Error fetching transactions for ledger %d: %v", ledger.Sequence, txErr)
		} else {
			log.Printf("  Wrote %d transactions for ledger %d", txCount, ledger.Sequence)
		}

		// Update ^Stellar("latest") = sequence (AFTER transactions are written)
		conn.Node("^Stellar", "latest").Set(seqStr)
	})

	if err != nil {
		log.Fatalf("Stellar StreamLedgers error: %v", err)
	}

	select {}
}

// fetchAndPersistTransactions fetches all transactions for a given ledger sequence
// and persists them to YottaDB as ^Stellar("ledger", seq, "tx", idx, "xdr"|"hash")
func fetchAndPersistTransactions(conn *yottadb.Conn, client *horizonclient.Client, ledgerSeq int32) (int, error) {
	seqStr := fmt.Sprintf("%d", ledgerSeq)

	txRequest := horizonclient.TransactionRequest{
		ForLedger: uint(ledgerSeq),
		Limit:     200,
	}

	txPage, err := client.Transactions(txRequest)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch transactions: %w", err)
	}

	txCount := 0
	for _, tx := range txPage.Embedded.Records {
		// Check BlockList
		if isBlocked(tx.Account) {
			log.Printf("Skipping blocked transaction from %s", tx.Account)
			continue
		}

		idxStr := fmt.Sprintf("%d", txCount)

		// Base node: ^Stellar("ledger", seq, "tx", idx)
		txNode := conn.Node("^Stellar", "ledger", seqStr, "tx", idxStr)

		// Write XDR
		txNode.Child("xdr").Set(tx.EnvelopeXdr)

		// Write Hash
		txNode.Child("hash").Set(tx.Hash)

		// Index Hash -> Ledger Sequence (For Gap Detection)
		conn.Node("^Stellar", "tx_hash", tx.Hash).Set(seqStr)

		txCount++
	}

	return txCount, nil
}
