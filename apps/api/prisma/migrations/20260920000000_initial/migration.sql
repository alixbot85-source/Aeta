CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "SystemRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MAINTAINER', 'DEVELOPER', 'VIEWER');
CREATE TYPE "AgentTaskStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_FOR_REVIEW', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "ToolCallStatus" AS ENUM ('SUCCESS', 'ERROR');
CREATE TYPE "TerminalStatus" AS ENUM ('RUNNING', 'EXITED', 'KILLED', 'TIMEOUT', 'ERROR');
CREATE TYPE "ChangeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT,
  "passwordHash" TEXT NOT NULL,
  "role" "SystemRole" NOT NULL DEFAULT 'USER',
  "emailVerifiedAt" TIMESTAMP(3),
  "settings" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Workspace" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "rootPath" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Workspace_ownerId_slug_key" UNIQUE ("ownerId", "slug")
);

CREATE TABLE "WorkspaceMember" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "role" "WorkspaceRole" NOT NULL DEFAULT 'DEVELOPER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceMember_userId_workspaceId_key" UNIQUE ("userId", "workspaceId")
);

CREATE TABLE "Project" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "template" TEXT,
  "framework" TEXT,
  "rootPath" TEXT NOT NULL DEFAULT '',
  "startCommand" TEXT,
  "env" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "File" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "path" TEXT NOT NULL,
  "hash" TEXT,
  "size" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "File_workspaceId_path_key" UNIQUE ("workspaceId", "path")
);

CREATE TABLE "Folder" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "path" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Folder_workspaceId_path_key" UNIQUE ("workspaceId", "path")
);

CREATE TABLE "Session" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "userAgent" TEXT,
  "ip" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "EmailVerificationToken" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PasswordResetToken" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Conversation" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "workspaceId" TEXT REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "title" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Message" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "conversationId" TEXT NOT NULL REFERENCES "Conversation"("id") ON DELETE CASCADE,
  "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AgentTask" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "request" TEXT NOT NULL,
  "status" "AgentTaskStatus" NOT NULL DEFAULT 'QUEUED',
  "plan" TEXT,
  "result" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3)
);

CREATE TABLE "AgentToolCall" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "taskId" TEXT NOT NULL REFERENCES "AgentTask"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "input" JSONB NOT NULL,
  "output" JSONB,
  "status" "ToolCallStatus" NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PendingChange" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "taskId" TEXT REFERENCES "AgentTask"("id") ON DELETE CASCADE,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "path" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "oldContent" TEXT NOT NULL,
  "newContent" TEXT NOT NULL,
  "diff" TEXT NOT NULL,
  "status" "ChangeStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "TerminalSession" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "command" TEXT NOT NULL,
  "cwd" TEXT NOT NULL DEFAULT '',
  "status" "TerminalStatus" NOT NULL DEFAULT 'RUNNING',
  "outputTail" TEXT NOT NULL DEFAULT '',
  "exitCode" INTEGER,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3)
);

CREATE TABLE "GitRepository" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL UNIQUE REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "remoteUrl" TEXT,
  "defaultBranch" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ApiKey" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "encryptedKey" TEXT NOT NULL,
  "iv" TEXT NOT NULL,
  "authTag" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3)
);

CREATE TABLE "Subscription" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "plan" TEXT NOT NULL DEFAULT 'free',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "workspaceId" TEXT REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "action" TEXT NOT NULL,
  "resource" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ChangeHistory" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "userId" TEXT,
  "path" TEXT NOT NULL,
  "oldContent" TEXT,
  "newContent" TEXT,
  "diff" TEXT,
  "action" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AIUsageLog" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "requestId" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "workspaceId" TEXT REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "model" TEXT NOT NULL,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "totalTokens" INTEGER,
  "durationMs" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "WorkspaceMember_workspaceId_idx" ON "WorkspaceMember"("workspaceId");
CREATE INDEX "File_workspaceId_idx" ON "File"("workspaceId");
CREATE INDEX "Folder_workspaceId_idx" ON "Folder"("workspaceId");
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");
CREATE INDEX "AgentTask_workspaceId_idx" ON "AgentTask"("workspaceId");
CREATE INDEX "PendingChange_workspaceId_idx" ON "PendingChange"("workspaceId");
CREATE INDEX "TerminalSession_workspaceId_idx" ON "TerminalSession"("workspaceId");
CREATE INDEX "AuditLog_workspaceId_idx" ON "AuditLog"("workspaceId");
CREATE INDEX "AIUsageLog_workspaceId_idx" ON "AIUsageLog"("workspaceId");
