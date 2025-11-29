import { proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'

const { searchProviderOne, searchProviderTwo, searchProviderThree } = proxyActivities<typeof activities>({
    startToCloseTimeout: '10 seconds',
    retry: {
        initialInterval: '1 second',
        maximumInterval: '10 seconds',
        backoffCoefficient: 2,
        maximumAttempts: 3,
    },
})

interface PhoneLookupInput {
    firstName: string
    lastName: string
    email: string
    companyWebsite?: string
    jobTitle?: string
}

export async function phoneLookupWorkflow(input: PhoneLookupInput): Promise<string> {
    const fullName = `${input.firstName} ${input.lastName}`
    const companyWebsite = input.companyWebsite || 'example.com'
    const jobTitle = input.jobTitle || 'Unknown' // Default if missing

    // 1. Call Provider One (Orion Connect)
    try {
        const phoneOne = await proxyActivities<typeof activities>(
            {
                startToCloseTimeout: '30 seconds', // Increased to allow for retries with backoff
                retry: {
                    maximumAttempts: 1, // Retry logic is handled inside the activity
                },
            }
        ).searchProviderOne(fullName, companyWebsite)
        if (phoneOne) {
            return phoneOne
        }
    } catch (err) {
        console.error('Provider One failed:', err)
        // Continue to next provider
    }

    // 2. Call Provider Two (Astra Dialer)
    try {
        const phoneTwo = await proxyActivities<typeof activities>(
            {
                startToCloseTimeout: '30 seconds',
                retry: {
                    maximumAttempts: 1,
                },
            }
        ).searchProviderTwo(input.email)
        if (phoneTwo) {
            return phoneTwo
        }
    } catch (err) {
        console.error('Provider Two failed:', err)
        // Continue to next provider
    }

    // 3. Call Provider Three (Nimbus Lookup)
    try {
        const phoneThree = await proxyActivities<typeof activities>(
            {
                startToCloseTimeout: '30 seconds',
                retry: {
                    maximumAttempts: 1,
                },
            }
        ).searchProviderThree(input.email, jobTitle)
        if (phoneThree) {
            return phoneThree
        }
    } catch (err) {
        console.error('Provider Three failed:', err)
        // Continue to next provider
    }

    return 'No data found'
}
