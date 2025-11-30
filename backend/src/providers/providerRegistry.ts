import { PhoneProvider } from './PhoneProvider'
import { OrionProvider, AstraProvider, NimbusProvider, PROVIDER_CONFIGS } from '../workflows/activities/phoneProviders'

/**
 * Central registry for phone lookup providers.
 * Manages provider instances and ordering by priority.
 */
export class ProviderRegistry {
    private providers: PhoneProvider[]

    constructor() {
        // Initialize providers from config
        const configs = PROVIDER_CONFIGS.filter(c => c.enabled)
            .sort((a, b) => a.priority - b.priority)

        this.providers = configs.map(config => {
            switch (config.name) {
                case 'Orion Connect':
                    return new OrionProvider(config)
                case 'Astra Dialer':
                    return new AstraProvider(config)
                case 'Nimbus Lookup':
                    return new NimbusProvider(config)
                default:
                    throw new Error(`Unknown provider: ${config.name}`)
            }
        })
    }

    /**
     * Get all enabled providers sorted by priority
     */
    getProviders(): PhoneProvider[] {
        return this.providers
    }

    /**
     * Get a specific provider by name
     */
    getProvider(name: string): PhoneProvider | undefined {
        return this.providers.find(p => p.getConfig().name === name)
    }

    /**
     * Get statistics for all providers
     */
    getAllStats() {
        return this.providers.map(p => p.getStats())
    }
}
