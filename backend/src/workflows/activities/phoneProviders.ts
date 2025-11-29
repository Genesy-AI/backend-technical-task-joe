import { QueuedRateLimiter } from '../../utils/QueuedRateLimiter'
import axios, { AxiosError } from 'axios'

// Provider API configurations from README
const ORION_CONFIG = {
    baseUrl: 'https://api.genesy.ai/api/tmp/orionConnect',
    authHeader: 'x-auth-me',
    apiKey: 'mySecretKey123',
    rateLimit: 5, // 5 req/sec
    maxConcurrent: 3
}

const ASTRA_CONFIG = {
    baseUrl: 'https://api.genesy.ai/api/tmp/astraDialer',
    authHeader: 'apiKey',
    apiKey: '1234jhgf',
    rateLimit: 10, // 10 req/sec
    maxConcurrent: 10
}

const NIMBUS_CONFIG = {
    baseUrl: 'https://api.genesy.ai/api/tmp/numbusLookup',
    apiParam: 'api',
    apiKey: '000099998888',
    rateLimit: 2, // 2 req/sec
    maxConcurrent: 2
}

// Initialize rate limiters for each provider
const orionLimiter = new QueuedRateLimiter(ORION_CONFIG.rateLimit, 1000, ORION_CONFIG.maxConcurrent)
const astraLimiter = new QueuedRateLimiter(ASTRA_CONFIG.rateLimit, 1000, ASTRA_CONFIG.maxConcurrent)
const nimbusLimiter = new QueuedRateLimiter(NIMBUS_CONFIG.rateLimit, 1000, NIMBUS_CONFIG.maxConcurrent)

/**
 * Helper function to retry with exponential backoff
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    providerName: string,
    maxRetries: number = 3
): Promise<T | null> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error as Error

            if (axios.isAxiosError(error)) {
                const status = error.response?.status
                const errorType = error.code || 'UNKNOWN'
                const errorMsg = error.message

                // Don't retry on 4xx errors (client errors)
                if (status && status >= 400 && status < 500) {
                    console.log(`[${providerName}] ❌ Client error ${status} (${errorType}): ${errorMsg} - Not retrying`)
                    return null
                }

                // Retry on 5xx errors (server errors) or network errors
                if (attempt < maxRetries - 1) {
                    const backoffTime = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
                    console.log(`[${providerName}] ⚠️  Error ${status || errorType} - "${errorMsg}" - Retrying in ${backoffTime / 1000}s (attempt ${attempt + 1}/${maxRetries})`)
                    await new Promise(resolve => setTimeout(resolve, backoffTime))
                } else {
                    console.log(`[${providerName}] ❌ Failed after ${maxRetries} attempts - Last error: ${status || errorType}`)
                }
            } else {
                // Non-axios error
                console.log(`[${providerName}] ❌ Unexpected error: ${lastError?.message || 'Unknown'}`)
                return null
            }
        }
    }

    return null
}

/**
 * Orion Connect - Best data, slow, sometimes fails
 * POST with fullName and companyWebsite
 * Auth: x-auth-me header
 */
export async function searchProviderOne(fullName: string, companyWebsite: string): Promise<string | null> {
    return orionLimiter.execute(async () => {
        console.log(`[Orion Connect] 🔍 [${fullName}] Searching at ${companyWebsite}`)

        const result = await retryWithBackoff(async () => {
            const response = await axios.post(
                ORION_CONFIG.baseUrl,
                {
                    fullName,
                    companyWebsite
                },
                {
                    headers: {
                        [ORION_CONFIG.authHeader]: ORION_CONFIG.apiKey,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            )

            return response.data?.phone || null
        }, `Orion Connect | ${fullName}`)

        if (result) {
            console.log(`[Orion Connect] ✅ [${fullName}] Found: ${result}`)
            return result
        }

        console.log(`[Orion Connect] ⚪ [${fullName}] No data found, moving to Astra Dialer`)
        return null
    })
}

/**
 * Astra Dialer - Worst data, fastest
 * POST with email
 * Auth: apiKey header
 */
export async function searchProviderTwo(email: string): Promise<string | null> {
    return astraLimiter.execute(async () => {
        console.log(`[Astra Dialer] 🔍 [${email}] Searching...`)

        const result = await retryWithBackoff(async () => {
            const response = await axios.post(
                ASTRA_CONFIG.baseUrl,
                { email },
                {
                    headers: {
                        [ASTRA_CONFIG.authHeader]: ASTRA_CONFIG.apiKey,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            )

            return response.data?.phoneNmbr || null
        }, `Astra Dialer | ${email}`)

        if (result) {
            console.log(`[Astra Dialer] ✅ [${email}] Found: ${result}`)
            return result
        }

        console.log(`[Astra Dialer] ⚪ [${email}] No data found, moving to Nimbus Lookup`)
        return null
    })
}

/**
 * Nimbus Lookup - New provider
 * POST with email and jobTitle
 * Auth: api query parameter
 */
export async function searchProviderThree(email: string, jobTitle: string): Promise<string | null> {
    return nimbusLimiter.execute(async () => {
        console.log(`[Nimbus Lookup] 🔍 [${email}] Searching (${jobTitle})...`)

        const result = await retryWithBackoff(async () => {
            const response = await axios.post(
                `${NIMBUS_CONFIG.baseUrl}?${NIMBUS_CONFIG.apiParam}=${NIMBUS_CONFIG.apiKey}`,
                {
                    email,
                    jobTitle
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            )

            const data = response.data
            if (data?.number && data?.countryCode) {
                return `+${data.countryCode}${data.number}`
            }
            return null
        }, `Nimbus Lookup | ${email}`)

        if (result) {
            console.log(`[Nimbus Lookup] ✅ [${email}] Found: ${result}`)
            return result
        }

        console.log(`[Nimbus Lookup] ⚪ [${email}] No data found - All providers exhausted, returning null`)
        return null
    })
}
