import { auth } from "./auth";
import { prisma } from "./prisma";
import { logger } from "./logger";
import { cookies } from "next/headers";
import { decode } from "@auth/core/jwt";

/**
 * Gets the currently authenticated user from Next Auth without requiring a Request object.
 * Used primarily for Server Actions.
 */
export async function getAuthenticatedUserForAction() {
    try {
        const session = await auth();
        
        if (session?.user?.id) {
            // Fetch full user data including role to ensure it's up to date
            const user = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { id: true, email: true, name: true, role: true }
            });

            if (user) {
                return user;
            }
        }
    } catch (error) {
        logger.warn("Auth", "auth() in Server Action returned error, checking cookie fallback:", error);
    }

    // Fallback: In Next.js 15/16 + NextAuth v5 beta, auth() in Server Actions can fail
    // to resolve async headers/cookies in certain RSC contexts. Inspect cookies directly.
    try {
        const cookieStore = await cookies();
        const cookieNames = [
            "authjs.session-token",
            "__Secure-authjs.session-token",
            "next-auth.session-token",
            "__Secure-next-auth.session-token"
        ];

        for (const cookieName of cookieNames) {
            const tokenCookie = cookieStore.get(cookieName);
            if (tokenCookie?.value && process.env.AUTH_SECRET) {
                try {
                    const decoded = await decode({
                        token: tokenCookie.value,
                        secret: process.env.AUTH_SECRET,
                        salt: cookieName
                    });
                    const userId = (decoded?.id as string) || (decoded?.sub as string);
                    if (userId) {
                        const user = await prisma.user.findUnique({
                            where: { id: userId },
                            select: { id: true, email: true, name: true, role: true }
                        });
                        if (user) return user;
                    }
                } catch {
                    // Try next cookie candidate
                }
            }
        }
    } catch (cookieErr) {
        logger.error("Auth", "Direct cookie fallback error in Server Action:", cookieErr);
    }

    return null;
}

