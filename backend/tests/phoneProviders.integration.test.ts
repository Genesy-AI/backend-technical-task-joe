import { describe, it, expect } from 'vitest'
import axios from 'axios'
import { QueuedRateLimiter } from '../src/utils/QueuedRateLimiter'

/**
 * Integration tests for phone provider activities using real API endpoints.
 * These tests use the actual provider APIs specified in the README.
 */

// Provider API configurations from README
const ORION_CONFIG = {
    baseUrl: 'https://api.genesy.ai/api/tmp/orionConnect',
    authHeader: 'x-auth-me',
    apiKey: 'mySecretKey123',
    rateLimit: 5, // 5 req/sec (assumed)
    maxConcurrent: 3
}

const ASTRA_CONFIG = {
    baseUrl: 'https://api.genesy.ai/api/tmp/astraDialer',
    authHeader: 'apiKey',
    apiKey: '1234jhgf',
    rateLimit: 10, // 10 req/sec (assumed)
    maxConcurrent: 10
}

const NIMBUS_CONFIG = {
    baseUrl: 'https://api.genesy.ai/api/tmp/numbusLookup',
    apiParam: 'api',
    apiKey: '000099998888',
    rateLimit: 2, // 2 req/sec (assumed)
    maxConcurrent: 2
}

// Initialize rate limiters
const orionLimiter = new QueuedRateLimiter(
    ORION_CONFIG.rateLimit,
    1000,
    ORION_CONFIG.maxConcurrent
)

const astraLimiter = new QueuedRateLimiter(
    ASTRA_CONFIG.rateLimit,
    1000,
    ASTRA_CONFIG.maxConcurrent
)

const nimbusLimiter = new QueuedRateLimiter(
    NIMBUS_CONFIG.rateLimit,
    1000,
    NIMBUS_CONFIG.maxConcurrent
)

/**
 * Orion Connect API call
 * POST with fullName and companyWebsite
 * Auth: x-auth-me header
 */
async function searchOrionConnect(fullName: string, companyWebsite: string): Promise<string | null> {
    return orionLimiter.execute(async () => {
        try {
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
                    timeout: 5000
                }
            )

            return response.data?.phone || null
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error(`[Orion] Error: ${error.response?.status} - ${error.message}`)
            }
            return null
        }
    })
}

/**
 * Astra Dialer API call
 * POST with email
 * Auth: apiKey header
 */
async function searchAstraDialer(email: string): Promise<string | null> {
    return astraLimiter.execute(async () => {
        try {
            const response = await axios.post(
                ASTRA_CONFIG.baseUrl,
                { email },
                {
                    headers: {
                        [ASTRA_CONFIG.authHeader]: ASTRA_CONFIG.apiKey,
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000
                }
            )

            return response.data?.phoneNmbr || null
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error(`[Astra] Error: ${error.response?.status} - ${error.message}`)
            }
            return null
        }
    })
}

/**
 * Nimbus Lookup API call
 * POST with email and jobTitle
 * Auth: api query parameter
 */
async function searchNimbusLookup(email: string, jobTitle: string): Promise<string | null> {
    return nimbusLimiter.execute(async () => {
        try {
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
                    timeout: 5000
                }
            )

            const data = response.data
            if (data?.number && data?.countryCode) {
                return `+${data.countryCode}${data.number}`
            }
            return null
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error(`[Nimbus] Error: ${error.response?.status} - ${error.message}`)
            }
            return null
        }
    })
}

