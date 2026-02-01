import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
    content: string;
    children: React.ReactNode;
    color?: 'emerald' | 'amber' | 'red' | 'blue' | 'slate';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, color = 'emerald' }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const colorClasses = {
        emerald: "border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]",
        amber: "border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]",
        red: "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]",
        blue: "border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]",
        slate: "border-slate-500/50 shadow-[0_0_15px_rgba(100,116,139,0.2)]"
    };

    useEffect(() => {
        if (isVisible && triggerRef.current && tooltipRef.current) {
            const triggerRect = triggerRef.current.getBoundingClientRect();
            const tooltipRect = tooltipRef.current.getBoundingClientRect();
            
            // Calculate best position (default to top-center)
            let top = triggerRect.top - tooltipRect.height - 10;
            let left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);

            // Keep within viewport
            if (top < 10) top = triggerRect.bottom + 10;
            if (left < 10) left = 10;
            if (left + tooltipRect.width > window.innerWidth - 10) {
                left = window.innerWidth - tooltipRect.width - 10;
            }

            setPosition({ top: top + window.scrollY, left });
        }
    }, [isVisible]);

    return (
        <div 
            ref={triggerRef}
            className="relative inline-block h-full"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div 
                    ref={tooltipRef}
                    style={{ top: position.top, left: position.left }}
                    className={`
                        fixed z-[9999] px-3 py-2 
                        bg-slate-950/95 backdrop-blur-md 
                        border rounded-lg 
                        text-white text-xs sm:text-sm 
                        font-medium max-w-[200px] sm:max-w-xs
                        animate-tooltip-slide-up
                        ${colorClasses[color]}
                    `}
                >
                    <div className="relative text-slate-200 leading-relaxed">
                        {content}
                    </div>
                </div>
            )}
        </div>
    );
};
