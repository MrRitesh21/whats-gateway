import fs from "node:fs/promises";
import path from "node:path";
import type { GeneratedSite, GenerateSiteInput, SiteThemeColor } from "./types";
import { matchCategoryPreset, THEME_CONFIGS, CATEGORY_PRESETS } from "./presets";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getCRMData, saveLead } from "@/lib/crm/storage";
import { normalizePhoneNumber } from "@/lib/crm/csv-parser";

const DATA_DIR = path.join(process.cwd(), "data");
const DEFAULT_SITES_FILE = path.join(DATA_DIR, "generated-sites.json");

function normalizeKey(userId?: string): string {
    if (!userId || typeof userId !== "string") return "default";
    const trimmed = userId.trim();
    if (!trimmed || trimmed === "default") return "default";
    return trimmed;
}

function getCacheKey(userId?: string): string {
    const key = normalizeKey(userId);
    return key === "default" ? "default" : `user_${key}`;
}

function getConfigFile(userId?: string): string {
    const key = normalizeKey(userId);
    return key === "default" ? DEFAULT_SITES_FILE : path.join(DATA_DIR, `generated-sites-${key}.json`);
}

function getRecordId(userId?: string): string {
    return `sites_${normalizeKey(userId)}`;
}

// In-memory cache for fast public loading
interface CacheEntry {
    sites: GeneratedSite[];
    lastReadTime: number;
}
const inMemoryCaches = new Map<string, CacheEntry>();
const CACHE_TTL = 30000;

// Global slug-to-site cache for lightning-fast public access
const slugLookupCache = new Map<string, { site: GeneratedSite; expires: number }>();

function generateSlug(name: string, city?: string): string {
    const cleanName = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
    const cleanCity = (city || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 20);
    const randomSuffix = Math.random().toString(36).substring(2, 6);

    const parts = [cleanName, cleanCity, randomSuffix].filter(Boolean);
    return parts.join("-");
}

export async function getSitesData(userId?: string): Promise<GeneratedSite[]> {
    const key = getCacheKey(userId);
    const now = Date.now();
    const cached = inMemoryCaches.get(key);
    if (cached && now - cached.lastReadTime < CACHE_TTL) {
        return cached.sites;
    }

    const recordId = getRecordId(userId);
    const configFile = getConfigFile(userId);

    try {
        // 1. Try reading from PostgreSQL SystemConfig
        const cfg = await prisma.systemConfig.findUnique({
            where: { id: recordId },
            select: { crmData: true },
        }).catch(() => null);

        if (cfg?.crmData && typeof cfg.crmData === "object") {
            const dataObj = cfg.crmData as any;
            if (Array.isArray(dataObj.sites)) {
                const sites: GeneratedSite[] = dataObj.sites;
                inMemoryCaches.set(key, { sites, lastReadTime: now });
                for (const s of sites) {
                    slugLookupCache.set(s.slug, { site: s, expires: now + CACHE_TTL });
                }
                return sites;
            }
        }

        // 2. Fallback to local file
        await fs.mkdir(DATA_DIR, { recursive: true });
        const fileContent = await fs.readFile(configFile, "utf-8").catch(() => null);
        if (fileContent) {
            const parsed = JSON.parse(fileContent);
            const sites: GeneratedSite[] = Array.isArray(parsed) ? parsed : [];
            inMemoryCaches.set(key, { sites, lastReadTime: now });
            for (const s of sites) {
                slugLookupCache.set(s.slug, { site: s, expires: now + CACHE_TTL });
            }
            return sites;
        }
    } catch (err) {
        logger.error("Sites", "Failed to load sites", err);
    }

    return [];
}

export async function saveSitesData(sites: GeneratedSite[], userId?: string): Promise<void> {
    const key = getCacheKey(userId);
    const recordId = getRecordId(userId);
    const configFile = getConfigFile(userId);

    // Update in-memory cache
    inMemoryCaches.set(key, { sites, lastReadTime: Date.now() });
    for (const s of sites) {
        slugLookupCache.set(s.slug, { site: s, expires: Date.now() + CACHE_TTL });
    }

    // 1. Write to PostgreSQL SystemConfig
    try {
        await prisma.systemConfig.upsert({
            where: { id: recordId },
            update: {
                crmData: { sites } as any,
            },
            create: {
                id: recordId,
                appName: "WAFlow Sites",
                crmData: { sites } as any,
            },
        });
    } catch (err) {
        logger.error("Sites", "DB save error for sites", err);
    }

    // 2. Mirror to local file
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const tempFile = `${configFile}.tmp.${Date.now()}`;
        await fs.writeFile(tempFile, JSON.stringify(sites, null, 2), "utf-8");
        await fs.rename(tempFile, configFile);
    } catch {
        // non-fatal
    }
}

/**
 * Public lookup: Find a site by its unique URL slug
 */
