import type { AIAccount, ChatMessage } from "./types";

interface ProviderCallParams {
    account: AIAccount;
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
}

/**
 * Universal caller for OpenAI-compatible endpoints:
 * Supports OpenAI, Groq, DeepSeek, OpenRouter, and custom endpoints.
 */
async function callOpenAICompatible(
    baseUrl: string,
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    temperature = 0.7,
    maxTokens = 1024,
    timeoutMs = 25000,
    headersExtra: Record<string, string> = {}
): Promise<{ text: string; tokens?: number }> {
    const cleanUrl = baseUrl.replace(/\/+$/, "");
    const endpoint = cleanUrl.endsWith("/chat/completions") ? cleanUrl : `${cleanUrl}/chat/completions`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...headersExtra,
        };
        if (apiKey) {
            headers["Authorization"] = `Bearer ${apiKey.trim()}`;
        }

        const res = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify({
                model,
                messages,
                temperature,
                max_tokens: maxTokens,
            }),
            signal: controller.signal,
        });

        if (!res.ok) {
            const errBody = await res.text().catch(() => "");
            throw new Error(`HTTP ${res.status}: ${errBody || res.statusText}`);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "";
        const tokens = data.usage?.total_tokens;
        return { text: content.trim(), tokens };
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Google Gemini API caller (v1beta)
 */
async function callGemini(
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    temperature = 0.7,
    maxTokens = 1024,
    timeoutMs = 25000
): Promise<{ text: string; tokens?: number }> {
    const m = model || "gemini-2.0-flash";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    // Format for Gemini API: separate system instructions and user/model turns
    const systemParts = messages
        .filter((msg) => msg.role === "system")
        .map((msg) => ({ text: msg.content }));

    const contents = messages
        .filter((msg) => msg.role !== "system")
        .map((msg) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        }));

    // If no user message was provided, create one
    if (contents.length === 0) {
        contents.push({ role: "user", parts: [{ text: "Hello" }] });
    }

    const payload: any = {
        contents,
        generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
        },
    };

    if (systemParts.length > 0) {
        payload.system_instruction = { parts: systemParts };
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey.trim()}`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        if (!res.ok) {
            const errBody = await res.text().catch(() => "");
            throw new Error(`Gemini HTTP ${res.status}: ${errBody || res.statusText}`);
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const tokens = data.usageMetadata?.totalTokenCount;
        return { text: text.trim(), tokens };
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Anthropic Claude API caller
 */
async function callAnthropic(
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    temperature = 0.7,
    maxTokens = 1024,
    timeoutMs = 25000
): Promise<{ text: string; tokens?: number }> {
    const m = model || "claude-3-5-sonnet-20241022";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    // Anthropic separates system message into top-level parameter
    const system = messages
        .filter((msg) => msg.role === "system")
        .map((msg) => msg.content)
        .join("\n\n");

    const anthropicMessages = messages
        .filter((msg) => msg.role !== "system")
        .map((msg) => ({
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.content,
        }));

    if (anthropicMessages.length === 0) {
        anthropicMessages.push({ role: "user", content: "Hello" });
    }

    try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey.trim(),
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: m,
                system: system || undefined,
                messages: anthropicMessages,
                max_tokens: maxTokens,
                temperature,
            }),
            signal: controller.signal,
        });

        if (!res.ok) {
            const errBody = await res.text().catch(() => "");
            throw new Error(`Anthropic HTTP ${res.status}: ${errBody || res.statusText}`);
        }

        const data = await res.json();
        const text = data.content?.[0]?.text || "";
        const tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
        return { text: text.trim(), tokens };
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Ollama Local AI caller
 */
async function callOllama(
    baseUrl: string,
    model: string,
    messages: ChatMessage[],
    temperature = 0.7,
    timeoutMs = 25000
): Promise<{ text: string; tokens?: number }> {
    const base = (baseUrl || "http://localhost:11434").replace(/\/+$/, "");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(`${base}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: model || "llama3",
                messages,
                stream: false,
                options: { temperature },
            }),
            signal: controller.signal,
        });

        if (!res.ok) {
            const errBody = await res.text().catch(() => "");
            throw new Error(`Ollama HTTP ${res.status}: ${errBody || res.statusText}`);
        }

        const data = await res.json();
        const text = data.message?.content || "";
        return { text: text.trim() };
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Dispatch call to corresponding provider based on account configuration
 */
export async function executeProviderCall(
    params: ProviderCallParams
): Promise<{ text: string; tokens?: number }> {
    const { account, messages, temperature = 0.7, maxTokens = 1024, timeoutMs = 25000 } = params;

    switch (account.provider) {
        case "openai": {
            const base = account.baseUrl || "https://api.openai.com/v1";
            return callOpenAICompatible(base, account.apiKey, account.model || "gpt-4o-mini", messages, temperature, maxTokens, timeoutMs);
        }
        case "gemini": {
            return callGemini(account.apiKey, account.model || "gemini-2.0-flash", messages, temperature, maxTokens, timeoutMs);
        }
        case "anthropic": {
            return callAnthropic(account.apiKey, account.model || "claude-3-5-sonnet-20241022", messages, temperature, maxTokens, timeoutMs);
        }
        case "groq": {
            const base = account.baseUrl || "https://api.groq.com/openai/v1";
            let model = account.model?.trim() || "openai/gpt-oss-120b";
            // Map enterprise-restricted / unavailable Groq models to active production models
            if (model === "llama-3.3-70b-versatile" || model === "llama-3.1-8b-instant") {
                model = "openai/gpt-oss-120b";
            }
            try {
                return await callOpenAICompatible(base, account.apiKey, model, messages, temperature, maxTokens, timeoutMs);
            } catch (err: any) {
                const errMsg = String(err?.message || "");
                if (errMsg.includes("model_not_found") || errMsg.includes("does not exist") || errMsg.includes("404")) {
                    const fallbackModel = model === "openai/gpt-oss-20b" ? "openai/gpt-oss-120b" : "openai/gpt-oss-20b";
                    return await callOpenAICompatible(base, account.apiKey, fallbackModel, messages, temperature, maxTokens, timeoutMs);
                }
                throw err;
            }
        }
        case "deepseek": {
            const base = account.baseUrl || "https://api.deepseek.com/v1";
            return callOpenAICompatible(base, account.apiKey, account.model || "deepseek-chat", messages, temperature, maxTokens, timeoutMs);
        }
        case "openrouter": {
            const base = account.baseUrl || "https://openrouter.ai/api/v1";
            return callOpenAICompatible(
                base,
                account.apiKey,
                account.model || "meta-llama/llama-3.1-8b-instruct:free",
                messages,
                temperature,
                maxTokens,
                timeoutMs,
                { "HTTP-Referer": "https://webotapp.com", "X-Title": "WebotApp AI Gateway" }
            );
        }
        case "ollama": {
            return callOllama(account.baseUrl || "http://localhost:11434", account.model || "llama3", messages, temperature, timeoutMs);
        }
        case "custom": {
            const base = account.baseUrl || "http://localhost:8000/v1";
            return callOpenAICompatible(base, account.apiKey, account.model || "default", messages, temperature, maxTokens, timeoutMs);
        }
        default:
            throw new Error(`Unsupported AI provider: ${account.provider}`);
    }
}
