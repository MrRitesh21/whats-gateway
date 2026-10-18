/**
 * Interpolates variables in template string for personalized messaging.
 * Supports:
 * - {name}, {phone}, {city}, {state}, {category}, {company}, {website}, {address}
 * - Fallbacks with pipe: {name|Customer}, {city|your city}
 * - Case-insensitive variable lookup ({Name}, {CITY}, {phone})
 */
export function interpolateMessage(template: string, vars: Record<string, any>): string {
    if (!template) return "";

    return template.replace(/\{([a-zA-Z0-9_-]+)(?:\|([^}]+))?\}/g, (match, varName, fallback) => {
        const key = varName.toLowerCase();
        let val: any = undefined;

        for (const [k, v] of Object.entries(vars)) {
            if (k.toLowerCase() === key) {
                val = v;
                break;
            }
        }

        if (val !== undefined && val !== null && String(val).trim() !== "") {
            return String(val).trim();
        }

        if (fallback !== undefined) {
            return fallback.trim();
        }

        // Sensible fallbacks if no pipe fallback provided
        if (key === "name") return "Friend";
        return "";
    });
}

/**
 * Extracts all unique placeholder names used in a message template.
 */
export function extractPlaceholders(template: string): string[] {
    if (!template) return [];
    const matches = template.matchAll(/\{([a-zA-Z0-9_-]+)(?:\|[^}]+)?\}/g);
    const keys = new Set<string>();
    for (const match of matches) {
        if (match[1]) keys.add(match[1].toLowerCase());
    }
    return Array.from(keys);
}
