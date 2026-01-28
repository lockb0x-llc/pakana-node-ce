export interface Ledger {
    sequence: number;
    closed_at: string;
    tx_count: number;
}

export interface Trustline {
    asset: string;
    balance: string;
    limit: string;
}

export interface Account {
    account_id: string;
    balance: string;
    balance_xlm: string;
    seq_num: number;
    last_modified: number;
    trustlines?: Trustline[];
}

export interface LogEntry {
    id: string;
    timestamp: string;
    type: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
    message: string;
}
