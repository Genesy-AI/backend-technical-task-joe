# Test Suite for Queue-Based Rate Limiting

This directory contains comprehensive tests for the queue-based rate limiting system used in the phone lookup feature.

## Test Files

### 1. `QueuedRateLimiter.test.ts`
Unit tests for the `QueuedRateLimiter` class covering:
- **Basic Functionality**: Single requests, error handling, stats reporting
- **Rate Limiting**: Token bucket algorithm, refill logic
- **Concurrency Limiting**: Max parallel requests enforcement
- **Combined Limits**: Both rate and concurrency limits working together
- **Stress Testing**: 100 concurrent requests

### 2. `phoneProviders.integration.test.ts`
Integration tests using the actual Genesy API endpoints:
- **Orion Connect**: `https://api.genesy.ai/api/tmp/orionConnect`
  - Auth: `x-auth-me` header with key `mySecretKey123`
  - Tests rate limiting (5 req/sec) and concurrency (3 max)
  
- **Astra Dialer**: `https://api.genesy.ai/api/tmp/astraDialer`
  - Auth: `apiKey` header with key `1234jhgf`
  - Tests high throughput (10 req/sec, 10 concurrent)
  
- **Nimbus Lookup**: `https://api.genesy.ai/api/tmp/numbusLookup`
  - Auth: `api` query parameter with key `000099998888`
  - Tests low rate limit (2 req/sec, 2 concurrent)

- **Waterfall Strategy**: Tests sequential provider fallback
- **Queue Statistics**: Validates queue metrics during processing

## Running Tests

```bash
# Run all Jest tests
pnpm test:jest

# Run tests in watch mode
pnpm test:jest:watch

# Run only integration tests
pnpm test:integration

# Run with coverage
pnpm test:jest -- --coverage
```

## Test Configuration

Tests are configured via `jest.config.js`:
- Uses `ts-jest` preset for TypeScript support
- Test environment: Node.js
- Timeout: 30-60 seconds for integration tests (API calls + rate limiting)

## What's Being Tested

### Rate Limiting
- ✅ Requests respect configured rate limits
- ✅ Token bucket refills over time
- ✅ Multiple requests queue properly
- ✅ Rate limits are enforced across all providers

### Concurrency Control
- ✅ Never exceeds max concurrent requests
- ✅ Queued requests process as slots become available
- ✅ Independent from rate limiting

### API Integration
- ✅ Correct authentication for each provider
- ✅ Proper request/response handling
- ✅ Error handling for failed requests
- ✅ Waterfall strategy (try providers in sequence)

### Performance
- ✅ Handles 100+ concurrent requests
- ✅ Efficient queue processing
- ✅ Accurate statistics reporting

## Expected Behavior

When running integration tests:
1. **Orion Connect** (slow, sometimes fails): ~1.5s latency, 20% failure rate
2. **Astra Dialer** (fast): ~200ms latency, reliable
3. **Nimbus Lookup** (new): ~800ms latency, reliable

The queue system ensures:
- No provider rate limits are exceeded
- Requests are processed efficiently
- Failed requests don't block the queue
- Statistics are accurate in real-time

## Notes

- Integration tests make real HTTP calls to Genesy API endpoints
- Tests may take 30-60 seconds due to rate limiting delays
- Some tests intentionally trigger rate limits to verify behavior
- Queue stats are logged during integration tests for debugging
