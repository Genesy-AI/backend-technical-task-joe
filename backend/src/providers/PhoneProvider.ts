import { QueuedRateLimiter } from '../utils/QueuedRateLimiter'
import { ProviderConfig, LookupParams, PhoneResult } from '../types/ProviderConfig'

/**
 * Base class for phone lookup providers.
 * Each provider implements its own lookup logic while sharing
 * rate limiting and cost tracking infrastructure.
 */
export abstract class PhoneProvider {
    protected config: ProviderConfig
    protected rateLimiter: QueuedRateLimiter

    constructor(config: ProviderConfig) {
        this.config = config
        this.rateLimiter = new QueuedRateLimiter(
            config.rateLimit,
            config.timeWindow,
            config.maxConcurrent
        )
    }

    /**
     * Provider-specific lookup implementation.
     * Each provider implements this with their own API calls.
     */
    protected abstract lookup(params: LookupParams): Promise<string | null>

    /**
     * Execute lookup with rate limiting and cost tracking.
     * This is the public method used by workflows.
     */
    async execute(params: LookupParams): Promise<PhoneResult> {
        const phone = await this.rateLimiter.execute(() => this.lookup(params))

        return {
            phone,
            provider: this.config.name,
            cost: this.config.costPerRequest,
            timestamp: new Date()
        }
    }

    /**
     * Get current provider statistics
     */
    getStats() {
        return {
            ...this.rateLimiter.getStats(),
            provider: this.config.name,
            costPerRequest: this.config.costPerRequest,
            priority: this.config.priority,
            enabled: this.config.enabled
        }
    }

    /**
     * Get provider configuration
     */
    getConfig(): ProviderConfig {
        return { ...this.config }
    }
}
