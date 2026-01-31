export interface Ledger {
    sequence: number;
    closed_at: string;
    hash: string;
    total_tx_count: number;
    filtered_tx_count: number;
    tx_count: number; // Deprecated: use filtered_tx_count
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
