# Customer Notification System

## Overview

This system automatically sends WhatsApp notifications to customers when their disturbance tickets (GANGGUAN) or installation tickets (PSB) are created, assigned to technicians, started, completed, or cancelled.

## Implementation Details

### 1. CustomerNotificationService

**File**: `server/services/CustomerNotificationService.js`

This service handles all customer notifications with the following methods:

- `notifyTicketCreated(job)` - When a new disturbance or PSB ticket is created
- `notifyJobAssigned(job, technician)` - When a technician takes the job
- `notifyJobInProgress(job, technician)` - When technician starts working
- `notifyJobCompleted(job, technician, notes)` - When job is completed
- `notifyJobCancelled(job, reason)` - When job is cancelled

### 2. Integration Points

#### Job Creation (Admin Input)
**File**: `server/routes/jobs.js` (lines 408-416)

When an admin creates a disturbance or PSB ticket through the website, the system:
1. Creates the job in the database
2. Sends notifications to all active technicians
3. **NEW**: Sends notification to the customer that their ticket was received

#### Technician Takes Job (Button "1")
**File**: `server/whatsapp/consolidated/BotDatabaseService.js` (lines 372-384)

When a technician presses "1" to take a job:
1. Assigns the job to the technician
2. Updates job status to "ASSIGNED"
3. **NEW**: Sends notification to customer that technician has been assigned

#### Technician Starts Job (Button "1" on assigned job)
**File**: `server/whatsapp/consolidated/BotDatabaseService.js` (lines 454-466)

When a technician presses "1" to start working on an assigned job:
1. Updates job status to "IN_PROGRESS"
2. **NEW**: Sends notification to customer that work has started

#### Technician Completes Job (Button "1" on in-progress job)
**File**: `server/whatsapp/consolidated/BotDatabaseService.js` (lines 522-534)

When a technician presses "1" to complete a job:
1. Updates job status to "COMPLETED"
2. **NEW**: Sends notification to customer that the issue has been resolved

#### PSB Ticket Creation (Customer Registration)
**File**: `server/routes/customers.js` (lines 758-764)

When a customer registers for WiFi installation:
1. Creates customer record in the database
2. Auto-creates PSB ticket
3. Sends notification to all active technicians
4. **NEW**: Sends notification to customer that their PSB ticket was received
5. **NEW**: Broadcasts real-time update to dashboard

## Message Templates

### Gangguan (Disturbance) Tickets
- **Created**: "🎫 TIKET GANGGUAN DITERIMA"
- **Assigned**: "👨‍🔧 TEKNISI DITUGASKAN"
- **In Progress**: "🚀 PENANGANAN GANGGUAN DIMULAI"
- **Completed**: "✅ GANGGUAN BERHASIL DIATASI"
- **Cancelled**: "❌ TIKET DIBATALKAN"

### PSB (Installation) Tickets
- **Created**: "🎫 TIKET PSB DITERIMA"
- **Assigned**: "👨‍🔧 TEKNISI DITUGASKAN"
- **In Progress**: "🚀 PEMASANGAN WIFI DIMULAI"
- **Completed**: "✅ PEMASANGAN WIFI SELESAI"
- **Cancelled**: "❌ TIKET PSB DIBATALKAN"

## Technical Details

### Real-time Updates
The system also broadcasts real-time updates to the dashboard for:
- New ticket creation (both GANGGUAN and PSB)
- Status changes (ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED)
- Job updates and modifications

### Message Examples

#### 1. Ticket Created
```
🎫 *TIKET GANGGUAN DITERIMA*

Halo [Customer Name],

Tiket gangguan Anda telah berhasil diterima dan sedang diproses.

📋 *Detail Tiket:*
🎫 Nomor: [Job Number]
🔧 Masalah: [Problem Description]
📍 Alamat: [Address]
⏰ Status: OPEN
📅 Dibuat: [Creation Date]

Teknisi akan segera menghubungi Anda untuk penanganan gangguan.

Terima kasih atas kesabaran Anda.
```

### 2. Job Assigned
```
👨‍🔧 *TEKNISI DITUGASKAN*

Halo [Customer Name],

Tiket gangguan Anda telah ditugaskan kepada teknisi.

📋 *Detail Tiket:*
🎫 Nomor: [Job Number]
👨‍🔧 Teknisi: [Technician Name]
📞 Kontak Teknisi: [Technician Phone]
⏰ Status: ASSIGNED

Teknisi akan segera menghubungi Anda untuk koordinasi penanganan gangguan.

Terima kasih.
```

### 3. Job In Progress
```
🚀 *PENANGANAN GANGGUAN DIMULAI*

Halo [Customer Name],

Teknisi telah memulai penanganan gangguan Anda.

📋 *Detail Tiket:*
🎫 Nomor: [Job Number]
👨‍🔧 Teknisi: [Technician Name]
⏰ Status: IN PROGRESS
🕐 Dimulai: [Start Time]

Teknisi sedang bekerja untuk mengatasi gangguan Anda. Mohon bersabar.

Terima kasih.
```

### 4. Job Completed
```
✅ *GANGGUAN BERHASIL DIATASI*

Halo [Customer Name],

Gangguan WiFi Anda telah berhasil diatasi!

📋 *Detail Tiket:*
🎫 Nomor: [Job Number]
👨‍🔧 Teknisi: [Technician Name]
✅ Status: COMPLETED
🕐 Selesai: [Completion Time]
📝 Catatan: [Completion Notes]

Silakan coba koneksi WiFi Anda. Jika masih ada masalah, jangan ragu untuk menghubungi kami.

Terima kasih telah mempercayai layanan kami!
```

### 5. Job Cancelled
```
❌ *TIKET DIBATALKAN*

Halo [Customer Name],

Tiket gangguan Anda telah dibatalkan.

📋 *Detail Tiket:*
🎫 Nomor: [Job Number]
❌ Status: CANCELLED
🕐 Dibatalkan: [Cancellation Time]
📝 Alasan: [Cancellation Reason]

Jika Anda masih mengalami masalah, silakan buat tiket baru atau hubungi customer service kami.

Terima kasih.
```

## Flow Diagram

```
Admin creates disturbance ticket
         ↓
Customer receives "Ticket Created" notification
         ↓
Technician receives job notification
         ↓
Technician presses "1" to take job
         ↓
Customer receives "Job Assigned" notification
         ↓
Technician presses "1" to start job
         ↓
Customer receives "Job In Progress" notification
         ↓
Technician presses "1" to complete job
         ↓
Customer receives "Job Completed" notification
```

## Testing

Run the test script to verify all notifications work correctly:

```bash
cd server
node scripts/test-customer-notifications.js
```

## Error Handling

- If WhatsApp is not connected, notifications are logged but not sent
- If customer phone number is invalid, notifications are skipped
- All errors are logged for debugging purposes
- Failed notifications don't affect the main job flow

## Phone Number Format

The system automatically normalizes phone numbers to Indonesian format (62):
- `082291921583` → `6282291921583`
- `82291921583` → `6282291921583`
- `+6282291921583` → `6282291921583`

## Configuration

The system uses the global WhatsApp socket (`global.whatsappSocket`) to send messages. Make sure the WhatsApp bot is running and connected before testing.

## Dependencies

- `@whiskeysockets/baileys` - WhatsApp Web API
- `prisma` - Database operations
- Custom logger utility

## Security

- All customer phone numbers are validated before sending
- Messages are sent only to registered customers
- No sensitive information is exposed in notifications
