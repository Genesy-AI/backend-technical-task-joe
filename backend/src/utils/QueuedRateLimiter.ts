interface QueuedRequest<T> {
    execute: () => Promise<T>
    resolve: (value: T) => void
    reject: (error: any) => void
}

export class QueuedRateLimiter {
    private queue: QueuedRequest<any>[] = []
    private activeRequests = 0
    private tokens: number
    private lastRefill: number
    private readonly maxTokens: number
    private readonly refillRate: number // tokens per millisecond
    private readonly maxConcurrent: number

    /**
     * @param maxRequests Maximum number of requests allowed in the time window (rate limit)
     * @param timeWindow Time window in milliseconds
     * @param maxConcurrent Maximum number of concurrent requests (independent of rate limit)
     */
    constructor(maxRequests: number, timeWindow: number, maxConcurrent: number = 10) {
        this.maxTokens = maxRequests
        this.tokens = maxRequests
        this.lastRefill = Date.now()
        this.refillRate = maxRequests / timeWindow
        this.maxConcurrent = maxConcurrent
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push({ execute: fn, resolve, reject })
            this.processQueue()
        })
    }

    private async processQueue() {
        // Process as many requests as possible
        while (this.queue.length > 0 && this.canProcessRequest()) {
            const request = this.queue.shift()!
            this.activeRequests++
            this.consumeToken()

            // Execute the request
            request
                .execute()
                .then((result) => {
                    request.resolve(result)
                })
                .catch((error) => {
                    request.reject(error)
                })
                .finally(() => {
                    this.activeRequests--
                    // Try to process more requests after this one completes
                    this.processQueue()
                })
        }

        // If we have queued requests but can't process them yet, schedule a retry
        if (this.queue.length > 0 && !this.canProcessRequest()) {
            const waitTime = this.getWaitTime()
            if (waitTime > 0) {
                setTimeout(() => this.processQueue(), waitTime)
            }
        }
    }

    private canProcessRequest(): boolean {
        this.refill()
        return this.activeRequests < this.maxConcurrent && this.tokens >= 1
    }

    private consumeToken() {
        this.tokens -= 1
    }

    private refill() {
        const now = Date.now()
        const elapsed = now - this.lastRefill
        const newTokens = elapsed * this.refillRate

        if (newTokens > 0) {
            this.tokens = Math.min(this.maxTokens, this.tokens + newTokens)
            this.lastRefill = now
        }
    }

    private getWaitTime(): number {
        if (this.tokens >= 1) {
            return 0
        }
        // Calculate how long until we have 1 token
        const tokensNeeded = 1 - this.tokens
        return Math.ceil(tokensNeeded / this.refillRate)
    }

    getStats() {
        return {
            queueLength: this.queue.length,
            activeRequests: this.activeRequests,
            availableTokens: Math.floor(this.tokens),
        }
    }
}
