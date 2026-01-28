import React from 'react';

export const TransactionSparkline = ({ data }: { data: number[] }) => {
    const height = 40;
    const width = 120;
    const max = Math.max(...data, 5);
    const min = 0;
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / (max - min)) * height;
        return `${x},${y}`;
    }).join(' ');
    
    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
            <defs>
                <linearGradient id="sparkGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path
                d={`M 0,${height} L 0,${height} ${data.map((val, i) => {
                    const x = (i / (data.length - 1)) * width;
                    const y = height - ((val - min) / (max - min)) * height;
                    return `L ${x},${y}`;
                }).join(' ')} L ${width},${height} Z`}
                fill="url(#sparkGradient)"
            />
            <polyline fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
            <circle
                cx={(data.length - 1) / (data.length - 1) * width}
                cy={height - ((data[data.length - 1] - min) / (max - min)) * height}
                r="3"
                fill="#10b981"
                className="animate-pulse"
            />
        </svg>
    );
};
