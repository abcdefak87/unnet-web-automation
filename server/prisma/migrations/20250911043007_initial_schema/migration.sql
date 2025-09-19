-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "permissions" TEXT,
    "phone" TEXT,
    "whatsappNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLogin" DATETIME,
    "whatsappJid" TEXT,
    "refreshTokenHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "whatsapp_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "content" BLOB NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "whatsapp_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "messagesFailed" INTEGER NOT NULL DEFAULT 0,
    "messagesQueued" INTEGER NOT NULL DEFAULT 0,
    "connections" INTEGER NOT NULL DEFAULT 0,
    "disconnects" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" REAL,
    "metadata" TEXT
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "content" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "deliveredAt" DATETIME,
    "readAt" DATETIME
);

-- CreateTable
CREATE TABLE "whatsapp_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME
);

-- CreateTable
CREATE TABLE "otps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "error" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "technicians" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsappJid" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "skills" TEXT,
    "lastKnownLat" REAL,
    "lastKnownLon" REAL,
    "lastLocationUpdate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "email" TEXT,
    "ktpName" TEXT,
    "ktpNumber" TEXT,
    "ktpAddress" TEXT,
    "ktpPhotoUrl" TEXT,
    "housePhotoUrl" TEXT,
    "shareLocation" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "installationType" TEXT,
    "registrationStatus" TEXT DEFAULT 'PENDING',
    "packageType" TEXT,
    "registeredAt" DATETIME,
    "approvedAt" DATETIME,
    "approvedById" TEXT,
    "rejectedAt" DATETIME,
    "rejectedById" TEXT,
    "rejectionReason" TEXT,
    "registrationIP" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'PSB',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "title" TEXT,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "scheduledDate" DATETIME,
    "assignmentType" TEXT NOT NULL DEFAULT 'SINGLE',
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" DATETIME,
    "approvedById" TEXT,
    "rejectedAt" DATETIME,
    "rejectedById" TEXT,
    "rejectionReason" TEXT,
    "customerId" TEXT NOT NULL,
    "createdById" TEXT,
    "housePhotoUrl" TEXT,
    "idCardPhotoUrl" TEXT,
    "problemType" TEXT,
    "completedAt" DATETIME,
    "completionPhotoUrl" TEXT,
    "completionNotes" TEXT,
    "technicianLocation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "jobs_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "jobs_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "jobs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "job_technicians" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PRIMARY',
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" DATETIME,
    "arrivedAt" DATETIME,
    "completedAt" DATETIME,
    "completionNotes" TEXT,
    "customerRating" INTEGER,
    CONSTRAINT "job_technicians_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "job_technicians_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'KEPERLUAN_BERSAMA',
    "subcategory" TEXT,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "price" REAL NOT NULL DEFAULT 0,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBatch" BOOLEAN NOT NULL DEFAULT false,
    "batchType" TEXT,
    "serialNumbers" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "modem_batch_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "serialNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "modem_batch_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "modem_batch_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inventory_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "userId" TEXT,
    "technicianId" TEXT,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousStock" INTEGER,
    "newStock" INTEGER,
    "notes" TEXT,
    "jobId" TEXT,
    "supplier" TEXT,
    "invoiceNumber" TEXT,
    "receivedDate" DATETIME,
    "recipient" TEXT,
    "purpose" TEXT,
    "usedDate" DATETIME,
    "returnReason" TEXT,
    "returnDate" DATETIME,
    "damageReason" TEXT,
    "damageDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_logs_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_logs_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inventory_usage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantityUsed" INTEGER NOT NULL,
    "quantityReturned" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "inventory_usage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_usage_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "jobId" TEXT,
    "userId" TEXT,
    "sentAt" DATETIME,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "notifications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "team_rooms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "team_rooms_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "team_room_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "metadata" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_room_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "team_rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "team_room_messages_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "technician_registrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramChatId" TEXT NOT NULL,
    "telegramUsername" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" DATETIME,
    "approvedById" TEXT,
    "rejectedAt" DATETIME,
    "rejectedById" TEXT,
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "technician_registrations_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "technician_registrations_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_whatsappNumber_key" ON "users"("whatsappNumber");

-- CreateIndex
CREATE UNIQUE INDEX "users_whatsappJid_key" ON "users"("whatsappJid");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_sessions_fileName_key" ON "whatsapp_sessions"("fileName");

-- CreateIndex
CREATE INDEX "whatsapp_metrics_timestamp_idx" ON "whatsapp_metrics"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_messageId_key" ON "whatsapp_messages"("messageId");

-- CreateIndex
CREATE INDEX "whatsapp_messages_from_to_idx" ON "whatsapp_messages"("from", "to");

-- CreateIndex
CREATE INDEX "whatsapp_messages_status_idx" ON "whatsapp_messages"("status");

-- CreateIndex
CREATE INDEX "whatsapp_messages_createdAt_idx" ON "whatsapp_messages"("createdAt");

-- CreateIndex
CREATE INDEX "whatsapp_alerts_level_resolved_idx" ON "whatsapp_alerts"("level", "resolved");

-- CreateIndex
CREATE INDEX "whatsapp_alerts_createdAt_idx" ON "whatsapp_alerts"("createdAt");

-- CreateIndex
CREATE INDEX "otps_identifier_type_idx" ON "otps"("identifier", "type");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_ip_idx" ON "audit_logs"("ip");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "technicians_phone_key" ON "technicians"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "technicians_whatsappJid_key" ON "technicians"("whatsappJid");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_ktpNumber_key" ON "customers"("ktpNumber");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_ktpNumber_idx" ON "customers"("ktpNumber");

-- CreateIndex
CREATE INDEX "customers_registrationStatus_idx" ON "customers"("registrationStatus");

-- CreateIndex
CREATE INDEX "customers_registeredAt_idx" ON "customers"("registeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_jobNumber_key" ON "jobs"("jobNumber");

-- CreateIndex
CREATE UNIQUE INDEX "job_technicians_jobId_technicianId_key" ON "job_technicians"("jobId", "technicianId");

-- CreateIndex
CREATE UNIQUE INDEX "items_code_key" ON "items"("code");

-- CreateIndex
CREATE UNIQUE INDEX "modem_batch_items_batchId_itemId_key" ON "modem_batch_items"("batchId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "team_rooms_jobId_key" ON "team_rooms"("jobId");
