import React from 'react';
import { Terminal } from 'lucide-react';
import { LogEntry } from '../types';

interface SystemLogProps {
    logs: LogEntry[];
}

export const SystemLog: React.FC<SystemLogProps> = ({ logs }) => {
    return (
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
    );
};
