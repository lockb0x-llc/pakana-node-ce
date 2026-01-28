import React, { useEffect, useState } from 'react';

interface CookieBannerProps {
    onAccept: () => void;
    onDecline: () => void;
}

export const CookieBanner: React.FC<CookieBannerProps> = ({ onAccept, onDecline }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('pakana_consent');
        if (!consent) {
            setIsVisible(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('pakana_consent', 'true');
        setIsVisible(false);
        onAccept();
    };

    const handleDecline = () => {
        localStorage.setItem('pakana_consent', 'false');
        setIsVisible(false);
        onDecline();
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-50 animate-fade-in">
            <div className="max-w-7xl mx-auto glass-card border border-emerald-500/30 rounded-xl p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                <div className="space-y-1">
                    <h3 className="text-white font-medium text-sm">Analytics Consent</h3>
                    <p className="text-slate-400 text-xs max-w-2xl">
                        We use Microsoft Clarity to understand how you interact with the Pakana Node dashboard. 
                        This helps us improve the user experience. No personal data is stored on our servers.
                    </p>
                </div>
                <div className="flex items-center space-x-3 w-full sm:w-auto">
                    <button 
                        onClick={handleDecline}
                        className="flex-1 sm:flex-none px-4 py-2 text-xs font-mono text-slate-400 hover:text-white transition-colors border border-transparent hover:border-slate-700 rounded-lg"
                    >
                        Decline
                    </button>
                    <button 
                        onClick={handleAccept}
                        className="flex-1 sm:flex-none px-6 py-2 text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-lg hover:shadow-emerald-500/20 transition-all"
                    >
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
};
