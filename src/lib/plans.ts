// ============================================================
// PLAN & PRICING CONFIG (Single Source of Truth)
// ------------------------------------------------------------
// Pricing, limits, and capabilities are configured here.
// Admin can override values dynamically via Dashboard -> Settings -> Plans & Pricing.
//
// Notes on limits:
// - limit -1 = unlimited.
// - price 0 = free; price null = custom/contact sales.
// ============================================================

export type PlanId = "FREE" | "STANDARD" | "PRO" | "ENTERPRISE";

// All features that can be toggled on/off per plan.
// Controls dashboard navigation visibility, API rate-limiting, and pricing benefits.
export type Capability =
    // Messaging
    | "chat"
    | "bulkMessenger"
    | "broadcast"
    | "sticker"
    // Contacts & CRM
    | "crm"
    | "leadForms"
    | "contacts"
    | "groups"
    | "labels"
    // Automation & AI
    | "smartAi"
    | "botSettings"
    | "autoReply"
    | "botProfile"
    | "scheduler"
    | "autoBroadcast"
    | "jpm"
    // Developer & Tools
    | "webhook"
    | "mcp"
    | "apiDocs"
    | "mediaManager"
    | "multicast";

export type CapabilityCategory = "Messaging" | "Contacts & CRM" | "Automation & AI" | "Developer & Tools";

export interface CapabilityDef {
    id: Capability;
    label: string;
    category: CapabilityCategory;
    description: string;
}

