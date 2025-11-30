import { proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'

const orionActivities = proxyActivities<typeof activities>({
    startToCloseTimeout: '30 seconds',
    taskQueue: 'phone-verify-1', // Orion Queue
    retry: { maximumAttempts: 1 },
})

const secondaryActivities = proxyActivities<typeof activities>({
    startToCloseTimeout: '30 seconds',
    taskQueue: 'phone-verify-2', // Secondary Queue
    retry: { maximumAttempts: 1 },
})

export interface PhoneLookupInput {
    firstName: string
    lastName: string
    email: string
    companyWebsite?: string
    jobTitle?: string
}

export interface PhoneLookupResult {
    phone: string | null
    provider?: string
    cost?: number
}

/**
 * Phone lookup workflow using provider registry.
 * Tries providers in priority order until a phone number is found.
 */
export async function phoneLookupWorkflow(input: PhoneLookupInput): Promise<PhoneLookupResult> {
    const fullName = `${input.firstName} ${input.lastName}`
    const companyWebsite = input.companyWebsite || 'example.com'
    const jobTitle = input.jobTitle || 'Unknown'
    const params = { fullName, companyWebsite, jobTitle }

    // 1. Try Orion (Priority 1)
    try {
        const result = await orionActivities.lookupOrion(params)
        if (result.phone) return result
    } catch (err) {
        console.error('Orion lookup failed, trying secondary:', err)
    }

    // 2. Fallback to Secondary Providers
    try {
        return await secondaryActivities.lookupSecondary(params)
    } catch (err) {
        console.error('Secondary lookup failed:', err)
        return { phone: null }
    }
}
