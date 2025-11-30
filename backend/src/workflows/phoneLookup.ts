import { proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'

const { performPhoneLookup } = proxyActivities<typeof activities>({
    startToCloseTimeout: '30 seconds',
    retry: {
        maximumAttempts: 1, // Retry logic handled in providers
    },
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

    try {
        const result = await performPhoneLookup({
            fullName,
            companyWebsite,
            jobTitle
        })

        return result
    } catch (err) {
        console.error('Phone lookup workflow failed:', err)
        return { phone: null }
    }
}