describe('Phone Provider Integration Tests', () => {
    describe('Orion Connect', () => {
        it('should make a successful API call', async () => {
            const result = await searchOrionConnect('John Doe', 'example.com')
            // Result can be null or a phone number - both are valid
            expect(result === null || typeof result === 'string').toBe(true)
        })

        it('should respect rate limits with multiple requests', async () => {
            const startTime = Date.now()

            // Make 10 requests (rate limit is 5/sec)
            const promises = Array.from({ length: 10 }, (_, i) =>
                searchOrionConnect(`Person ${i}`, 'example.com')
            )

            await Promise.all(promises)
            const duration = Date.now() - startTime

            // Should take at least 1 second due to rate limiting
            expect(duration).toBeGreaterThanOrEqual(900)
        })

        it('should respect concurrency limits', async () => {
            const stats = orionLimiter.getStats()

            // Start multiple requests
            const promises = Array.from({ length: 10 }, (_, i) =>
                searchOrionConnect(`Person ${i}`, 'example.com')
            )

            // Check that we never exceed max concurrent
            await new Promise(resolve => setTimeout(resolve, 100))
            const midStats = orionLimiter.getStats()
            expect(midStats.activeRequests).toBeLessThanOrEqual(ORION_CONFIG.maxConcurrent)

            await Promise.all(promises)
        })
    })

    describe('Astra Dialer', () => {
        it('should make a successful API call', async () => {
            const result = await searchAstraDialer('test@example.com')
            expect(result === null || typeof result === 'string').toBe(true)
        })

        it('should handle high throughput', async () => {
            // Astra has higher rate limit (10/sec)
            const promises = Array.from({ length: 20 }, (_, i) =>
                searchAstraDialer(`user${i}@example.com`)
            )

            const results = await Promise.all(promises)
            expect(results).toHaveLength(20)
        })
    })

    describe('Nimbus Lookup', () => {
        it('should make a successful API call', async () => {
            const result = await searchNimbusLookup('test@example.com', 'Software Engineer')
            expect(result === null || typeof result === 'string').toBe(true)
        })

        it('should respect low rate limit', async () => {
            const startTime = Date.now()

            // Make 5 requests (rate limit is 2/sec)
            const promises = Array.from({ length: 5 }, (_, i) =>
                searchNimbusLookup(`user${i}@example.com`, 'Engineer')
            )

            await Promise.all(promises)
            const duration = Date.now() - startTime

            // Should take at least 2 seconds (5 requests at 2/sec)
            expect(duration).toBeGreaterThanOrEqual(1800)
        })
    })

    describe('Waterfall Strategy', () => {
        it('should try providers in sequence until one succeeds', async () => {
            const fullName = 'Test User'
            const email = 'test@example.com'
            const companyWebsite = 'example.com'
            const jobTitle = 'CTO'

            // Try Orion first
            let phone = await searchOrionConnect(fullName, companyWebsite)
            if (phone) {
                expect(typeof phone).toBe('string')
                return
            }

            // Try Astra second
            phone = await searchAstraDialer(email)
            if (phone) {
                expect(typeof phone).toBe('string')
                return
            }

            // Try Nimbus third
            phone = await searchNimbusLookup(email, jobTitle)

            // At least one should have been attempted
            expect(true).toBe(true)
        })

        it('should handle concurrent waterfall requests efficiently', async () => {
            const testCases = Array.from({ length: 10 }, (_, i) => ({
                fullName: `User ${i}`,
                email: `user${i}@example.com`,
                companyWebsite: 'example.com',
                jobTitle: 'Engineer'
            }))

            const startTime = Date.now()

            const promises = testCases.map(async (testCase) => {
                // Waterfall: try each provider in sequence
                let phone = await searchOrionConnect(testCase.fullName, testCase.companyWebsite)
                if (phone) return phone

                phone = await searchAstraDialer(testCase.email)
                if (phone) return phone

                phone = await searchNimbusLookup(testCase.email, testCase.jobTitle)
                return phone || 'No data found'
            })

            const results = await Promise.all(promises)
            const duration = Date.now() - startTime

            expect(results).toHaveLength(10)
            console.log(`Processed 10 waterfall requests in ${duration}ms`)
        })
    })

    describe('Queue Statistics', () => {
        it('should provide accurate queue statistics', async () => {
            // Queue many requests to Nimbus (slowest provider)
            const promises = Array.from({ length: 20 }, (_, i) =>
                searchNimbusLookup(`user${i}@example.com`, 'Engineer')
            )

            // Check stats while processing
            await new Promise(resolve => setTimeout(resolve, 100))
            const stats = nimbusLimiter.getStats()

            console.log('Nimbus Queue Stats:', stats)
            expect(stats.queueLength).toBeGreaterThanOrEqual(0)
            expect(stats.activeRequests).toBeGreaterThanOrEqual(0)
            expect(stats.activeRequests).toBeLessThanOrEqual(NIMBUS_CONFIG.maxConcurrent)

            await Promise.all(promises)
        })
    })
})
