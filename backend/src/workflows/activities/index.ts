import { ProviderRegistry } from '../../providers/providerRegistry'
import { LookupParams, PhoneResult } from '../../types/ProviderConfig'

/**
 * Single phone lookup activity using provider registry.
 * Tries all providers in priority order until success.
 */
/**
 * Lookup phone using ONLY Orion Connect (Priority 1)
 */
export async function lookupOrion(params: LookupParams): Promise<PhoneResult> {
    const registry = new ProviderRegistry()
    // Filter for Orion only
    const providers = registry.getProviders().filter(p => p.getConfig().name === 'Orion Connect')

    if (providers.length === 0) {
        console.warn('[Phone Lookup] Orion provider not found or disabled')
        return { phone: null, provider: 'None', cost: 0, timestamp: new Date() }
    }

    const provider = providers[0]
    try {
        const result = await provider.execute(params)
        if (result.phone) {
            console.log(`[Phone Lookup] ✅ Success with Orion - Cost: $${result.cost}`)
            return result
        }
    } catch (err) {
        console.error(`[Phone Lookup] Orion threw error:`, err)
    }

    return { phone: null, provider: 'None', cost: 0, timestamp: new Date() }
}

/**
 * Lookup phone using Secondary providers (Priority > 1)
 */
export async function lookupSecondary(params: LookupParams): Promise<PhoneResult> {
    const registry = new ProviderRegistry()
    // Filter for non-Orion providers
    const providers = registry.getProviders().filter(p => p.getConfig().name !== 'Orion Connect')

    console.log(`[Phone Lookup] Starting secondary lookup with ${providers.length} providers`)

    for (const provider of providers) {
        try {
            const result = await provider.execute(params)
            if (result.phone) {
                console.log(`[Phone Lookup] ✅ Success with ${result.provider} - Cost: $${result.cost}`)
                return result
            }
        } catch (err) {
            console.error(`[Phone Lookup] Provider ${provider.getConfig().name} threw error:`, err)
        }
    }

    return { phone: null, provider: 'None', cost: 0, timestamp: new Date() }
}

// Export existing activities
export { verifyEmail } from './utils'
export * from './gender'
export * from './updateLead'