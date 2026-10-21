-- Additive Instagram/Meta channel automation storage.
-- Generated with Prisma migrate diff from the app schema before Meta channels.
-- The existing User table is pre-existing; the prior channel-rules table gets its optional owner column.

-- CreateTable
CREATE TABLE IF NOT EXISTS "InstagramCommentEvent" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "username" TEXT,
    "commenterId" TEXT,
    "commentText" TEXT NOT NULL,
    "mediaId" TEXT,
    "matchedKeyword" TEXT,
    "status" TEXT NOT NULL DEFAULT 'received',
    "dmMessageId" TEXT,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramCommentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChannelAutoReplyRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "channel" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "matchType" TEXT NOT NULL DEFAULT 'CONTAINS',
    "response" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelAutoReplyRule_pkey" PRIMARY KEY ("id")
);

-- Compatibility for the prior db-push schema, which created channel rules before user scoping.
ALTER TABLE "ChannelAutoReplyRule" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "InstagramAccountConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instagramUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "grantedScopes" TEXT NOT NULL DEFAULT '',
    "webhookSubscribed" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramAccountConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WhatsAppCloudEvent" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "matchedKeyword" TEXT,
    "status" TEXT NOT NULL DEFAULT 'received',
    "responseMessageId" TEXT,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppCloudEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InstagramCommentEvent_commentId_key" ON "InstagramCommentEvent"("commentId");
CREATE INDEX IF NOT EXISTS "InstagramCommentEvent_receivedAt_idx" ON "InstagramCommentEvent"("receivedAt");
CREATE INDEX IF NOT EXISTS "InstagramCommentEvent_status_receivedAt_idx" ON "InstagramCommentEvent"("status", "receivedAt");
CREATE INDEX IF NOT EXISTS "ChannelAutoReplyRule_channel_userId_isActive_createdAt_idx" ON "ChannelAutoReplyRule"("channel", "userId", "isActive", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "InstagramAccountConnection_userId_key" ON "InstagramAccountConnection"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "InstagramAccountConnection_instagramUserId_key" ON "InstagramAccountConnection"("instagramUserId");
CREATE INDEX IF NOT EXISTS "InstagramAccountConnection_instagramUserId_idx" ON "InstagramAccountConnection"("instagramUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppCloudEvent_messageId_key" ON "WhatsAppCloudEvent"("messageId");
CREATE INDEX IF NOT EXISTS "WhatsAppCloudEvent_receivedAt_idx" ON "WhatsAppCloudEvent"("receivedAt");
CREATE INDEX IF NOT EXISTS "WhatsAppCloudEvent_status_receivedAt_idx" ON "WhatsAppCloudEvent"("status", "receivedAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChannelAutoReplyRule_userId_fkey') THEN
        ALTER TABLE "ChannelAutoReplyRule" ADD CONSTRAINT "ChannelAutoReplyRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstagramAccountConnection_userId_fkey') THEN
        ALTER TABLE "InstagramAccountConnection" ADD CONSTRAINT "InstagramAccountConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
