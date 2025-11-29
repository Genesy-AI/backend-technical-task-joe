export class RateLimiter {
    private tokens: number;
    private lastRefill: number;
    private readonly maxTokens: number;
    private readonly refillRate: number; // tokens per millisecond
    private readonly refillInterval: number;

    /**
     * @param maxRequests Maximum number of requests allowed in the time window
     * @param timeWindow Time window in milliseconds
     */
    constructor(maxRequests: number, timeWindow: number) {
        this.maxTokens = maxRequests;
        this.tokens = maxRequests;
        this.lastRefill = Date.now();
        this.refillInterval = timeWindow;
        this.refillRate = maxRequests / timeWindow;
    }

    async acquire(): Promise<void> {
        this.refill();

        if (this.tokens >= 1) {
            this.tokens -= 1;
            return;
        }

        // Calculate wait time
        const timeToNextToken = (1 - this.tokens) / this.refillRate;
        await new Promise((resolve) => setTimeout(resolve, timeToNextToken));

        // Recursive call to try again after waiting
        return this.acquire();
    }

    private refill() {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const newTokens = elapsed * this.refillRate;

        if (newTokens > 0) {
            this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
            this.lastRefill = now;
        }
    }
}
