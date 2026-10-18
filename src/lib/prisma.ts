import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // Disable all logging to prevent Railway log rate limit
    log: [],
  });

globalForPrisma.prisma = prisma;
