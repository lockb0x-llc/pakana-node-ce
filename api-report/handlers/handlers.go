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

	account, err := fetchAccount(accountID, true)
	if err != nil {
		sendError(w, err.Error(), http.StatusNotFound)
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
	if err != nil {
		sendError(w, err.Error(), http.StatusNotFound)
		return
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

func fetchAccount(accountID string, includeTrustlines bool) (*AccountResponse, error) {
	node := ydbConn.Node("^Account", accountID)

	// Check if account exists
	if !node.HasTree() && !node.HasValue() {
		return fetchAccountFromHorizon(accountID, includeTrustlines)
	}

	balance := node.Child("balance").Get("0")
	seqNumStr := node.Child("seq_num").Get("0")
	lastModStr := node.Child("last_modified").Get("0")

	seqNum, _ := strconv.ParseInt(seqNumStr, 10, 64)
	lastMod, _ := strconv.ParseInt(lastModStr, 10, 64)

	balanceVal, _ := strconv.ParseFloat(balance, 64)
	balanceXLM := fmt.Sprintf("%.7f", balanceVal)

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

func fetchAccountFromHorizon(accountID string, includeTrustlines bool) (*AccountResponse, error) {
	log.Printf("Account %s not found locally. Requesting hydration from api-go...", accountID)

	// Delegate to api-go for persistence (On-Demand Hydration)
	if err := requestAccountHydration(accountID); err != nil {
		return nil, fmt.Errorf("failed to hydrate account via api-go: %v", err)
	}

	// Retry local lookup (Give YottaDB a moment to sync via shared memory? It should be instant with host IPC)
	// We call the local fetch logic directly to avoid infinite recursion
	node := ydbConn.Node("^Account", accountID)
	if !node.HasTree() && !node.HasValue() {
		return nil, fmt.Errorf("account not found after hydration attempt")
	}

	// Re-use logic from fetchAccount but without the fallback
	balance := node.Child("balance").Get("0")
	seqNumStr := node.Child("seq_num").Get("0")
	lastModStr := node.Child("last_modified").Get("0")

	seqNum, _ := strconv.ParseInt(seqNumStr, 10, 64)
	lastMod, _ := strconv.ParseInt(lastModStr, 10, 64)

	balanceVal, _ := strconv.ParseFloat(balance, 64)
	balanceXLM := fmt.Sprintf("%.7f", balanceVal)

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

func requestAccountHydration(accountID string) error {
	// Internal API call to api-go
	url := "http://api-go:8081/internal/cache-account"
	payload := fmt.Sprintf(`{"account_id": "%s"}`, accountID)

	resp, err := http.Post(url, "application/json", strings.NewReader(payload))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("api-go returned status: %s", resp.Status)
	}
	return nil
}

func fetchTrustlines(accountID string) ([]TrustlineResponse, error) {
	var trustlines []TrustlineResponse

	// Manual iteration using Next() to avoid Children() crash
	// Start at ^Account(acc, "trustlines", "")
	curr := ydbConn.Node("^Account", accountID, "trustlines", "").Next()

	for curr != nil {
		subs := curr.Subscripts()
		if len(subs) < 4 {
			break // Should not happen if data is structured correctly
		}
		asset := subs[3]

		// Use ydbConn.Node directly to stay safe
		balance := ydbConn.Node("^Account", accountID, "trustlines", asset, "balance").Get("0")
		limit := ydbConn.Node("^Account", accountID, "trustlines", asset, "limit").Get("")

		trustlines = append(trustlines, TrustlineResponse{
			Asset:   asset,
			Balance: balance,
			Limit:   limit,
		})

		curr = curr.Next()
	}

	return trustlines, nil
}

func fetchLatestLedger() (*LedgerResponse, error) {
	// Root latest pointer
	latestSeqStr := ydbConn.Node("^Stellar", "latest").Get("")
	if latestSeqStr == "" {
		// Fallback: Scan last 10 ledgers manually if pointer is missing
		var latestSeq int64 = 0
		for sub := range ydbConn.Node("^Stellar", "ledger").Children() {
			s := sub.Subscripts()[len(sub.Subscripts())-1]
			seq, _ := strconv.ParseInt(s, 10, 64)
			if seq > latestSeq {
				latestSeq = seq
			}
		}
		if latestSeq == 0 {
			return nil, fmt.Errorf("no ledgers found")
		}
		latestSeqStr = strconv.FormatInt(latestSeq, 10)
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
	// inefficient scan (latest 100 ledgers)
	ledgerRoot := ydbConn.Node("^Stellar", "ledger")

	count := 0
	for ledgerSub := range ledgerRoot.ChildrenBackward() {
		if count > 100 {
			break
		}
		count++

		for txSub := range ledgerSub.Child("tx").Children() {
			if txSub.Child("hash").Get("") == hash {
				lSeq, _ := strconv.ParseInt(ledgerSub.Subscripts()[len(ledgerSub.Subscripts())-1], 10, 64)
				return &TransactionResponse{
					Hash:      hash,
					LedgerSeq: lSeq,
					XDR:       txSub.Child("xdr").Get(""),
				}, nil
			}
		}
	}

	return nil, fmt.Errorf("transaction not found")
}
