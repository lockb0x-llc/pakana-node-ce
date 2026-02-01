import React from 'react';
import { Activity, Shield, Database, Box } from 'lucide-react';
import { Card } from './Card';
import { Badge } from './Badge';
import { TransactionSparkline } from './TransactionSparkline';
import { Ledger } from '../types';

interface MetricsOverviewProps {
    latestLedger: Ledger | null;
    totalVolumeHistory: number[];
    interestVolumeHistory: number[];
    ingestionStatus: 'healthy' | 'stalled' | 'unknown';
}

import { DocumentAnchor } from './DocumentAnchor';

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({ 
    latestLedger, 
    totalVolumeHistory, 
    interestVolumeHistory,
    ingestionStatus 
}) => {
    return (
        <div data-component-id="MetricsOverview" className="flex flex-wrap gap-4 items-stretch">
            {/* RWA Anchor - Full Width */}
            <DocumentAnchor className="w-full flex-none" />

            <Card 
                dataId="LatestLedger" 
                animate 
                className="relative overflow-hidden group flex-shrink-0 min-w-[200px] flex-1"
                description="The most recent block closed on the Stellar network. Sequence numbers are used to order and identify ledgers."
            >
                <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-10 group-hover:opacity-30 transition-opacity">
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

            <Card 
                dataId="TotalTX" 
                animate 
                className="animation-delay-100 flex-shrink-0 min-w-[200px] flex-1"
                description="Live transaction volume across the entire Stellar Network. High peaks indicate network-wide activity."
            >
                <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] sm:text-sm font-medium text-slate-400 font-mono uppercase">Total TX</p>
                    <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500" />
                </div>
                <div className="h-8 sm:h-10 flex items-end mb-1">
                    <TransactionSparkline data={totalVolumeHistory} color="#10b981" />
                </div>
                <div className="flex justify-between items-center text-[10px] sm:text-xs text-slate-500 font-mono">
                    <span className="text-emerald-500/80">Stellar Network</span>
                    <span>{Math.max(...totalVolumeHistory)} MAX</span>
                </div>
            </Card>

            <Card 
                dataId="InterestTX" 
                animate 
                className="animation-delay-150 border-blue-500/30 bg-blue-600/[0.05] flex-shrink-0 min-w-[200px] flex-1"
                tooltipColor="blue"
                description="Aggregated transaction volume for specifically tracked Pakana accounts. Neon blue indicates sovereign operations."
            >
                <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] sm:text-sm font-medium text-blue-400 font-mono uppercase">Interest TX</p>
                    <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />
                </div>
                <div className="h-8 sm:h-10 flex items-end mb-1">
                    <TransactionSparkline data={interestVolumeHistory} color="#3b82f6" />
                </div>
                <div className="flex justify-between items-center text-[10px] sm:text-xs text-slate-500 font-mono">
                    <span className="text-blue-500/80">Tracked Accounts</span>
                    <span>{Math.max(...interestVolumeHistory)} MAX</span>
                </div>
            </Card>

            <Card 
                dataId="ValidatorStatus" 
                animate 
                className="animation-delay-200 flex-shrink-0 min-w-[240px] flex-1"
                description="Real-time health status of the Pakana Validator services running on the cloud node."
            >
                <div className="flex justify-between items-start mb-2 sm:mb-4">
                    <p className="text-[10px] sm:text-sm font-medium text-slate-400 font-mono uppercase">Validator</p>
                    <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500" />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-xs sm:text-sm">
                        <span className="text-slate-400">Core-Rust</span>
                        <Badge 
                            dataId="CoreStatus" 
                            type="success"
                            description="Rust core engine is processing XDR stream and applying state transitions to YottaDB."
                        >
                            ACTIVE
                        </Badge>
                    </div>
                    <div className="flex justify-between items-center text-xs sm:text-sm">
                        <span className="text-slate-400">Api-Go</span>
                        {ingestionStatus === 'healthy' ? (
                            <Badge 
                                dataId="IngestionStatus" 
                                type="success"
                                description="Go ingestion service is actively streaming ledger headers from the Horizon network."
                            >
                                INGESTING
                            </Badge>
                        ) : ingestionStatus === 'stalled' ? (
                            <Badge 
                                dataId="IngestionStatus" 
                                type="warning"
                                description="Ingestion flow has paused. Checking connection to Stellar Horizon..."
                            >
                                STALLED
                            </Badge>
                        ) : (
                            <Badge 
                                dataId="IngestionStatus" 
                                type="neutral"
                                description="Waiting for first ledger sync to complete."
                            >
                                WAITING
                            </Badge>
                        )}
                    </div>
                </div>
            </Card>

            <Card 
                dataId="DatabaseStatus" 
                animate 
                className="animation-delay-300 flex-shrink-0 min-w-[180px] flex-1"
                description="Status of the primary YottaDB state store. Persistence is ensured via direct IPC mapping."
            >
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
