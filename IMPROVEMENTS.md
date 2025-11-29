# TinyGenesy - Improvement Proposals

> **Current architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md)

## 1. Distributed Rate Limiting with Job Persistence

**Problem**: In-memory rate limiter breaks with multiple backend instances.

**Solution**: Redis-based distributed system with persistent job queue
- **Redis** for shared token buckets across instances
- **Bull/BullMQ** for job queue (survives crashes, resumes jobs)
- **Worker pools** for horizontal scaling
- Jobs persist even if system crashes - workers pick up where they left off

**Fair Queuing**: Per-user queues with round-robin scheduling  
**Priority Tiers**: Pro users get 2x/3x/4x weight vs free tier

## 2. Provider Abstraction & Cost Tracking

**Problem**: Providers hardcoded, no cost visibility.

**Solution**: Class-based system with metadata
```typescript
interface ProviderConfig {
  name: string
  priority: number          // 1 = try first
  costPerRequest: number    // USD
  rateLimit: number        
  maxConcurrent: number
  enabled: boolean
}

class PhoneProvider {
  constructor(config: ProviderConfig)
  async lookup(params): Promise<PhoneResult>
}
```

**Benefits**: Easy to add/disable providers, cost tracking, testable

## 3. Parallel Querying

**Current**: Waterfall (slow, cheap)  
**Proposed**: Parallel with smart cancellation
- Query all providers simultaneously
- Return first successful result, cancel others
- **Hybrid**: Try cheapest first, fan out after 500ms timeout

**Tradeoff**: 3x API cost, much faster UX

## 4. Async Jobs with WebSocket Updates

**Current**: Synchronous HTTP blocks client  
**Proposed**: 
1. Client → `POST /phone-lookup-bulk` → Get `jobId`
2. Temporal processes async, publishes to job channel
3. WebSocket pushes real-time updates: `{ leadId, phone, provider }`
4. Track: cost, time, success rate per job

**Benefits**: Non-blocking, handles 1000+ leads, survives page refresh

**Admin Dashboard**: See `/docs/ui-admin-ideas.excalidraw.md`

## 5. CSV Import UX

- **Validation**: Show errors inline, allow partial imports
- **Streaming**: Full backend streaming for large files (>10MB)

## 6. Productization Features

> **Note**: Not implementing for technical task, but would be core for real service:

**Monetization**:
- Auth (Auth0/Clerk)
- Subscription tiers (Free: 100 lookups/month, Pro: 1000/month, Enterprise: unlimited)
- Token system (buy extra lookups)
- Usage dashboard per user
- Billing integration (Stripe)

**Features**:
- API keys for programmatic access
- Webhooks for job completion
- Team collaboration (share leads)
- Export to CRM (Salesforce, HubSpot)

This would make a compelling SaaS people would pay for vs build themselves.

## 7. Code Quality

- **Validation**: Zod for runtime type safety
- **Testing**: E2E tests (Playwright), 80%+ coverage
- **Logging**: Structured logs (Pino) → Datadog/Sentry
- **UI/UX**: Better loading states, accessibility
