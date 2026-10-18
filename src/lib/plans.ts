// ============================================================
// PLAN & PRICING CONFIG (sumber kebenaran tunggal)
// ------------------------------------------------------------
// Ubah angka/harga di sini aja — landing page, pembatasan API,
// dan checkout semua ikut dari config ini.
//
// Catatan limit:
// - FREE  : 1000 request/bulan, 100 request/hari (sesuai permintaan)
// - lainnya: REKOMENDASI, silakan disesuaikan kapan saja.
// - limit -1 = unlimited.
// ============================================================

export type PlanId = "FREE" | "STANDARD" | "PRO" | "ENTERPRISE";

// Fitur yang bisa di-on/off per plan (toggle). Dipakai untuk gating akses +
// otomatis tampil sebagai benefit di halaman pricing.
export type Capability =
    | "autoReply"
    | "broadcast"
    | "autoBroadcast"
    | "scheduler"
    | "webhook"
    | "jpm"
    | "multicast"
    | "sticker";

export const CAPABILITIES: { id: Capability; label: string }[] = [
    { id: "autoReply", label: "Auto Reply" },
    { id: "broadcast", label: "Broadcast" },
    { id: "autoBroadcast", label: "Auto Broadcast" },
    { id: "scheduler", label: "Scheduler & Queued Messages" },
    { id: "webhook", label: "Webhook & API Events" },
    { id: "jpm", label: "JPM SW GC" },
    { id: "sticker", label: "Sticker Maker" },
    { id: "multicast", label: "Multicast" },
];

export interface PlanConfig {
    id: PlanId;
    name: string;
    /** Price per month. 0 = free, null = custom/contact sales */
    price: number | null;
    /** Subscription duration in days */
    durationDays: number;
    /** Daily API request limit (-1 = unlimited) */
    dailyLimit: number;
    /** Monthly API request limit (-1 = unlimited) */
    monthlyLimit: number;
    /** Maximum WhatsApp sessions (-1 = unlimited) */
    maxSessions: number;
    /** Highlighted as popular in UI */
    highlight?: boolean;
    /** Feature toggles per plan */
    capabilities: Record<Capability, boolean>;
    /** Additional feature bullet points */
    features: string[];
}

export const PLANS: Record<PlanId, PlanConfig> = {
    FREE: {
        id: "FREE",
        name: "Free",
        price: 0,
        durationDays: 0,
        dailyLimit: 100,
        monthlyLimit: 1000,
        maxSessions: 1,
        capabilities: {
            autoReply: true,
            broadcast: false,
            autoBroadcast: false,
            scheduler: false,
            webhook: false,
            jpm: false,
            sticker: true,
            multicast: false,
        },
        features: [
            "1 WhatsApp Session",
            "100 requests / day",
            "1,000 requests / month",
            "Basic auto-reply",
            "REST API access",
            "Community support"
        ]
    },
    STANDARD: {
        id: "STANDARD",
        name: "Standard",
        price: 50000,
        durationDays: 30,
        dailyLimit: 1000,
        monthlyLimit: 20000,
        maxSessions: 3,
        highlight: true,
        capabilities: {
            autoReply: true,
            broadcast: true,
            autoBroadcast: false,
            scheduler: true,
            webhook: true,
            jpm: false,
            sticker: true,
            multicast: true,
        },
        features: [
            "3 WhatsApp Sessions",
            "1,000 requests / day",
            "20,000 requests / month",
            "Auto-reply + scheduler",
            "Webhook events",
            "Email support"
        ]
    },
    PRO: {
        id: "PRO",
        name: "Pro",
        price: 150000,
        durationDays: 30,
        dailyLimit: 5000,
        monthlyLimit: 100000,
        maxSessions: 10,
        capabilities: {
            autoReply: true,
            broadcast: true,
            autoBroadcast: true,
            scheduler: true,
            webhook: true,
            jpm: true,
            sticker: true,
            multicast: true,
        },
        features: [
            "10 WhatsApp Sessions",
            "5,000 requests / day",
            "100,000 requests / month",
            "All Standard features",
            "Auto broadcast",
            "Priority support"
        ]
    },
    ENTERPRISE: {
        id: "ENTERPRISE",
        name: "Enterprise",
        price: null,
        durationDays: 30,
        dailyLimit: -1,
        monthlyLimit: -1,
        maxSessions: -1,
        capabilities: {
            autoReply: true,
            broadcast: true,
            autoBroadcast: true,
            scheduler: true,
            webhook: true,
            jpm: true,
            sticker: true,
            multicast: true,
        },
        features: [
            "Unlimited WhatsApp Sessions",
            "Unlimited API requests",
            "All Pro features",
            "SLA & dedicated server",
            "Custom onboarding",
            "Dedicated 24/7 support"
        ]
    }
};

export const PLAN_ORDER: PlanId[] = ["FREE", "STANDARD", "PRO", "ENTERPRISE"];

export function getPlanConfig(plan: string | null | undefined): PlanConfig {
    const id = (plan || "FREE").toUpperCase() as PlanId;
    return PLANS[id] || PLANS.FREE;
}

/** Check whether a plan permits a specific capability. */
export function planAllows(cfg: PlanConfig, cap: Capability): boolean {
    return cfg?.capabilities?.[cap] !== false;
}

/**
 * Effective plan calculation.
 */
export function effectivePlan(user: {
    plan?: string | null;
    planExpiresAt?: Date | string | null;
}): PlanId {
    const plan = (user.plan || "FREE").toUpperCase() as PlanId;
    if (plan === "FREE" || !PLANS[plan]) return "FREE";

    if (user.planExpiresAt) {
        const exp = new Date(user.planExpiresAt).getTime();
        if (!Number.isNaN(exp) && exp < Date.now()) return "FREE";
    }
    return plan;
}

export function formatIDR(amount: number | null): string {
    if (amount === null) return "Custom";
    if (amount === 0) return "Free";
    return "₹" + amount.toLocaleString("en-IN");
}
