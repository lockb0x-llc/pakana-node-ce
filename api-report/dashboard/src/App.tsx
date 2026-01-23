import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Activity,
    Box,
    Database,
    Search,
    Shield,
    Terminal,
    Server,
    Clock,
    Hash,
    ArrowRight,
    AlertCircle,
    CheckCircle2,
    Menu,
    X
} from 'lucide-react';

// --- Types ---

interface Ledger {
    sequence: number;
    closed_at: string;
    tx_count: number;
}

interface Account {
    account_id: string;
    balance: string;
    balance_xlm: string;
    seq_num: number;
    last_modified: number;
    trustlines?: Trustline[];
}

interface Trustline {
    asset: string;
    balance: string;
    limit: string;
}

interface LogEntry {
    id: string;
    timestamp: string;
    type: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
    message: string;
}

// --- Components ---

const Card = ({ children, className = "", animate = false }: { children: React.ReactNode, className?: string, animate?: boolean }) => (
    <div className={`
        glass-card rounded-xl p-4 sm:p-6 
        transition-all duration-300 ease-out
        hover:bg-slate-800/60 hover:border-slate-700/50
        ${animate ? 'animate-fade-in' : ''}
        ${className}
    `}>
        {children}
    </div>
);

const Badge = ({ type, children }: { type: 'success' | 'warning' | 'error' | 'neutral', children: React.ReactNode }) => {
    const colors = {
        success: "bg-emerald-950/50 text-emerald-400 border-emerald-800/50",
        warning: "bg-amber-950/50 text-amber-400 border-amber-800/50",
        error: "bg-red-950/50 text-red-400 border-red-800/50",
        neutral: "bg-slate-800/50 text-slate-400 border-slate-700/50"
    };
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-mono border ${colors[type]} transition-colors`}>
            {children}
        </span>
    );
};

// --- Custom Sparkline Chart (SVG) ---
const TransactionSparkline = ({ data }: { data: number[] }) => {
    const height = 40;
    const width = 120;
    const max = Math.max(...data, 5);
    const min = 0;
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / (max - min)) * height;
        return `${x},${y}`;
    }).join(' ');
    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
            <defs>
                <linearGradient id="sparkGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path
                d={`M 0,${height} L 0,${height} ${data.map((val, i) => {
                    const x = (i / (data.length - 1)) * width;
                    const y = height - ((val - min) / (max - min)) * height;
                    return `L ${x},${y}`;
                }).join(' ')} L ${width},${height} Z`}
                fill="url(#sparkGradient)"
            />
            <polyline fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
            {/* Animated dot at the end */}
            <circle
                cx={(data.length - 1) / (data.length - 1) * width}
                cy={height - ((data[data.length - 1] - min) / (max - min)) * height}
                r="3"
                fill="#10b981"
                className="animate-pulse"
            />
        </svg>
    );
};

const DigitalClock = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <span className="text-[10px] sm:text-xs font-mono text-slate-500 tabular-nums">
            {time.toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).replace(',', '')}
        </span>
    );
};

// --- Main Application ---

export default function App() {
    const [nodeStatus, setNodeStatus] = useState<'online' | 'offline'>('online');
    const [latestLedger, setLatestLedger] = useState<Ledger | null>(null);
    const [ledgerHistory, setLedgerHistory] = useState<Ledger[]>([]);
    const [txVolumeHistory, setTxVolumeHistory] = useState<number[]>(new Array(15).fill(0));
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState<Account | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const isDemoMode = useRef(false);

    const addLog = useCallback((type: LogEntry['type'], message: string) => {
        setLogs(prev => [{
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            type,
            message
        }, ...prev].slice(0, 50));
    }, []);

    const [logs, setLogs] = useState<LogEntry[]>([
        { id: '1', timestamp: new Date().toISOString(), type: 'INFO', message: 'Pakana Dashboard initialized' },
        { id: '2', timestamp: new Date().toISOString(), type: 'INFO', message: 'Connecting to YottaDB Reporting API...' }
    ]);

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
            return { sequence: prevSeq + 1, closed_at: new Date().toISOString(), tx_count: Math.floor(Math.random() * 15) };
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery) return;
        setIsSearching(true);
        setSearchError(null);
        setSearchResult(null);
        try {
            if (isDemoMode.current) {
                await new Promise(r => setTimeout(r, 600));
                if (searchQuery.length < 5) throw new Error('Invalid Account ID format');
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
                const res = await fetch(`/api/v1/accounts/${searchQuery}`, {
                    headers: { 'X-API-Key': import.meta.env.VITE_API_KEY || 'changeme' }
                });
                if (!res.ok) throw new Error('Account not found');
                const data = await res.json();
                setSearchResult(data);
                addLog('SUCCESS', `Account found: ${data.account_id.substring(0, 8)}...`);
            }
        } catch (err: any) {
            setSearchError(err.message);
            addLog('ERROR', `Search failed: ${err.message}`);
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        const poll = async () => {
            const data = await fetchLatestLedger();
            setLatestLedger(prev => {
                if (prev && prev.sequence === data.sequence) return prev;
                setLedgerHistory(hist => [data, ...hist].slice(0, 10));
                setTxVolumeHistory(vol => [...vol.slice(1), data.tx_count]);
                if (!prev || data.sequence % 10 === 0) addLog('INFO', `Ingested Ledger #${data.sequence} (${data.tx_count} txs)`);
                return data;
            });
        };
        poll();
        const interval = setInterval(poll, 4000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-[100dvh] bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30">
            {/* Background gradient orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl opacity-50" />
                <div className="absolute top-1/2 -left-40 w-96 h-96 bg-slate-800/50 rounded-full blur-3xl opacity-50" />
            </div>

            {/* Navbar */}
            <header className="border-b border-slate-800/50 bg-slate-950/90 backdrop-blur-lg sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="bg-emerald-500/10 p-1.5 sm:p-2 rounded-lg border border-emerald-500/20 glow-emerald">
                            <Database className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                        </div>
                        <span className="font-bold text-base sm:text-lg tracking-tight text-white">
                            PAKANA<span className="text-gradient-emerald">NODE</span>
                            <span className="text-slate-600 text-[10px] sm:text-xs ml-1 sm:ml-2 font-mono">v0.5.0</span>
                        </span>
                    </div>

                    {/* Desktop nav items */}
                    <div className="hidden md:flex items-center space-x-6">
                        <div className="flex items-center space-x-2 text-sm font-mono text-slate-400">
                            <Server className="w-4 h-4" />
                            <span>YottaDB r2.03</span>
                        </div>
                        <div className="h-4 w-px bg-slate-800"></div>
                        <div className="flex items-center space-x-3">
                            <div className="flex flex-col items-end mr-1">
                                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 leading-none mb-0.5">
                                    {isDemoMode.current ? 'SIMULATION' : 'ONLINE'}
                                </span>
                                <DigitalClock />
                            </div>
                            <div className={`w-2.5 h-2.5 rounded-full ${nodeStatus === 'online' ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500'}`}></div>
                        </div>
                    </div>

                    {/* Mobile menu button */}
                    <button
                        className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>

                {/* Mobile dropdown */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t border-slate-800/50 bg-slate-900/95 backdrop-blur-xl p-4 space-y-3 animate-fade-in">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400 font-mono">YottaDB r2.03</span>
                            <div className="flex items-center space-x-2">
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 leading-none">
                                        {isDemoMode.current ? 'SIMULATION' : 'ONLINE'}
                                    </span>
                                    <DigitalClock />
                                </div>
                                <div className={`w-2 h-2 rounded-full ${nodeStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            <main className="relative max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6 sm:space-y-8">
                {/* Top Metrics Row - 2 cols on mobile, 4 on desktop */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    <Card animate className="relative overflow-hidden group col-span-1">
                        <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Box className="w-10 h-10 sm:w-16 sm:h-16 text-emerald-400" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] sm:text-sm font-medium text-slate-400 font-mono uppercase">Latest Ledger</p>
                            <div className="flex items-baseline space-x-2">
                                <h2 className="text-xl sm:text-3xl font-bold text-white font-mono">
                                    {latestLedger ? latestLedger.sequence : '---'}
                                </h2>
                            </div>
                            <p className="text-[10px] sm:text-xs text-slate-500">
                                {latestLedger ? new Date(latestLedger.closed_at).toLocaleTimeString() : 'Waiting...'}
                            </p>
                        </div>
                    </Card>

                    <Card animate className="animation-delay-100">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-[10px] sm:text-sm font-medium text-slate-400 font-mono uppercase">TX Volume</p>
                            <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500" />
                        </div>
                        <div className="h-8 sm:h-10 flex items-end mb-1">
                            <TransactionSparkline data={txVolumeHistory} />
                        </div>
                        <div className="flex justify-between items-center text-[10px] sm:text-xs text-slate-500 font-mono">
                            <span>0 TPS</span>
                            <span>{Math.max(...txVolumeHistory)} MAX</span>
                        </div>
                    </Card>

                    <Card animate className="animation-delay-200">
                        <div className="flex justify-between items-start mb-2 sm:mb-4">
                            <p className="text-[10px] sm:text-sm font-medium text-slate-400 font-mono uppercase">Validator</p>
                            <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500" />
                        </div>
                        <div className="space-y-1.5 sm:space-y-2">
                            <div className="flex justify-between items-center text-xs sm:text-sm">
                                <span className="text-slate-400">Core-Rust</span>
                                <Badge type="success">ACTIVE</Badge>
                            </div>
                            <div className="flex justify-between items-center text-xs sm:text-sm">
                                <span className="text-slate-400">Api-Go</span>
                                <Badge type="success">INGESTING</Badge>
                            </div>
                        </div>
                    </Card>

                    <Card animate className="animation-delay-300">
                        <div className="flex justify-between items-start mb-2 sm:mb-4">
                            <p className="text-[10px] sm:text-sm font-medium text-slate-400 font-mono uppercase">Database</p>
                            <Database className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500" />
                        </div>
                        <div className="space-y-1.5 sm:space-y-2">
                            <div className="flex justify-between items-center text-xs sm:text-sm">
                                <span className="text-slate-400">^Ledger</span>
                                <span className="text-emerald-400 font-mono text-[10px] sm:text-xs">OK</span>
                            </div>
                            <div className="flex justify-between items-center text-xs sm:text-sm">
                                <span className="text-slate-400">^Account</span>
                                <span className="text-emerald-400 font-mono text-[10px] sm:text-xs">OK</span>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Main content grid - stack on mobile, side by side on lg */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                    <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base sm:text-lg font-medium text-white flex items-center space-x-2">
                                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                                <span>Live Ledger Stream</span>
                            </h3>
                            <Badge type="neutral">PROTOCOL 24</Badge>
                        </div>

                        {/* Fixed height scrollable table - 30vh */}
                        <div className="glass-card rounded-xl overflow-hidden">
                            <div className="max-h-[30vh] overflow-y-auto">
                                <table className="w-full text-left text-xs sm:text-sm">
                                    <thead className="bg-slate-950/80 border-b border-slate-800/50 font-mono text-[10px] sm:text-xs text-slate-400 uppercase sticky top-0">
                                        <tr>
                                            <th className="px-3 sm:px-6 py-2 sm:py-3">Sequence</th>
                                            <th className="px-3 sm:px-6 py-2 sm:py-3 hidden sm:table-cell">Closed At</th>
                                            <th className="px-3 sm:px-6 py-2 sm:py-3 hidden md:table-cell">Hash</th>
                                            <th className="px-3 sm:px-6 py-2 sm:py-3 text-right">TXs</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/30">
                                        {ledgerHistory.length === 0 ? (
                                            <tr><td colSpan={4} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-slate-500">Waiting for ledgers...</td></tr>
                                        ) : (
                                            ledgerHistory.map((ledger, index) => {
                                                // Deterministic placeholder hash to prevent flickering
                                                const pseudoHash = Array.from(ledger.sequence.toString() + ledger.closed_at)
                                                    .reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
                                                    .toString(16).padStart(12, '0').substring(0, 12);

                                                return (
                                                    <tr
                                                        key={ledger.sequence}
                                                        className={`
                                                            hover:bg-slate-800/30 transition-all duration-300 font-mono
                                                            ${index === 0 ? 'bg-emerald-500/10 animate-fade-in' : ''}
                                                        `}
                                                    >
                                                        <td className="px-3 sm:px-6 py-2 sm:py-3 text-emerald-400 font-semibold">
                                                            #{ledger.sequence}
                                                        </td>
                                                        <td className="px-3 sm:px-6 py-2 sm:py-3 text-slate-400 hidden sm:table-cell">
                                                            {new Date(ledger.closed_at).toISOString().split('T')[1].replace('Z', '').split('.')[0]}
                                                        </td>
                                                        <td className="px-3 sm:px-6 py-2 sm:py-3 text-slate-600 text-[10px] sm:text-xs hidden md:table-cell">
                                                            {pseudoHash}...
                                                        </td>
                                                        <td className="px-3 sm:px-6 py-2 sm:py-3 text-right">
                                                            <span className={`
                                                                inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium
                                                                ${ledger.tx_count > 0 ? 'bg-emerald-950/50 text-emerald-400' : 'bg-slate-800/50 text-slate-500'}
                                                            `}>
                                                                {ledger.tx_count}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* System Event Log */}
                        <div className="space-y-3 sm:space-y-4">
                            <h3 className="text-base sm:text-lg font-medium text-white flex items-center space-x-2">
                                <Terminal className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                                <span>System Event Log</span>
                            </h3>
                            <div className="glass-card rounded-xl p-3 sm:p-4 h-32 sm:h-48 overflow-y-auto font-mono text-[10px] sm:text-xs space-y-1">
                                {logs.map(log => (
                                    <div key={log.id} className="flex space-x-2 py-0.5">
                                        <span className="text-slate-600 shrink-0">[{log.timestamp.split('T')[1].split('.')[0]}]</span>
                                        <span className={`shrink-0 font-semibold ${log.type === 'INFO' ? 'text-blue-400' :
                                            log.type === 'SUCCESS' ? 'text-emerald-400' :
                                                log.type === 'WARN' ? 'text-amber-400' :
                                                    'text-red-400'
                                            }`}>{log.type}:</span>
                                        <span className="text-slate-300 break-all">{log.message}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* State Explorer sidebar */}
                    <div className="space-y-4 sm:space-y-6">
                        <h3 className="text-base sm:text-lg font-medium text-white flex items-center space-x-2">
                            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                            <span>State Explorer</span>
                        </h3>

                        <Card className="p-0 overflow-hidden gradient-border">
                            <div className="p-4 sm:p-6 bg-slate-900/50">
                                <form onSubmit={handleSearch} className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search Account ID (G...)"
                                        className="w-full bg-slate-950/80 border border-slate-700/50 rounded-lg text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 font-mono transition-all"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    <button
                                        type="submit"
                                        disabled={isSearching}
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 sm:p-2 rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                                    >
                                        <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
                                    </button>
                                </form>
                                {searchError && (
                                    <div className="mt-3 flex items-center space-x-2 text-[10px] sm:text-xs text-red-400 bg-red-950/30 p-2 rounded-lg border border-red-900/30">
                                        <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                                        <span>{searchError}</span>
                                    </div>
                                )}
                            </div>

                            {searchResult ? (
                                <div className="border-t border-slate-800/50 p-4 sm:p-6 space-y-4 animate-fade-in">
                                    <div>
                                        <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-semibold">Native Balance</span>
                                        <div className="flex items-baseline space-x-2 mt-1">
                                            <span className="text-xl sm:text-2xl font-bold text-white font-mono">{searchResult.balance_xlm}</span>
                                            <span className="text-[10px] sm:text-xs text-emerald-500 font-bold">XLM</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                        <div>
                                            <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-semibold">Sequence</span>
                                            <p className="font-mono text-xs sm:text-sm text-slate-300 mt-1">{searchResult.seq_num}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-semibold">Last Modified</span>
                                            <p className="font-mono text-xs sm:text-sm text-slate-300 mt-1">{searchResult.last_modified}</p>
                                        </div>
                                    </div>

                                    {searchResult.trustlines && searchResult.trustlines.length > 0 && (
                                        <div className="pt-2">
                                            <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-semibold">Trustlines</span>
                                            <div className="mt-2 space-y-2">
                                                {searchResult.trustlines.map((tl, i) => (
                                                    <div key={i} className="flex justify-between items-center text-xs sm:text-sm bg-slate-950/50 p-2 sm:p-2.5 rounded-lg border border-slate-800/50">
                                                        <span className="font-mono text-[10px] sm:text-xs text-amber-400">{tl.asset.split(':')[0]}</span>
                                                        <span className="font-mono text-slate-300">{tl.balance}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-2 border-t border-slate-800/30">
                                        <div className="flex items-center space-x-2 text-[10px] sm:text-xs text-emerald-400">
                                            <CheckCircle2 className="w-3 h-3" />
                                            <span>Data valid as of Ledger {latestLedger?.sequence}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-6 sm:p-8 text-center border-t border-slate-800/50">
                                    <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-800/30 mb-3">
                                        <Hash className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" />
                                    </div>
                                    <p className="text-xs sm:text-sm text-slate-500">Enter a Stellar Public Key to view live state from YottaDB.</p>
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800/50 mt-8 py-4 sm:py-6">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] sm:text-xs text-slate-500">
                    <span className="font-mono">Pakana Private Ledger © 2026</span>
                    <span className="font-mono">Powered by YottaDB + Stellar Protocol</span>
                </div>
            </footer>
        </div>
    );
}
