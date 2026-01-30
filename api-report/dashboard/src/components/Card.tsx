import React from 'react';

interface CardProps { 
    children: React.ReactNode; 
    className?: string; 
    animate?: boolean; 
}

export const Card: React.FC<CardProps> = ({ children, className = "", animate = false }) => (
    <div data-component-id="Card" className={`
        glass-card rounded-xl p-4 sm:p-6 
        transition-all duration-300 ease-out
        hover:bg-slate-800/60 hover:border-slate-700/50
        ${animate ? 'animate-fade-in' : ''}
        ${className}
    `}>
        {children}
    </div>
);
