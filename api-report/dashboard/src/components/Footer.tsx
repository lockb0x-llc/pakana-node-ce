import React from 'react';
import { ExternalLink } from 'lucide-react';

export const Footer = () => (
    <footer data-component-id="Footer" className="border-t border-slate-800/50 mt-8 py-4 sm:py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] sm:text-xs text-slate-500">
            <span className="font-mono">Pakana Private Ledger © 2026</span>
            <div className="flex space-x-4">
                <a href="https://yottadb.com" target="_blank" rel="noreferrer" className="flex items-center hover:text-emerald-400 transition-colors">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    YottaDB
                </a>
                <a href="https://stellar.org" target="_blank" rel="noreferrer" className="flex items-center hover:text-emerald-400 transition-colors">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Stellar
                </a>
            </div>
        </div>
    </footer>
);
