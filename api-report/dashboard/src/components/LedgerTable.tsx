import React from 'react';
import { Clock } from 'lucide-react';
import { Ledger } from '../types';
import { Badge } from './Badge';

interface LedgerTableProps {
    history: Ledger[];
}

export const LedgerTable: React.FC<LedgerTableProps> = ({ history }) => {
    return (
        <div data-component-id="LedgerTable" className="space-y-4 sm:space-y-6">
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
                            {history.length === 0 ? (
                                <tr><td colSpan={4} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-slate-500">Waiting for ledgers...</td></tr>
                            ) : (
                                history.map((ledger, index) => {
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
        </div>
    );
};
