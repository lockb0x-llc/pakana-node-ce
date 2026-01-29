package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/stellar/go/clients/horizonclient"
	"lang.yottadb.com/go/yottadb/v2"
)

var hzClient *horizonclient.Client
var ydbConn *yottadb.Conn

// InitYDB initializes the YottaDB connection for the reporting API
func InitYDB(conn *yottadb.Conn) {
	// Initialize YottaDB connection
	gbldir := os.Getenv("ydb_gbldir")
	if gbldir == "" {
		gbldir = "/data/r2.03_x86_64/g/yottadb.gld"
	}
	os.Setenv("ydb_gbldir", gbldir)

	ydbConn = conn
	log.Printf("YottaDB v2 initialized in handlers with gbldir: %s", gbldir)
}

// InitHorizon initializes the Horizon client
func InitHorizon() {
	horizonURL := os.Getenv("HORIZON_URL")
	if horizonURL == "" {
		horizonURL = "https://horizon-testnet.stellar.org"
	}
	hzClient = &horizonclient.Client{
		HorizonURL: horizonURL,
		HTTP:       &http.Client{Timeout: 30 * time.Second},
	}
	log.Printf("Horizon client initialized with URL: %s", horizonURL)
}

// SetHorizonURL updates the Horizon client to use a specific URL
func SetHorizonURL(url string) {
	hzClient = &horizonclient.Client{
		HorizonURL: url,
		HTTP:       &http.Client{Timeout: 10 * time.Second},
	}
}

// AccountResponse represents an account's data
type AccountResponse struct {
	AccountID    string              `json:"account_id"`
	Balance      string              `json:"balance"`
	BalanceXLM   string              `json:"balance_xlm"`
	SeqNum       int64               `json:"seq_num"`
	LastModified int64               `json:"last_modified"`
	Trustlines   []TrustlineResponse `json:"trustlines,omitempty"`
}

type TrustlineResponse struct {
	Asset   string `json:"asset"`
	Balance string `json:"balance"`
	Limit   string `json:"limit,omitempty"`
}

type LedgerResponse struct {
	Sequence int64  `json:"sequence"`
	ClosedAt string `json:"closed_at"`
	TxCount  int    `json:"tx_count"`
}

