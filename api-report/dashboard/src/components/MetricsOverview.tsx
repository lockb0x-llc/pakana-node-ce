import React from 'react';
import { Activity, Shield, Database, Box } from 'lucide-react';
import { Card } from './Card';
import { Badge } from './Badge';
import { TransactionSparkline } from './TransactionSparkline';
import { Ledger } from '../types';

interface MetricsOverviewProps {
    latestLedger: Ledger | null;
    txVolumeHistory: number[];
    ingestionStatus: 'healthy' | 'stalled' | 'unknown';
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({ latestLedger, txVolumeHistory, ingestionStatus }) => {
    return (
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
                        {ingestionStatus === 'healthy' ? (
                            <Badge type="success">INGESTING</Badge>
                        ) : ingestionStatus === 'stalled' ? (
                            <Badge type="warning">STALLED</Badge>
                        ) : (
                            <Badge type="neutral">WAITING</Badge>
                        )}
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
    );
};
