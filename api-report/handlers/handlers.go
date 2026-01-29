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

	// 2. Not found locally - Delegate Hydration to api-go (The Kernel)
	log.Printf("Account %s not found in YottaDB. Delegating hydration to api-go...", accountID)
	if err := delegateHydration(accountID); err != nil {
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
		if err := delegateHydration(accountID); err == nil {
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
		if err := delegateHydration(accountID); err == nil {
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

	ledger, err := fetchLedger(seq)
	if err != nil {
		sendError(w, err.Error(), http.StatusNotFound)
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

	tx, err := fetchTransaction(hash)
	if err != nil {
		sendError(w, err.Error(), http.StatusNotFound)
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

// delegateHydration calls api-go internal endpoint to fetch and persist data
func delegateHydration(accountID string) error {
	internalURL := "http://pakana-api-go:8081/internal/cache-account"
	body, _ := json.Marshal(map[string]string{"account_id": accountID})
	
	resp, err := http.Post(internalURL, "application/json", strings.NewReader(string(body)))
	if err != nil {
		return fmt.Errorf("failed to call api-go internal: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("api-go returned error: %d", resp.StatusCode)
	}

	// Give YottaDB a moment to sync cache if needed (though shared memory is instant)
	time.Sleep(100 * time.Millisecond)
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

	for assetNode := range root.Children() {
		assetCode := assetNode.Subscripts()[len(assetNode.Subscripts())-1]
		
		for issuerNode := range assetNode.Children() {
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

	// We have the ledger sequence, we can find the transaction
	ledgerNode := ydbConn.Node("^Stellar", "ledger", seqStr, "tx")
	for txSub := range ledgerNode.Children() {
		if txSub.Child("hash").Get("") == hash {
			lSeq, _ := strconv.ParseInt(seqStr, 10, 64)
			return &TransactionResponse{
				Hash:      hash,
				LedgerSeq: lSeq,
				XDR:       txSub.Child("xdr").Get(""),
			}, nil
		}
	}

	return nil, fmt.Errorf("transaction hash index exists but record missing")
}
