export interface SessionPersonaConfig {
    systemInstructions: string;
    sessionSystemInstructions?: Record<string, string>;
}

/** Return a non-empty per-session persona, otherwise preserve the shared default. */
export function resolveSessionSystemInstructions(config: SessionPersonaConfig, sessionId?: string): string {
    const specific = sessionId ? config.sessionSystemInstructions?.[sessionId]?.trim() : "";
    return specific || config.systemInstructions;
}