export async function getSiteBySlug(slug: string): Promise<GeneratedSite | null> {
    const now = Date.now();
    const mem = slugLookupCache.get(slug);
    if (mem && mem.expires > now) {
        return mem.site;
    }

    // 1. Check in cached sites of all loaded users
    for (const [, cache] of inMemoryCaches) {
        const found = cache.sites.find((s) => s.slug === slug);
        if (found) {
            slugLookupCache.set(slug, { site: found, expires: now + CACHE_TTL });
            return found;
        }
    }

    // 2. Query DB directly for SystemConfig rows that match sites_*
    try {
        const configs = await prisma.systemConfig.findMany({
            where: {
                id: { startsWith: "sites_" },
            },
            select: { crmData: true },
        }).catch(() => []);

        for (const cfg of configs) {
            const dataObj = cfg?.crmData as any;
            if (Array.isArray(dataObj?.sites)) {
                const found = dataObj.sites.find((s: GeneratedSite) => s.slug === slug);
                if (found) {
                    slugLookupCache.set(slug, { site: found, expires: now + CACHE_TTL });
                    return found;
                }
            }
        }
    } catch (err) {
        logger.error("Sites", "DB search for slug failed", err);
    }

    // 3. Fallback scan local files in DATA_DIR
    try {
        const files = await fs.readdir(DATA_DIR).catch(() => []);
        for (const file of files) {
            if (file.startsWith("generated-sites") && file.endsWith(".json")) {
                const content = await fs.readFile(path.join(DATA_DIR, file), "utf-8").catch(() => null);
                if (content) {
                    const parsed = JSON.parse(content);
                    if (Array.isArray(parsed)) {
                        const found = parsed.find((s: GeneratedSite) => s.slug === slug);
                        if (found) {
                            slugLookupCache.set(slug, { site: found, expires: now + CACHE_TTL });
                            return found;
                        }
                    }
                }
            }
        }
    } catch {
        // non-fatal
    }

    return null;
}

/**
 * Generate a complete, mobile-friendly website in 1 click and link to CRM lead
 */
export async function generateAndSaveSite(
    input: GenerateSiteInput,
    userId?: string
): Promise<{ site: GeneratedSite; leadUpdated?: boolean }> {
    const businessName = input.businessName.trim();
    const city = input.city?.trim() || undefined;
    const address = input.address?.trim() || undefined;

    // Normalize phone for WhatsApp action
    const { formatted } = normalizePhoneNumber(input.phone, "IN");
    const rawPhone = input.phone.trim();
    const formattedPhone = formatted || rawPhone.replace(/\D/g, "");
    const whatsappPhone = formattedPhone;

    // Find category preset
    let preset = matchCategoryPreset(input.category, businessName);
    // If explicit category is in presets
    if (input.category && CATEGORY_PRESETS[input.category.toLowerCase()]) {
        preset = CATEGORY_PRESETS[input.category.toLowerCase()];
    }

    const themeColor: SiteThemeColor = input.themeColor || preset.defaultTheme;
    const slug = generateSlug(businessName, city);
    const now = new Date().toISOString();

    const headline = input.headline?.trim() || preset.headline(businessName, city);
    const tagline = input.tagline?.trim() || preset.tagline(businessName, city);
    const subheadline = preset.subheadline(businessName, city);

    // Custom services or preset services
    let services = preset.services;
    if (Array.isArray(input.customServices) && input.customServices.length > 0) {
        services = input.customServices.map((title, i) => ({
            id: `custom_s_${i + 1}`,
            title,
            description: `Professional, guaranteed ${title.toLowerCase()} service tailored to your exact needs.`,
            icon: i === 0 ? "Sparkles" : "CheckCircle2",
        }));
    }

    const siteId = `site_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const site: GeneratedSite = {
        id: siteId,
        slug,
        leadId: input.leadId,
        userId: userId ? normalizeKey(userId) : undefined,
        businessName,
        tagline,
        category: preset.label,
        city,
        address,
        phone: rawPhone,
        formattedPhone,
        whatsappPhone,
        themeColor,
        headline,
        subheadline,
        about: {
            title: preset.aboutTitle,
            description: preset.aboutDescription(businessName, city),
            highlights: preset.highlights,
        },
        services,
        features: preset.features,
        testimonials: preset.testimonials(businessName),
        workingHours: {
            weekdays: "9:00 AM - 8:00 PM",
            weekends: "10:00 AM - 6:00 PM",
        },
        whatsappGreeting: preset.whatsappGreeting(businessName),
        stats: {
            rating: 4.9,
            reviewsCount: Math.floor(Math.random() * 80) + 120, // 120-200 reviews
            satisfaction: "99.4%",
            experienceYears: "10+ Years",
        },
        ctaBanner: {
            title: `Ready to Experience Exceptional Service?`,
            subtitle: `Connect directly with our team on WhatsApp for instant booking & consultation.`,
            buttonText: `Chat with Us on WhatsApp`,
        },
        viewsCount: 0,
        createdAt: now,
        updatedAt: now,
    };

    // Save site to database & storage
    const allSites = await getSitesData(userId);
    // Replace if lead already had a site
    const existingIndex = input.leadId ? allSites.findIndex((s) => s.leadId === input.leadId) : -1;
    if (existingIndex >= 0) {
        allSites[existingIndex] = site;
    } else {
        allSites.unshift(site);
    }
    await saveSitesData(allSites, userId);

    // If leadId is provided, update the lead in CRM Store automatically!
    let leadUpdated = false;
    if (input.leadId) {
        try {
            const crmData = await getCRMData(userId);
            const lead = crmData.leads.find((l) => l.id === input.leadId);
            if (lead) {
                const websiteUrl = `/site/${site.slug}`;
                lead.website = websiteUrl;
                lead.updatedAt = new Date().toISOString();

                // Add activity note
                if (!lead.activities) lead.activities = [];
                lead.activities.unshift({
                    id: `act_${Date.now()}_site`,
                    type: "note",
                    content: `✨ Created instant mobile website: ${websiteUrl}`,
                    createdAt: new Date().toISOString(),
                    author: "System / AI",
                });

                await saveLead(lead, userId);
                leadUpdated = true;
            }
        } catch (err) {
            logger.error("Sites", "Failed to link website to CRM lead", err);
        }
    }

    return { site, leadUpdated };
}
