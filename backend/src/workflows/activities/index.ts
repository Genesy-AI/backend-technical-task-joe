import { ProviderRegistry } from '../../providers/providerRegistry'
import { LookupParams, PhoneResult } from '../../types/ProviderConfig'

/**
 * Single phone lookup activity using provider registry.
 * Tries all providers in priority order until success.
 */
export async function performPhoneLookup(params: LookupParams): Promise<PhoneResult> {
    const registry = new ProviderRegistry()
    const providers = registry.getProviders()

    console.log(`[Phone Lookup] Starting lookup for ${params.fullName} with ${providers.length} providers`)

    for (const provider of providers) {
        try {
            const result = await provider.execute(params)

            if (result.phone) {
                console.log(`[Phone Lookup] ✅ Success with ${result.provider} - Cost: $${result.cost}`)
                return result
            }
        } catch (err) {
            console.error(`[Phone Lookup] Provider ${provider.getConfig().name} threw error:`, err)
            // Continue to next provider
        }
    }

    console.log(`[Phone Lookup] ⚪ No provider found a phone number for ${params.fullName}`)

    return {
        phone: null,
        provider: 'None',
        cost: 0,
        timestamp: new Date()
    }
}

// Export existing activities
export { verifyEmail } from './utils'