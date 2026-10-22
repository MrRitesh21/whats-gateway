export type FieldType = "text" | "tel" | "email" | "textarea" | "select" | "number";

export interface FormField {
    id: string;
    label: string;
    type: FieldType;
    placeholder?: string;
    required: boolean;
    options?: string[]; // for select dropdowns
    defaultValue?: string;
    helpText?: string;
}

export type OutreachMode = "ai_personalized" | "template";
export type FormTheme = "emerald" | "dark" | "slate" | "indigo" | "minimal" | "custom";

export interface LeadForm {
    id: string; // unique slug e.g. "website-contact"
    userId?: string;
    title: string;
    description?: string;
    fields: FormField[];
    submitButtonText: string;
    successMessage: string;
    redirectUrl?: string; // Optional URL to redirect after submission

    // WhatsApp & CRM Routing
    sessionId: string; // Connected WhatsApp session to send outreach from
    leadStage: string; // Default "NEW" or "INTERESTED"
    leadCategory: string; // e.g. "Website Inbound"
    leadTags: string[]; // e.g. ["website", "lead-form"]

    // AI Outreach Automation
    enableAiOutreach: boolean;
    /** Create an in-app notification for the form owner on every new submission. */
    enableLeadAlerts?: boolean;
    outreachMode: OutreachMode; // "ai_personalized" | "template"
    aiPrompt?: string; // Custom instructions for AI outreach
    templateMessage?: string; // Fallback or template with {{name}}, {{phone}}, etc.

    // Styling & Theme for Client Website Integration
    theme: FormTheme;
    customCss?: string; // Client can add any custom CSS to match website theme
    brandColor?: string; // Hex color e.g. #10B981
    backgroundColor?: string; // Hex e.g. #ffffff
    textColor?: string;
    borderRadius?: number; // e.g. 12

    // Analytics
    viewsCount: number;
    submissionsCount: number;
    outreachSentCount: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface FormSubmission {
    id: string;
    userId?: string;
    formId: string;
    data: Record<string, string>; // field values
    leadId?: string; // Reference to CRM lead
    phone: string;
    name?: string;
    email?: string;
    aiOutreachStatus: "PENDING" | "SENT" | "FAILED" | "DISABLED";
    aiOutreachMessage?: string;
    errorMessage?: string;
    ip?: string;
    createdAt: string;
}

export interface FormsStoreData {
    forms: LeadForm[];
    submissions: FormSubmission[];
}
