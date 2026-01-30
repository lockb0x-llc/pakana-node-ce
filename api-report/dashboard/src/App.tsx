import React, { useState, useEffect, useCallback, useRef } from 'react';
import { clarity } from 'react-microsoft-clarity';
import { Ledger, Account, LogEntry } from './types';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { MetricsOverview } from './components/MetricsOverview';
import { LedgerTable } from './components/LedgerTable';
import { SystemLog } from './components/SystemLog';
import { StateExplorer } from './components/StateExplorer';
import { CookieBanner } from './components/CookieBanner';

export default function App() {
    // --- State ---
    const [nodeStatus, setNodeStatus] = useState<'online' | 'offline'>('online');
    const [latestLedger, setLatestLedger] = useState<Ledger | null>(null);
    const [ledgerHistory, setLedgerHistory] = useState<Ledger[]>([]);
    const [totalVolumeHistory, setTotalVolumeHistory] = useState<number[]>(new Array(20).fill(0));
    const [interestVolumeHistory, setInterestVolumeHistory] = useState<number[]>(new Array(20).fill(0));
    
    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState<Account | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    
    // Environment
    const isDemoMode = useRef(false);

    // Logs
    const [logs, setLogs] = useState<LogEntry[]>([
        { id: '1', timestamp: new Date().toISOString(), type: 'INFO', message: 'Pakana Dashboard initialized' },
        { id: '2', timestamp: new Date().toISOString(), type: 'INFO', message: 'Connecting to YottaDB Reporting API...' }
    ]);

    const addLog = useCallback((type: LogEntry['type'], message: string) => {
        setLogs(prev => [{
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            type,
            message
        }, ...prev].slice(0, 50));
    }, []);

    // --- Analytics Logic ---
    useEffect(() => {
        const consent = localStorage.getItem('pakana_consent');
        if (consent === 'true' && !clarity.hasStarted()) {
            clarity.init('v61nqnzxv6');
        }
    }, []);

    const handleAnalyticsAccept = () => {
        if (!clarity.hasStarted()) {
            clarity.init('v61nqnzxv6');
            addLog('INFO', 'Analytics initialized with user consent');
        }
    };

    const handleAnalyticsDecline = () => {
        addLog('INFO', 'Analytics disabled by user');
    };

    // --- Debug Mode ---
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('debug') === 'true') {
            document.body.classList.add('debug-mode');
            addLog('INFO', 'Diagnostic Mode Enabled');
        }
    }, [addLog]);

    // --- Derived State ---
    const ingestionStatus = React.useMemo(() => {
        if (!latestLedger) return 'unknown';
        const ledgerTime = new Date(latestLedger.closed_at).getTime();
        const diff = (new Date().getTime() - ledgerTime) / 1000;
        return diff < 20 ? 'healthy' : 'stalled';
    }, [latestLedger]);

    // --- Data Fetching ---
    const fetchLatestLedger = async () => {
        try {
            const res = await fetch('/api/v1/ledgers/latest', {
                headers: { 'X-API-Key': import.meta.env.VITE_API_KEY || 'changeme' }
            });
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            const data: Ledger = await res.json();
            setNodeStatus('online');
            isDemoMode.current = false;
            return data;
        } catch (e) {
            console.warn('API Unreachable, switching to simulation:', e);
            setNodeStatus('offline');
            isDemoMode.current = true;
            const prevSeq = latestLedger?.sequence || 549000;
            const total = Math.floor(Math.random() * 50) + 5;
            const filtered = Math.random() > 0.8 ? Math.floor(Math.random() * 5) : 0;
            return { 
                sequence: prevSeq + 1, 
                closed_at: new Date().toISOString(), 
                total_tx_count: total,
                filtered_tx_count: filtered,
                tx_count: filtered 
            };
        }
    };

    useEffect(() => {
        const poll = async () => {
            const data = await fetchLatestLedger();
            setLatestLedger(prev => {
                if (prev && prev.sequence === data.sequence) return prev;
                setLedgerHistory(hist => [data, ...hist].slice(0, 10));
                setTotalVolumeHistory(vol => [...vol.slice(1), data.total_tx_count]);
                setInterestVolumeHistory(vol => [...vol.slice(1), data.filtered_tx_count]);
                
                const displayCount = data.filtered_tx_count || 0;
                if (!prev || data.sequence % 10 === 0) {
                    addLog('INFO', `Ingested Ledger #${data.sequence} (${data.total_tx_count} total, ${displayCount} interest)`);
                }
                return data;
            });
        };
        poll();
        const interval = setInterval(poll, 4000);
        return () => clearInterval(interval);
    }, []);

    // --- Actions ---
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery) return;

        // Validation
        const isValidKey = /^G[A-Z0-9]{55}$/.test(searchQuery);
        const isValidTx = /^[0-9a-f]{64}$/.test(searchQuery);

        if (!isValidKey && !isValidTx) {
            setSearchError("Invalid format. Expecting Stellar Public Key (G...) or TX Hash.");
            return;
        }

        setIsSearching(true);
        setSearchError(null);
        setSearchResult(null);
        try {
            if (isDemoMode.current) {
                await new Promise(r => setTimeout(r, 600));
                
                // Demo Mode
                if (isValidKey) {
                    const result: Account = {
                        account_id: searchQuery,
                        balance: '10000000000',
                        balance_xlm: '1000.0000000',
                        seq_num: 123456789,
                        last_modified: 549123,
                        trustlines: [{ asset: 'TOKE:GB77DTKB...', balance: '7500000', limit: '9223372036854775807' }]
                    };
                    setSearchResult(result);
                    addLog('SUCCESS', `Account lookup: ${searchQuery.substring(0, 8)}...`);
                } else {
                    throw new Error('Transaction lookup not available in simulation');
                }
            } else {
                // Live API
                const endpoint = isValidKey 
                    ? `/api/v1/accounts/${searchQuery}`
                    : `/api/v1/transactions/${searchQuery}`;

                const res = await fetch(endpoint, {
                    headers: { 'X-API-Key': import.meta.env.VITE_API_KEY || 'changeme' }
                });
                if (!res.ok) throw new Error(isValidKey ? 'Account not found' : 'Transaction not found');
                const data = await res.json();
                
                if (isValidTx) throw new Error("Transaction display not yet implemented in UI");

                setSearchResult(data);
                addLog('SUCCESS', `Lookup success: ${searchQuery.substring(0, 8)}...`);
            }
        } catch (err: any) {
            setSearchError(err.message);
            addLog('ERROR', `Search failed: ${err.message}`);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-[#0B1121] text-slate-200 font-sans selection:bg-emerald-500/30 overflow-x-hidden">
            {/* Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl opacity-60 animate-pulse" />
                <div className="absolute top-1/2 -left-40 w-[30rem] h-[30rem] bg-indigo-600/20 rounded-full blur-3xl opacity-60" />
                <div className="absolute bottom-0 right-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl opacity-40" />
            </div>

            <Navbar nodeStatus={nodeStatus} isDemoMode={isDemoMode.current} />

            <main className="relative max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6 sm:space-y-8">
                <MetricsOverview 
                    latestLedger={latestLedger} 
                    totalVolumeHistory={totalVolumeHistory} 
                    interestVolumeHistory={interestVolumeHistory}
                    ingestionStatus={ingestionStatus} 
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                    <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                        <LedgerTable history={ledgerHistory} />
                        <SystemLog logs={logs} />
                    </div>

                    <div className="space-y-4 sm:space-y-6">
                        <StateExplorer 
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            handleSearch={handleSearch}
                            isSearching={isSearching}
                            searchResult={searchResult}
                            searchError={searchError}
                            latestLedger={latestLedger}
                        />
                    </div>
                </div>
            </main>

            <Footer />
            <CookieBanner 
                onAccept={handleAnalyticsAccept}
                onDecline={handleAnalyticsDecline}
            />
        </div>
    );
}
