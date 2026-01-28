import React from 'react';
import { Search, ArrowRight, AlertCircle, Hash, CheckCircle2 } from 'lucide-react';
import { Account, Ledger } from '../types';
import { Card } from './Card';

interface StateExplorerProps {
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    handleSearch: (e: React.FormEvent) => void;
    isSearching: boolean;
    searchResult: Account | null;
    searchError: string | null;
    latestLedger: Ledger | null;
}

export const StateExplorer: React.FC<StateExplorerProps> = ({ 
    searchQuery, 
    setSearchQuery, 
    handleSearch, 
    isSearching, 
    searchResult, 
    searchError, 
    latestLedger 
}) => {
    return (
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
    );
};
