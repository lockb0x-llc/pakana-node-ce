import React, { useId } from 'react';

interface TransactionSparklineProps {
    data: number[];
    color?: string;
}

export const TransactionSparkline: React.FC<TransactionSparklineProps> = ({ 
    data, 
    color = "#10b981" 
}) => {
    const height = 40;
    const width = 120;
    const gradientId = useId();
    const max = Math.max(...data, 5);
    const min = 0;
    
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / (max - min)) * height;
        return `${x},${y}`;
    }).join(' ');
    
    return (
        <svg data-component-id="TransactionSparkline" width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
            <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path
                d={`M 0,${height} L 0,${height} ${data.map((val, i) => {
                    const x = (i / (data.length - 1)) * width;
                    const y = height - ((val - min) / (max - min)) * height;
                    return `L ${x},${y}`;
                }).join(' ')} L ${width},${height} Z`}
                fill={`url(#${gradientId})`}
            />
            <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
            <circle
                cx={width}
                cy={height - ((data[data.length - 1] - min) / (max - min)) * height}
                r="3"
                fill={color}
                className="animate-pulse"
            />
        </svg>
    );
};
