import { Tooltip } from './Tooltip';

interface BadgeProps { 
    type: 'success' | 'warning' | 'error' | 'neutral'; 
    children: React.ReactNode; 
    dataId?: string;
    description?: string;
}

export const Badge: React.FC<BadgeProps> = ({ type, children, dataId = "Generic", description }) => {
    const colors = {
        success: "bg-emerald-950/50 text-emerald-400 border-emerald-800/50",
        warning: "bg-amber-950/50 text-amber-400 border-amber-800/50",
        error: "bg-red-950/50 text-red-400 border-red-800/50",
        neutral: "bg-slate-800/50 text-slate-400 border-slate-700/50"
    };

    const tooltipColors: Record<string, 'emerald' | 'amber' | 'red' | 'slate'> = {
        success: 'emerald',
        warning: 'amber',
        error: 'red',
        neutral: 'slate'
    };

    const content = (
        <span data-component-id={`Badge-${dataId}`} className={`px-2 py-0.5 rounded-full text-xs font-mono border ${colors[type]} transition-colors cursor-help`}>
            {children}
        </span>
    );

    if (description) {
        return <Tooltip content={description} color={tooltipColors[type]}>{content}</Tooltip>;
    }

    return content;
};
