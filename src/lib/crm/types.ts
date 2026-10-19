export type LeadStage =
    | "NEW"
    | "CONTACTED"
    | "INTERESTED"
    | "QUALIFIED"
    | "PROPOSAL"
    | "WON"
    | "LOST";

export type LeadPriority = "HOT" | "WARM" | "COLD";

export interface LeadActivity {
    id: string;
    type: "note" | "message" | "stage_change" | "followup";
    content: string;
    createdAt: string;
    author?: string;
}

export interface Lead {
    id: string;
    userId?: string;
    name: string;
    phone: string;
    formattedPhone: string; // e.g. "919935370814"
    whatsappJid: string;   // e.g. "919935370814@s.whatsapp.net"
    category: string;
    secondCategory?: string;
    city?: string;
    state?: string;
    address?: string;
    zip?: string;
    country?: string;
    website?: string;
    rating?: number;
    reviewsCount?: number;
    keyword?: string;
    stage: LeadStage;
    priority?: LeadPriority;
    value?: number; // Deal value in currency (INR, etc.)
    currency?: string; // Default "₹"
    followUpDate?: string; // ISO date / YYYY-MM-DD
    followUpNote?: string;
    tags: string[];
    notes?: string;
    activities?: LeadActivity[];
    source?: string;
    status?: string;
    lastContactedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CRMStoreData {
    leads: Lead[];
    customStages?: { id: string; name: string; color: string }[];
}

export interface CSVImportResult {
    totalRows: number;
    imported: number;
    skippedDuplicates: number;
    invalidPhone: number;
    leads: Lead[];
}

export interface WhatsAppSyncResult {
    totalContacts: number;
    imported: number;
    skippedDuplicates: number;
    leads: Lead[];
}
