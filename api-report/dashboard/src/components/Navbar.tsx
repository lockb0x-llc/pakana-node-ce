import React, { useState } from 'react';
import { Database, Server, BookOpen, Github, Menu, X } from 'lucide-react';
import { DigitalClock } from './DigitalClock';

interface NavbarProps {
    nodeStatus: 'online' | 'offline';
    isDemoMode: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ nodeStatus, isDemoMode }) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
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
                                {isDemoMode ? 'SIMULATION' : 'ONLINE'}
                            </span>
                            <DigitalClock />
                        </div>
                        <div className={`w-2.5 h-2.5 rounded-full ${nodeStatus === 'online' ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500'}`}></div>
                    </div>
                    <div className="h-4 w-px bg-slate-800"></div>
                    <a 
                        href="/docs" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-slate-400 hover:text-white transition-colors"
                        title="API Documentation"
                    >
                        <BookOpen className="w-5 h-5" />
                    </a>
                    <a 
                        href="https://github.com/lockb0x-llc/pakana-node-ce" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-slate-400 hover:text-white transition-colors"
                        title="GitHub Repository"
                    >
                        <Github className="w-5 h-5" />
                    </a>
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
                                    {isDemoMode ? 'SIMULATION' : 'ONLINE'}
                                </span>
                                <DigitalClock />
                            </div>
                            <div className={`w-2 h-2 rounded-full ${nodeStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};
