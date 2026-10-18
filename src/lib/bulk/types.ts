export interface BulkRecipientItem {
    phone: string;
    jid: string;
    name?: string;
    category?: string;
    city?: string;
    state?: string;
    address?: string;
    website?: string;
    company?: string;
    leadId?: string;
    customVars?: Record<string, string>;
    status: "pending" | "sent" | "failed";
    retries?: number;
    error?: string;
    sessionUsed?: string;
    sentAt?: string;
    interpolatedMessage?: string;
}

export type CampaignStatus = "running" | "completed" | "stopped" | "failed" | "paused" | "reconnecting";

export interface FaultToleranceConfig {
    maxRetries: number;            // Default: 2 retries per message
    retryDelayMs: number;          // Default: 2000ms exponential base
    autoReconnectTimeoutMs: number;// Default: 60000ms grace period on session drop
    autoFailover: boolean;         // Default: true (switch session on failure)
    rateLimitCooldownMs: number;   // Default: 30000ms cooldown on 429
}

export interface FaultToleranceStats {
    retriesRecovered: number;
    failoverSwitches: number;
    reconnectPauses: number;
    rateLimitPauses: number;
}

export interface BulkCampaignRecord {
    id: string; // broadcastId
    broadcastId: string;
    campaignName: string;
    status: CampaignStatus;
    total: number;
    sent: number;
    failed: number;
    sessionsUsed: string[];
    messageTemplate: string;
    delay: number;
    rotateEvery: number;
    antiBan: boolean;
    startedAt: string;
    completedAt?: string;
    perSessionCount: Record<string, number>;
    errors: { jid: string; error: string; session: string; phone?: string; name?: string; attempts?: number }[];
    recipients: BulkRecipientItem[];
    source?: "manual" | "crm" | "csv";
    faultTolerance?: FaultToleranceConfig;
    faultStats?: FaultToleranceStats;
    reconnectMessage?: string;
}

export interface BulkHistoryStore {
    campaigns: BulkCampaignRecord[];
}
