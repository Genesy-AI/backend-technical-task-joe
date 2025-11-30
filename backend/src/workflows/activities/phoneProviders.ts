import { PhoneProvider } from '../../providers/PhoneProvider'
import { ProviderConfig, LookupParams } from '../../types/ProviderConfig'
import axios, { AxiosError } from 'axios'

/**
 * Provider configurations
 */
export const PROVIDER_CONFIGS: ProviderConfig[] = [
    {
        name: 'Orion Connect',
        priority: 1,
        costPerRequest: 0.02,
        rateLimit: 5,
        timeWindow: 1000,
        maxConcurrent: 3,
        enabled: true,
        timeout: 10000
    },
    {
        name: 'Astra Dialer',
        priority: 2,
        costPerRequest: 0.01,
        rateLimit: 10,
        timeWindow: 1000,
        maxConcurrent: 10,
        enabled: true,
        timeout: 10000
    },
    {
        name: 'Nimbus Lookup',
        priority: 3,
        costPerRequest: 0.015,
        rateLimit: 2,
        timeWindow: 1000,
        maxConcurrent: 2,
        enabled: true,
        timeout: 10000
    }
]

/**
 * Helper function to retry with exponential backoff
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    providerName: string,
    leadIdentifier: string,
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
                    console.log(`[${providerName}] ❌ [${leadIdentifier}] Client error ${status} (${errorType}): ${errorMsg} - Not retrying`)
                    return null
                }

                // Retry on 5xx errors (server errors) or network errors
                if (attempt < maxRetries - 1) {
                    const backoffTime = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
                    console.log(`[${providerName}] ⚠️  [${leadIdentifier}] Error ${status || errorType} - "${errorMsg}" - Retrying in ${backoffTime / 1000}s (attempt ${attempt + 1}/${maxRetries})`)
                    await new Promise(resolve => setTimeout(resolve, backoffTime))
                } else {
                    console.log(`[${providerName}] ❌ [${leadIdentifier}] Failed after ${maxRetries} attempts - Last error: ${status || errorType}`)
                }
            } else {
                console.log(`[${providerName}] ❌ [${leadIdentifier}] Unexpected error: ${lastError?.message || 'Unknown'}`)
                return null
            }
        }
    }

    return null
}

/**
 * Orion Connect Provider
 * API: POST to /orionConnect with x-auth-me header
 */
export class OrionProvider extends PhoneProvider {
    private baseUrl = 'https://api.genesy.ai/api/tmp/orionConnect'
    private authHeader = 'x-auth-me'
    private apiKey = 'mySecretKey123'

    constructor(config: ProviderConfig) {
        super(config)
    }

    protected async lookup(params: LookupParams): Promise<string | null> {
        const leadIdentifier = params.fullName

        console.log(`[${this.config.name}] 🔍 [${leadIdentifier}] Searching at ${params.companyWebsite}`)

        const result = await retryWithBackoff(
            async () => {
                const response = await axios.post(
                    this.baseUrl,
                    {
                        fullName: params.fullName,
                        companyWebsite: params.companyWebsite
                    },
                    {
                        headers: { [this.authHeader]: this.apiKey },
                        timeout: this.config.timeout
                    }
                )
                return response.data?.phone || null
            },
            this.config.name,
            leadIdentifier
        )

        if (result) {
            console.log(`[${this.config.name}] ✅ [${leadIdentifier}] Found: ${result}`)
        } else {
            console.log(`[${this.config.name}] ⚪ [${leadIdentifier}] No data found, moving to next provider`)
        }

        return result
    }
}

/**
 * Astra Dialer Provider
 * API: GET with apiKey query param
 */
export class AstraProvider extends PhoneProvider {
    private baseUrl = 'https://api.genesy.ai/api/tmp/astraDialer'
    private apiKey = '1234jhgf'

    constructor(config: ProviderConfig) {
        super(config)
    }

    protected async lookup(params: LookupParams): Promise<string | null> {
        const leadIdentifier = params.fullName

        console.log(`[${this.config.name}] 🔍 [${leadIdentifier}] Searching at ${params.companyWebsite}`)

        const result = await retryWithBackoff(
            async () => {
                const response = await axios.get(this.baseUrl, {
                    params: {
                        apiKey: this.apiKey,
                        fullName: params.fullName,
                        companyWebsite: params.companyWebsite
                    },
                    timeout: this.config.timeout
                })
                return response.data?.phoneNumber || null
            },
            this.config.name,
            leadIdentifier
        )

        if (result) {
            console.log(`[${this.config.name}] ✅ [${leadIdentifier}] Found: ${result}`)
        } else {
            console.log(`[${this.config.name}] ⚪ [${leadIdentifier}] No data found, moving to next provider`)
        }

        return result
    }
}

/**
 * Nimbus Lookup Provider
 * API: POST with api field in body
 */
export class NimbusProvider extends PhoneProvider {
    private baseUrl = 'https://api.genesy.ai/api/tmp/numbusLookup'
    private apiKey = '000099998888'

    constructor(config: ProviderConfig) {
        super(config)
    }

    protected async lookup(params: LookupParams): Promise<string | null> {
        const leadIdentifier = params.fullName

        console.log(`[${this.config.name}] 🔍 [${leadIdentifier}] Searching at ${params.companyWebsite}`)

        const result = await retryWithBackoff(
            async () => {
                const response = await axios.post(
                    this.baseUrl,
                    {
                        api: this.apiKey,
                        fullName: params.fullName,
                        companyWebsite: params.companyWebsite,
                        jobTitle: params.jobTitle || 'Unknown'
                    },
                    {
                        timeout: this.config.timeout
                    }
                )
                return response.data?.contact?.phone || null
            },
            this.config.name,
            leadIdentifier
        )

        if (result) {
            console.log(`[${this.config.name}] ✅ [${leadIdentifier}] Found: ${result}`)
        } else {
            console.log(`[${this.config.name}] ⚪ [${leadIdentifier}] No data found, moving to next provider`)
        }

        return result
    }
}
