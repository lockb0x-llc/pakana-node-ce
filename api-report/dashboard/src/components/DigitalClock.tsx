import React, { useState, useEffect } from 'react';

export const DigitalClock = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <span data-component-id="DigitalClock" className="text-[10px] sm:text-xs font-mono text-slate-500 tabular-nums">
            {time.toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).replace(',', '')}
        </span>
    );
};
