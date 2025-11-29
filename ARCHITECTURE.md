# TinyGenesy - Current Architecture

## Tech Stack

**Backend**: Node.js, TypeScript, Express, Prisma, SQLite, Temporal.io  
**Frontend**: React, TypeScript, Vite, Mantine, React Query  
**Testing**: Vitest, Jest

## Core Features

### Lead Management
- CRUD operations, bulk CSV import, email verification, message generation

### Phone Lookup System
- **Workflow**: Temporal orchestrates waterfall provider calls
- **Providers**: Orion (5 req/s, 3 concurrent), Astra (10 req/s, 10 concurrent), Nimbus (2 req/s, 2 concurrent)
- **Rate Limiting**: In-memory token bucket + request queue per provider
- **Storage**: Results saved to `lead.phoneNumber`

### Rate Limiting (`QueuedRateLimiter`)
- **Token Bucket**: Refills over time (e.g., 5 tokens/sec)
- **Request Queue**: Queues requests when no tokens available
- **Concurrency Control**: Limits parallel requests (e.g., max 3 concurrent)
- **Scope**: Per-provider, in-memory (single instance only)

## Database Schema
```prisma
model lead {
  id            Int      @id @default(autoincrement())
  firstName     String
  lastName      String
  email         String
  phoneNumber   String?  // Phone lookup result
  emailVerified Boolean?
  // ... other fields
}
```

## API Endpoints
- `GET /leads` - List leads
- `POST /leads` - Create lead
- `POST /leads/bulk` - CSV import
- `POST /leads/:id/phone-lookup` - Trigger phone lookup

## Phone Lookup Flow
```
Request → Temporal Workflow → Try Orion → (if null) Try Astra → (if null) Try Nimbus → Save to DB
```

Each provider call goes through `QueuedRateLimiter` to enforce rate limits.

## File Structure
```
backend/src/
  ├── workflows/
  │   ├── phoneLookup.ts         # Main workflow
  │   └── activities/
  │       └── phoneProviders.ts  # Provider integrations
  └── utils/
      └── QueuedRateLimiter.ts   # Rate limiting

frontend/src/
  └── components/
      ├── LeadsList.tsx          # Main UI
      └── CsvImportModal.tsx
```

## Limitations
- Rate limiter doesn't work across multiple instances
- No WebSockets (synchronous HTTP only)
- No job tracking for bulk operations
- Providers hardcoded, not abstracted
- No cost tracking
- SQLite (dev only)
