import type { Lead, CSVImportResult } from "./types";

/**
 * Tokenize a CSV string into rows and cells, respecting double quotes, commas inside quotes,
 * and escaped quotes ("").
 */
export function parseCSVToRows(csvText: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = "";
    let insideQuotes = false;

    // Standardize newlines
    const text = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                // Escaped double quote ("")
                currentCell += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                insideQuotes = !insideQuotes;
            }
        } else if (char === "," && !insideQuotes) {
            // End of cell
            currentRow.push(currentCell.trim());
            currentCell = "";
        } else if (char === "\n" && !insideQuotes) {
            // End of row
            currentRow.push(currentCell.trim());
            // Only push non-empty rows
            if (currentRow.some((c) => c.length > 0)) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentCell = "";
        } else {
            currentCell += char;
        }
    }

    // Push trailing cell & row if remaining
    if (currentCell.length > 0 || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c.length > 0)) {
            rows.push(currentRow);
        }
    }

    return rows;
}

/**
 * Normalize phone numbers to international digits-only format for WhatsApp
 */
export function normalizePhoneNumber(rawPhone: string, defaultCountry = "IN"): {
    raw: string;
    formatted: string;
    isValid: boolean;
} {
    if (!rawPhone) return { raw: "", formatted: "", isValid: false };

    // Extract digits only
    let digits = rawPhone.replace(/\D/g, "");

    if (digits.length < 7) {
        return { raw: rawPhone, formatted: "", isValid: false };
    }

    // If country is India (default for Indian format phone numbers starting with 0 or 10-digits)
    if (defaultCountry.toUpperCase() === "IN" || defaultCountry.toLowerCase() === "india") {
        // e.g. "09935370814" -> remove leading 0 -> "9935370814" -> prepend 91 -> "919935370814"
        if (digits.startsWith("0") && digits.length === 11) {
            digits = "91" + digits.slice(1);
        } else if (digits.length === 10 && /^[6-9]/.test(digits)) {
            digits = "91" + digits;
        }
    } else if (defaultCountry.toUpperCase() === "ID" || defaultCountry.toLowerCase() === "indonesia") {
        if (digits.startsWith("0")) {
            digits = "62" + digits.slice(1);
        }
    }

    // Check minimum length for a valid mobile with country code
    const isValid = digits.length >= 10 && digits.length <= 15;
    return {
        raw: rawPhone,
        formatted: digits,
        isValid,
    };
}

/**
 * Parse CSV content and convert into CRM Leads
 */
export function parseLeadsFromCSV(
    csvText: string,
    existingPhoneSet: Set<string> = new Set()
): CSVImportResult {
    const rows = parseCSVToRows(csvText);
    if (rows.length < 2) {
        return {
            totalRows: 0,
            imported: 0,
            skippedDuplicates: 0,
            invalidPhone: 0,
            leads: [],
        };
    }

    const headerRow = rows[0].map((h) => h.trim().toLowerCase());

    // Map column names to header index
    const findIndex = (names: string[]): number => {
        return headerRow.findIndex((h) => names.some((n) => h === n.toLowerCase() || h.includes(n.toLowerCase())));
    };

    const nameIdx = findIndex(["name", "business name", "company", "full name", "title"]);
    const phoneIdx = findIndex(["phone", "phone number", "mobile", "contact", "tel", "cell"]);
    const keywordIdx = findIndex(["keyword", "search keyword", "query"]);
    const categoryIdx = findIndex(["category", "industry", "business type"]);
    const secondCategoryIdx = findIndex(["second category", "sub category", "subcategory"]);
    const fullAddressIdx = findIndex(["full address", "address", "location", "street address"]);
    const cityIdx = findIndex(["city", "town", "municipality"]);
    const stateIdx = findIndex(["state", "province"]);
    const zipIdx = findIndex(["zip", "zip code", "postal code", "pincode"]);
    const countryIdx = findIndex(["country"]);
    const websiteIdx = findIndex(["website", "clean website url", "domain", "url", "web"]);
    const ratingIdx = findIndex(["average rating", "rating", "score"]);
    const reviewsCountIdx = findIndex(["reviews count", "reviews", "review count"]);
    const statusIdx = findIndex(["status", "business status"]);

    const leads: Lead[] = [];
    let skippedDuplicates = 0;
    let invalidPhone = 0;
    const now = new Date().toISOString();

    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];

        const rawName = (nameIdx >= 0 ? row[nameIdx] : "") || `Lead #${r}`;
        const rawPhone = phoneIdx >= 0 ? row[phoneIdx] : "";
        const country = countryIdx >= 0 ? row[countryIdx] : "IN";

        const { formatted, isValid } = normalizePhoneNumber(rawPhone, country || "IN");

        if (!isValid || !formatted) {
            invalidPhone++;
            continue;
        }

        // Check duplicates
        if (existingPhoneSet.has(formatted)) {
            skippedDuplicates++;
            continue;
        }
        existingPhoneSet.add(formatted);

        const category = (categoryIdx >= 0 ? row[categoryIdx] : "") || "General";
        const secondCategory = secondCategoryIdx >= 0 ? row[secondCategoryIdx] : "";
        const keyword = keywordIdx >= 0 ? row[keywordIdx] : "";
        const city = cityIdx >= 0 ? row[cityIdx] : "";
        const state = stateIdx >= 0 ? row[stateIdx] : "";
        const address = fullAddressIdx >= 0 ? row[fullAddressIdx] : "";
        const zip = zipIdx >= 0 ? row[zipIdx] : "";
        const website = websiteIdx >= 0 ? row[websiteIdx] : "";
        const rawRating = ratingIdx >= 0 ? parseFloat(row[ratingIdx]) : NaN;
        const rating = isNaN(rawRating) ? undefined : rawRating;
        const rawReviews = reviewsCountIdx >= 0 ? parseInt(row[reviewsCountIdx], 10) : NaN;
        const reviewsCount = isNaN(rawReviews) ? undefined : rawReviews;
        const status = statusIdx >= 0 ? row[statusIdx] : "open";

        // Generate tags
        const tags: string[] = [];
        if (keyword) tags.push(keyword.toLowerCase());
        if (category) tags.push(category.toLowerCase());
        if (city) tags.push(city.toLowerCase());

        const lead: Lead = {
            id: `lead_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            name: rawName,
            phone: rawPhone,
            formattedPhone: formatted,
            whatsappJid: `${formatted}@s.whatsapp.net`,
            category,
            secondCategory: secondCategory || undefined,
            city: city || undefined,
            state: state || undefined,
            address: address || undefined,
            zip: zip || undefined,
            country: country || "IN",
            website: website || undefined,
            rating,
            reviewsCount,
            keyword: keyword || undefined,
            stage: "NEW",
            tags,
            source: keyword ? `CSV: ${keyword}` : "CSV Import",
            status: status || "open",
            createdAt: now,
            updatedAt: now,
        };

        leads.push(lead);
    }

    return {
        totalRows: rows.length - 1,
        imported: leads.length,
        skippedDuplicates,
        invalidPhone,
        leads,
    };
}
