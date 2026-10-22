export type SiteThemeColor = "emerald" | "sapphire" | "gold" | "crimson" | "violet" | "teal";

export interface SiteService {
    id: string;
    title: string;
    description: string;
    icon?: string;
    tag?: string;
}

export interface SiteFeature {
    id: string;
    title: string;
    description: string;
    icon?: string;
}

export interface SiteTestimonial {
    id: string;
    name: string;
    role?: string;
    comment: string;
    rating: number;
}

export interface GeneratedSite {
    id: string;
    slug: string;
    leadId?: string;
    userId?: string;
    businessName: string;
    tagline: string;
    category: string;
    city?: string;
    address?: string;
    phone: string;
    formattedPhone: string;
    whatsappPhone: string;
    email?: string;
    themeColor: SiteThemeColor;
    headline: string;
    subheadline: string;
    about: {
        title: string;
        description: string;
        highlights: string[];
    };
    services: SiteService[];
    features: SiteFeature[];
    testimonials: SiteTestimonial[];
    workingHours: {
        weekdays: string;
        weekends: string;
    };
    whatsappGreeting: string;
    stats: {
        rating: number;
        reviewsCount: number;
        satisfaction: string;
        experienceYears?: string;
    };
    ctaBanner: {
        title: string;
        subtitle: string;
        buttonText: string;
    };
    viewsCount?: number;
    createdAt: string;
    updatedAt: string;
}

export interface GenerateSiteInput {
    leadId?: string;
    businessName: string;
    category?: string;
    city?: string;
    address?: string;
    phone: string;
    themeColor?: SiteThemeColor;
    headline?: string;
    tagline?: string;
    customServices?: string[];
}