export const CAPABILITIES: CapabilityDef[] = [
    // Messaging
    {
        id: "chat",
        label: "Live Chat & Inbox",
        category: "Messaging",
        description: "Live WhatsApp chat interface and direct conversations",
    },
    {
        id: "bulkMessenger",
        label: "Bulk Messenger",
        category: "Messaging",
        description: "CSV and contact list bulk messaging campaigns with anti-ban",
    },
    {
        id: "broadcast",
        label: "Quick Broadcast",
        category: "Messaging",
        description: "One-click broadcast messages to multiple recipients",
    },
    {
        id: "sticker",
        label: "Sticker Maker",
        category: "Messaging",
        description: "Convert photos and media into WhatsApp stickers",
    },

    // Contacts & CRM
    {
        id: "crm",
        label: "CRM & Leads",
        category: "Contacts & CRM",
        description: "Lead tracking, pipeline stages, notes, and value tracking",
    },
    {
        id: "leadForms",
        label: "Lead Forms & AI Outreach",
        category: "Contacts & CRM",
        description: "Custom embeddable forms with instant AI WhatsApp outreach",
    },
    {
        id: "contacts",
        label: "Contacts Directory",
        category: "Contacts & CRM",
        description: "Address book management, contact import and CSV export",
    },
    {
        id: "groups",
        label: "WhatsApp Groups",
        category: "Contacts & CRM",
        description: "Group discovery, member inspection, and invitation links",
    },
    {
        id: "labels",
        label: "Chat Labels & Tags",
        category: "Contacts & CRM",
        description: "Color-coded labels and tagging for chats and contacts",
    },

    // Automation & AI
    {
        id: "smartAi",
        label: "Smart AI & RAG",
        category: "Automation & AI",
        description: "AI Gateway, vector embeddings, documents, and LLM chat",
    },
    {
        id: "botSettings",
        label: "Bot Settings",
        category: "Automation & AI",
        description: "AI bot personality, custom instructions, and behavior rules",
    },
    {
        id: "autoReply",
        label: "Auto Reply Rules",
        category: "Automation & AI",
        description: "Automated keyword triggers and auto-reply workflows",
    },
    {
        id: "botProfile",
        label: "Bot Profile",
        category: "Automation & AI",
        description: "WhatsApp display name, bio status, and avatar customization",
    },
    {
        id: "scheduler",
        label: "Message Scheduler",
        category: "Automation & AI",
        description: "Scheduled messages, recurring queues, and delivery reminders",
    },
    {
        id: "autoBroadcast",
        label: "Auto Broadcast Drips",
        category: "Automation & AI",
        description: "Automated drip campaigns and interval-based broadcasts",
    },
    {
        id: "jpm",
        label: "JPM SW GC",
        category: "Automation & AI",
        description: "Join/Promote/Message group cloner and blaster tools",
    },

    // Developer & Tools
    {
        id: "webhook",
        label: "Webhook & API Events",
        category: "Developer & Tools",
        description: "Real-time incoming and outgoing webhook event integrations",
    },
    {
        id: "mcp",
        label: "MCP & Claude AI",
        category: "Developer & Tools",
        description: "Model Context Protocol tools and Claude desktop connectivity",
    },
    {
        id: "apiDocs",
        label: "API Docs & Swagger",
        category: "Developer & Tools",
        description: "Interactive Swagger UI and REST API documentation",
    },
    {
        id: "mediaManager",
        label: "Media Manager",
        category: "Developer & Tools",
        description: "Media asset repository and server disk storage manager",
    },
    {
        id: "multicast",
        label: "Multicast Forwarding",
        category: "Developer & Tools",
        description: "Cross-session message routing and multi-target delivery",
    },
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
            chat: true,
            bulkMessenger: false,
            broadcast: false,
            sticker: true,
            crm: false,
            leadForms: false,
            contacts: true,
            groups: true,
            labels: true,
            smartAi: false,
            botSettings: false,
            autoReply: true,
            botProfile: true,
            scheduler: false,
            autoBroadcast: false,
            jpm: false,
            webhook: false,
            mcp: false,
            apiDocs: true,
            mediaManager: true,
            multicast: false,
        },
        features: [
            "1 WhatsApp Session",
            "100 requests / day",
            "1,000 requests / month",
            "Basic Live Chat & Auto-Reply",
            "Contacts & Groups Management",
            "Sticker Maker",
            "Community Support",
        ],
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
            chat: true,
            bulkMessenger: true,
            broadcast: true,
            sticker: true,
            crm: true,
            leadForms: true,
            contacts: true,
            groups: true,
            labels: true,
            smartAi: false,
            botSettings: true,
            autoReply: true,
            botProfile: true,
            scheduler: true,
            autoBroadcast: false,
            jpm: false,
            webhook: true,
            mcp: false,
            apiDocs: true,
            mediaManager: true,
            multicast: true,
        },
        features: [
            "3 WhatsApp Sessions",
            "1,000 requests / day",
            "20,000 requests / month",
            "Bulk Messenger & Campaigns",
            "CRM & Lead Forms with AI Outreach",
            "Scheduler & Webhooks",
            "Email Support",
        ],
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
            chat: true,
            bulkMessenger: true,
            broadcast: true,
            sticker: true,
            crm: true,
            leadForms: true,
            contacts: true,
            groups: true,
            labels: true,
            smartAi: true,
            botSettings: true,
            autoReply: true,
            botProfile: true,
            scheduler: true,
            autoBroadcast: true,
            jpm: true,
            webhook: true,
            mcp: true,
            apiDocs: true,
            mediaManager: true,
            multicast: true,
        },
        features: [
            "10 WhatsApp Sessions",
            "5,000 requests / day",
            "100,000 requests / month",
            "All Standard features",
            "Smart AI & RAG Vector Knowledge",
            "Auto Broadcast & Drip Campaigns",
            "JPM SW GC Group Tools",
            "MCP & Claude AI Integration",
            "Priority Support",
        ],
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
            chat: true,
            bulkMessenger: true,
            broadcast: true,
            sticker: true,
            crm: true,
            leadForms: true,
            contacts: true,
            groups: true,
            labels: true,
            smartAi: true,
            botSettings: true,
            autoReply: true,
            botProfile: true,
            scheduler: true,
            autoBroadcast: true,
            jpm: true,
            webhook: true,
            mcp: true,
            apiDocs: true,
            mediaManager: true,
            multicast: true,
        },
        features: [
            "Unlimited WhatsApp Sessions",
            "Unlimited API Requests",
            "All Platform Features Unlocked",
            "Dedicated High-Performance Node",
            "SLA & Custom Onboarding",
            "24/7 Dedicated Support",
        ],
    },
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