type TransactionResponse struct {
	Hash      string `json:"hash"`
	LedgerSeq int64  `json:"ledger_seq"`
	XDR       string `json:"xdr,omitempty"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

func HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "healthy",
		"service": "pakana-api-report",
	})
}

func GetAccount(w http.ResponseWriter, r *http.Request) {
	accountID := getPathVar(r, "id")
	if accountID == "" {
		sendError(w, "Account ID required", http.StatusBadRequest)
		return
	}

	// 1. Try to fetch locally (Read-Only)
	account, err := fetchAccount(accountID, true)
	if err == nil {
		sendJSON(w, account)
		return
	}

	// 2. Not found locally - Perform Native Hydration
	log.Printf("Account %s not found in YottaDB. Performing native hydration...", accountID)
	if err := hydrateAccount(accountID); err != nil {
		sendError(w, fmt.Sprintf("Hydration failed: %v", err), http.StatusNotFound)
		return
	}

	// 3. Retry local fetch after hydration
	account, err = fetchAccount(accountID, true)
	if err != nil {
		sendError(w, "Account not found after hydration", http.StatusNotFound)
		return
	}

	sendJSON(w, account)
}

func GetAccountBalance(w http.ResponseWriter, r *http.Request) {
	accountID := getPathVar(r, "id")
	if accountID == "" {
		sendError(w, "Account ID required", http.StatusBadRequest)
		return
	}

	account, err := fetchAccount(accountID, false)
	if err != nil {
		// Try hydration if not found
		if err := hydrateAccount(accountID); err == nil {
			account, err = fetchAccount(accountID, false)
		}
	}

	if err != nil {
		sendError(w, err.Error(), http.StatusNotFound)
		return
	}

	sendJSON(w, map[string]interface{}{
		"account_id":  account.AccountID,
		"balance":     account.Balance,
		"balance_xlm": account.BalanceXLM,
	})
}

func GetAccountTrustlines(w http.ResponseWriter, r *http.Request) {
	accountID := getPathVar(r, "id")
	if accountID == "" {
		sendError(w, "Account ID required", http.StatusBadRequest)
		return
	}

	trustlines, err := fetchTrustlines(accountID)
	if err != nil || len(trustlines) == 0 {
		// Try hydration
		if err := hydrateAccount(accountID); err == nil {
			trustlines, _ = fetchTrustlines(accountID)
		}
	}

	sendJSON(w, map[string]interface{}{
		"account_id": accountID,
		"trustlines": trustlines,
	})
}

func GetLatestLedger(w http.ResponseWriter, r *http.Request) {
	ledger, err := fetchLatestLedger()
	if err != nil {
		sendError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	sendJSON(w, ledger)
}

func GetLedger(w http.ResponseWriter, r *http.Request) {
	seqStr := getPathVar(r, "seq")
	seq, err := strconv.ParseInt(seqStr, 10, 64)
	if err != nil {
		sendError(w, "Invalid ledger sequence", http.StatusBadRequest)
		return
	}

	// 1. Try local
	ledger, err := fetchLedger(seq)
	if err == nil {
		sendJSON(w, ledger)
		return
	}

	// 2. Hydrate
	log.Printf("Ledger %d not found locally. Fetching from Horizon...", seq)
	if err := hydrateLedger(seq); err != nil {
		sendError(w, fmt.Sprintf("Ledger hydration failed: %v", err), http.StatusNotFound)
		return
	}

	// 3. Retry local
	ledger, err = fetchLedger(seq)
	if err != nil {
		sendError(w, "Ledger not found after hydration", http.StatusNotFound)
		return
	}

	sendJSON(w, ledger)
}

func GetTransaction(w http.ResponseWriter, r *http.Request) {
	hash := getPathVar(r, "hash")
	if hash == "" {
		sendError(w, "Transaction hash required", http.StatusBadRequest)
		return
	}

	// 1. Try local
	tx, err := fetchTransaction(hash)
	if err == nil {
		sendJSON(w, tx)
		return
	}

	// 2. Hydrate
	log.Printf("Transaction %s not found locally. Fetching from Horizon...", hash)
	if err := hydrateTransaction(hash); err != nil {
		sendError(w, fmt.Sprintf("Transaction hydration failed: %v", err), http.StatusNotFound)
		return
	}

	// 3. Retry local
	tx, err = fetchTransaction(hash)
	if err != nil {
		sendError(w, "Transaction not found after hydration", http.StatusNotFound)
		return
	}

	sendJSON(w, tx)
}

func getPathVar(r *http.Request, key string) string {
	path := r.URL.Path
	parts := strings.Split(path, "/")

	switch key {
	case "id":
		if len(parts) >= 5 && parts[3] == "accounts" {
			return parts[4]
		}
	case "seq":
		if len(parts) >= 5 && parts[3] == "ledgers" {
			return parts[4]
		}
	case "hash":
		if len(parts) >= 5 && parts[3] == "transactions" {
			return parts[4]
		}
	}
	return ""
}

func sendJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func sendError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(ErrorResponse{Error: message})
}

// hydrateAccount fetches account data from Horizon and persists to YottaDB using a transaction
func hydrateAccount(accountID string) error {
	// 1. Fetch from Horizon
	accountReq := horizonclient.AccountRequest{AccountID: accountID}
	hAccount, err := hzClient.AccountDetail(accountReq)
	if err != nil {
		return fmt.Errorf("horizon error: %v", err)
	}

	// 2. Persist to YottaDB via Transaction (Atomic write)
	ok := ydbConn.Transaction("", nil, func() int {
		accountNode := ydbConn.Node("^Account", accountID)

		// Store balances
		for _, bal := range hAccount.Balances {
			if bal.Asset.Type == "native" {
				accountNode.Child("balance").Set(bal.Balance)
			} else {
				assetCode := bal.Asset.Code
				if assetCode == "" {
					assetCode = bal.Asset.Type
				}
				// ^Account(id, "trustlines", code, issuer, "balance")
				accountNode.Child("trustlines", assetCode, bal.Issuer, "balance").Set(bal.Balance)
				accountNode.Child("trustlines", assetCode, bal.Issuer, "limit").Set(bal.Limit)
			}
		}
		accountNode.Child("seq_num").Set(hAccount.Sequence)
		accountNode.Child("last_modified").Set(time.Now().Unix())

		// Mark as Tracked for Sparse History
		ydbConn.Node("^Tracked", accountID).Set("1")

		return yottadb.YDB_OK
	})

	if !ok {
		return fmt.Errorf("yottadb transaction failed")
	}

	log.Printf("Successfully hydrated account %s (Seq: %d)", accountID, hAccount.Sequence)
	return nil
}

// hydrateLedger fetches a ledger from Horizon and persists to YottaDB
func hydrateLedger(seq int64) error {
	hLedger, err := hzClient.LedgerDetail(uint32(seq))
	if err != nil {
		return fmt.Errorf("horizon error: %v", err)
	}

	seqStr := strconv.FormatInt(seq, 10)
	ok := ydbConn.Transaction("", nil, func() int {
		ledgerNode := ydbConn.Node("^Stellar", "ledger", seqStr)
		ledgerNode.Child("closed_at").Set(hLedger.ClosedAt.String())

		// We don't hydrate all transactions for a ledger by default to save space,
		// but we update the latest pointer if this is newer
		latestSeqStr := ydbConn.Node("^Stellar", "latest").Get("0")
		latestSeq, _ := strconv.ParseInt(latestSeqStr, 10, 64)
		if seq > latestSeq {
			ydbConn.Node("^Stellar", "latest").Set(seqStr)
		}

		return yottadb.YDB_OK
	})

	if !ok {
		return fmt.Errorf("yottadb transaction failed")
	}

	return nil
}

// hydrateTransaction fetches a transaction from Horizon and persists to YottaDB
func hydrateTransaction(hash string) error {
	hTx, err := hzClient.TransactionDetail(hash)
	if err != nil {
		return fmt.Errorf("horizon error: %v", err)
	}

	seqStr := strconv.FormatInt(int64(hTx.Ledger), 10)
	ok := ydbConn.Transaction("", nil, func() int {
		// Store transaction in the ledger tree
		// We need an index since we store by position usually.
		// For hydration, we'll use the hash directly as a key under tx if it's missing,
		// or find a slot.
		
		// Actually, let's just use the hash index directly and store it.
		ydbConn.Node("^Stellar", "tx_hash", hash).Set(seqStr)
		
		// Find a slot or use a special hydration slot
		txNode := ydbConn.Node("^Stellar", "ledger", seqStr, "tx", "hydrated", hash)
		txNode.Child("xdr").Set(hTx.EnvelopeXdr)
		txNode.Child("hash").Set(hash)

		return yottadb.YDB_OK
	})

	if !ok {
		return fmt.Errorf("yottadb transaction failed")
	}

	return nil
}

func fetchAccount(accountID string, includeTrustlines bool) (*AccountResponse, error) {
	node := ydbConn.Node("^Account", accountID)

	// Check if account exists
	if !node.HasTree() && !node.HasValue() {
		return nil, fmt.Errorf("account not found locally")
	}

	balance := node.Child("balance").Get("0")
	seqNumStr := node.Child("seq_num").Get("0")
	lastModStr := node.Child("last_modified").Get("0")

	seqNum, _ := strconv.ParseInt(seqNumStr, 10, 64)
	lastMod, _ := strconv.ParseInt(lastModStr, 10, 64)

	// In CE, if it's not stroops, try to parse it.
	// We'll normalize to XLM display
	var balanceXLM string
	if len(balance) > 7 {
		// simple stroop to XLM conversion for display
		fBal, _ := strconv.ParseFloat(balance, 64)
		balanceXLM = fmt.Sprintf("%.7f", fBal/10000000.0)
	} else {
		balanceXLM = balance
	}

	response := &AccountResponse{
		AccountID:    accountID,
		Balance:      balance,
		BalanceXLM:   balanceXLM,
		SeqNum:       seqNum,
		LastModified: lastMod,
	}

	if includeTrustlines {
		trustlines, _ := fetchTrustlines(accountID)
		response.Trustlines = trustlines
	}

	return response, nil
}

func fetchTrustlines(accountID string) ([]TrustlineResponse, error) {
	var trustlines []TrustlineResponse

	// Standard Schema: ^Account(id, "trustlines", code, issuer, "balance")
	root := ydbConn.Node("^Account", accountID, "trustlines")
	if !root.HasTree() {
		return nil, nil
	}

	// v2 Children() uses a mutable node. Clone them to avoid corruption in nested loops.
	for assetNodeMutable := range root.Children() {
		assetNode := assetNodeMutable.Clone()
		assetCode := assetNode.Subscripts()[len(assetNode.Subscripts())-1]
		
		for issuerNodeMutable := range assetNode.Children() {
			issuerNode := issuerNodeMutable.Clone()
			issuer := issuerNode.Subscripts()[len(issuerNode.Subscripts())-1]
			balance := issuerNode.Child("balance").Get("0")
			limit := issuerNode.Child("limit").Get("")

			trustlines = append(trustlines, TrustlineResponse{
				Asset:   assetCode + ":" + issuer,
				Balance: balance,
				Limit:   limit,
			})
		}
	}

	return trustlines, nil
}

func fetchLatestLedger() (*LedgerResponse, error) {
	// Root latest pointer
	latestSeqStr := ydbConn.Node("^Stellar", "latest").Get("")
	if latestSeqStr == "" {
		return nil, fmt.Errorf("no ledgers found")
	}

	seq, _ := strconv.ParseInt(latestSeqStr, 10, 64)
	return fetchLedger(seq)
}

func fetchLedger(seq int64) (*LedgerResponse, error) {
	seqStr := strconv.FormatInt(seq, 10)
	ledgerNode := ydbConn.Node("^Stellar", "ledger", seqStr)

	closedAt := ledgerNode.Child("closed_at").Get("")
	if closedAt == "" {
		return nil, fmt.Errorf("ledger %d not found", seq)
	}

	txCount := 0
	for range ledgerNode.Child("tx").Children() {
		txCount++
	}

	return &LedgerResponse{
		Sequence: seq,
		ClosedAt: closedAt,
		TxCount:  txCount,
	}, nil
}

func fetchTransaction(hash string) (*TransactionResponse, error) {
	// 1. Try Direct Index Lookup: ^Stellar("tx_hash", hash) = ledger_seq
	seqStr := ydbConn.Node("^Stellar", "tx_hash", hash).Get("")

	if seqStr == "" {
		return nil, fmt.Errorf("transaction not found locally")
	}

	// 2. Try the normal ledger index (pos)
	lSeq, _ := strconv.ParseInt(seqStr, 10, 64)
	ledgerNode := ydbConn.Node("^Stellar", "ledger", seqStr, "tx")
	for txSub := range ledgerNode.Children() {
		if txSub.Child("hash").Get("") == hash {
			return &TransactionResponse{
				Hash:      hash,
				LedgerSeq: lSeq,
				XDR:       txSub.Child("xdr").Get(""),
			}, nil
		}
	}

	// 3. Try the hydrated slot
	hydratedNode := ydbConn.Node("^Stellar", "ledger", seqStr, "tx", "hydrated", hash)
	if hydratedNode.HasTree() || hydratedNode.HasValue() {
		return &TransactionResponse{
			Hash:      hash,
			LedgerSeq: lSeq,
			XDR:       hydratedNode.Child("xdr").Get(""),
		}, nil
	}

	return nil, fmt.Errorf("transaction hash index exists but record missing")
}
