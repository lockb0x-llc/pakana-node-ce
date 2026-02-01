package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"lang.yottadb.com/go/yottadb/v2"
)

type ValidationResponse struct {
	IsValid bool   `json:"isValid"`
	Param   string `json:"param,omitempty"`
	Message string `json:"message,omitempty"`
}

type Lockb0xRequest struct {
	PointerHash string `json:"pointer_hash"`
	URL         string `json:"url"`
	Description string `json:"description"`
	Provider    string `json:"provider"`
}

type Lockb0xResponse struct {
	Status    string `json:"status"`
	Hash      string `json:"hash"`
	Timestamp int64  `json:"timestamp"`
}

func CreateLockb0xDraft(w http.ResponseWriter, r *http.Request) {
	var req Lockb0xRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Basic Validation
	if req.PointerHash == "" || len(req.PointerHash) != 64 {
		sendError(w, "Invalid Pointer Hash (Must be SHA-256 hex)", http.StatusBadRequest)
		return
	}
	if req.URL == "" {
		sendError(w, "URL is required", http.StatusBadRequest)
		return
	}
	if len(req.Description) > 300 {
		sendError(w, "Description exceeds 300 characters", http.StatusBadRequest)
		return
	}

	ydbMu.Lock()
	defer ydbMu.Unlock()

	// Persist to ^Codex("draft", hash)
	success := ydbConn.Transaction("", nil, func() int {
		draftNode := ydbConn.Node("^Codex", "draft", req.PointerHash)
		
		// Check if already exists
		if draftNode.HasTree() || draftNode.HasValue() {
			return yottadb.YDB_OK // Idempotent success
		}

		draftNode.Child("url").Set(req.URL)
		draftNode.Child("description").Set(req.Description)
		draftNode.Child("provider").Set(req.Provider)
		draftNode.Child("status").Set("pending_tx")
		draftNode.Child("timestamp").Set(time.Now().Unix())
		
		return yottadb.YDB_OK
	})

	if !success {
		log.Printf("Error saving Lockb0x draft for hash %s", req.PointerHash)
		sendError(w, "Failed to save draft", http.StatusInternalServerError)
		return
	}

	sendJSON(w, Lockb0xResponse{
		Status:    "draft_saved",
		Hash:      req.PointerHash,
		Timestamp: time.Now().Unix(),
	})
}
