package main

import (
	"context"
	"embed"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"api-report/handlers"

	"github.com/gorilla/mux"
	"lang.yottadb.com/go/yottadb/v2"
)

//go:embed all:dashboard/dist
var staticFiles embed.FS

func main() {
	log.Println("Starting Pakana Reporting API...")

	// Initialize YottaDB (Standard v2 pattern)
	defer yottadb.Shutdown(yottadb.MustInit())
	conn := yottadb.NewConn()
	handlers.InitYDB(conn)
	handlers.InitHorizon()

	// Get API key from environment
	apiKey := os.Getenv("API_KEY")
	if apiKey == "" {
		log.Fatal("API_KEY environment variable is required")
	}

	// Create router
	r := mux.NewRouter()

	// Health check (no auth required)
	r.HandleFunc("/health", handlers.HealthCheck).Methods("GET")

	// API Documentation (no auth required for spec and UI)
	r.HandleFunc("/openapi.yaml", func(w http.ResponseWriter, req *http.Request) {
		http.ServeFile(w, req, "openapi.yaml")
	}).Methods("GET")
	r.HandleFunc("/docs", func(w http.ResponseWriter, req *http.Request) {
		http.ServeFile(w, req, "swagger-ui.html")
	}).Methods("GET")

	// API v1 routes (with auth)
	api := r.PathPrefix("/api/v1").Subrouter()
	api.Use(apiKeyMiddleware(apiKey))

	// Configure Horizon Client
	horizonURL := os.Getenv("HORIZON_URL")
	if horizonURL == "" {
		// Use public Testnet as default if not specified
		horizonURL = "https://horizon-testnet.stellar.org"
	}
	handlers.SetHorizonURL(horizonURL)

	// Account endpoints
	api.HandleFunc("/accounts/{id}", handlers.GetAccount).Methods("GET")
	api.HandleFunc("/accounts/{id}/balance", handlers.GetAccountBalance).Methods("GET")
	api.HandleFunc("/accounts/{id}/trustlines", handlers.GetAccountTrustlines).Methods("GET")

	// Ledger endpoints
	api.HandleFunc("/ledgers/latest", handlers.GetLatestLedger).Methods("GET")
	api.HandleFunc("/ledgers/{seq}", handlers.GetLedger).Methods("GET")

	// Transaction endpoints
	api.HandleFunc("/transactions/{hash}", handlers.GetTransaction).Methods("GET")

	// SPA Handler: Serve static files or fallback to index.html
	distFS, err := fs.Sub(staticFiles, "dashboard/dist")
	if err != nil {
		log.Fatalf("Failed to create sub FS: %v", err)
	}

	r.PathPrefix("/").HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		path := req.URL.Path

		// Attempt to open the file via FS
		// trim leading slash
		fPath := path
		if len(fPath) > 0 && fPath[0] == '/' {
			fPath = fPath[1:]
		}
		if fPath == "" {
			fPath = "index.html"
		}

		f, err := distFS.Open(fPath)
		if err == nil {
			// File exists, serve it
			defer f.Close()
			stat, err := f.Stat()
			if err == nil && !stat.IsDir() {
				http.FileServer(http.FS(distFS)).ServeHTTP(w, req)
				return
			}
		}


		// Fallback to index.html for SPA routing
		// BUT: Explicitly fail for /docs and /manual to prevent masking
		if path == "/docs" || len(path) > 6 && path[:7] == "/manual" {
			http.NotFound(w, req)
			return
		}

		// Re-open index.html
		f, err = distFS.Open("index.html")
		if err != nil {
			http.Error(w, "Dashboard not found", http.StatusNotFound)
			return
		}
		defer f.Close()
		stat, _ := f.Stat()
		http.ServeContent(w, req, "index.html", stat.ModTime(), f.(io.ReadSeeker))
	})

	// Configure server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Reporting API listening on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}

// apiKeyMiddleware validates the X-API-Key header
func apiKeyMiddleware(validKey string) mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := r.Header.Get("X-API-Key")
			if key == "" {
				http.Error(w, `{"error": "Missing X-API-Key header"}`, http.StatusUnauthorized)
				return
			}
			if key != validKey {
				http.Error(w, `{"error": "Invalid API key"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
