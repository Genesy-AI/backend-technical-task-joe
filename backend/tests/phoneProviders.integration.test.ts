import { describe, it, expect } from 'vitest'
import { OrionProvider, AstraProvider, NimbusProvider, PROVIDER_CONFIGS } from '../src/workflows/activities/phoneProviders'

/**
 * Integration tests for phone provider classes using real API endpoints.
 * These tests use the actual provider APIs specified in the README.
 */

describe('Phone Provider Integration Tests', () => {
    describe('Orion Connect Provider', () => {
        it('should make a successful API call', async () => {
            const config = PROVIDER_CONFIGS.find(c => c.name === 'Orion Connect')!
            const provider = new OrionProvider(config)

            const result = await provider.execute({
                fullName: 'John Doe',
                companyWebsite: 'example.com'
            })

            expect(result).toBeDefined()
            expect(result.provider).toBe('Orion Connect')
            expect(result.cost).toBe(0.02)
            expect(result.timestamp).toBeInstanceOf(Date)

            if (result.phone) {
                expect(typeof result.phone).toBe('string')
                expect(result.phone.length).toBeGreaterThan(0)
            }
        })

        it('should respect rate limits', async () => {
            const config = PROVIDER_CONFIGS.find(c => c.name === 'Orion Connect')!
            const provider = new OrionProvider(config)

            const startTime = Date.now()

            // Make requests that exceed rate limit (5 req/sec)
            const promises = Array.from({ length: 10 }, () =>
                provider.execute({
                    fullName: 'Test User',
                    companyWebsite: 'example.com'
                })
            )

            await Promise.all(promises)
            const duration = Date.now() - startTime

            // Should take at least 1 second due to rate limiting
            expect(duration).toBeGreaterThan(900)
        })

        it('should track provider and cost in results', async () => {
            const config = PROVIDER_CONFIGS.find(c => c.name === 'Orion Connect')!
            const provider = new OrionProvider(config)

            const result = await provider.execute({
                fullName: 'Jane Smith',
                companyWebsite: 'test.com'
            })

            expect(result.provider).toBe('Orion Connect')
            expect(result.cost).toBe(0.02)
        })
    })

    describe('Astra Dialer Provider', () => {
        it('should make a successful API call', async () => {
            const config = PROVIDER_CONFIGS.find(c => c.name === 'Astra Dialer')!
            const provider = new AstraProvider(config)

            const result = await provider.execute({
                fullName: 'Alice Johnson',
                companyWebsite: 'example.org'
            })

            expect(result).toBeDefined()
            expect(result.provider).toBe('Astra Dialer')
            expect(result.cost).toBe(0.01)
            expect(result.timestamp).toBeInstanceOf(Date)
        })

        it('should track provider and cost in results', async () => {
            const config = PROVIDER_CONFIGS.find(c => c.name === 'Astra Dialer')!
            const provider = new AstraProvider(config)

            const result = await provider.execute({
                fullName: 'Bob Wilson',
                companyWebsite: 'sample.com'
            })

            expect(result.provider).toBe('Astra Dialer')
            expect(result.cost).toBe(0.01)
        })
    })

    describe('Nimbus Lookup Provider', () => {
        it('should make a successful API call', async () => {
            const config = PROVIDER_CONFIGS.find(c => c.name === 'Nimbus Lookup')!
            const provider = new NimbusProvider(config)

            const result = await provider.execute({
                fullName: 'Charlie Brown',
                companyWebsite: 'demo.com',
                jobTitle: 'Engineer'
            })

            expect(result).toBeDefined()
            expect(result.provider).toBe('Nimbus Lookup')
            expect(result.cost).toBe(0.015)
            expect(result.timestamp).toBeInstanceOf(Date)
        })

        it('should handle missing jobTitle gracefully', async () => {
            const config = PROVIDER_CONFIGS.find(c => c.name === 'Nimbus Lookup')!
            const provider = new NimbusProvider(config)

            const result = await provider.execute({
                fullName: 'David Lee',
                companyWebsite: 'test.org'
            })

            expect(result).toBeDefined()
            expect(result.provider).toBe('Nimbus Lookup')
        })

        it('should track provider and cost in results', async () => {
            const config = PROVIDER_CONFIGS.find(c => c.name === 'Nimbus Lookup')!
            const provider = new NimbusProvider(config)

            const result = await provider.execute({
                fullName: 'Eve Davis',
                companyWebsite: 'example.net'
            })

            expect(result.provider).toBe('Nimbus Lookup')
            expect(result.cost).toBe(0.015)
        })
    })

    describe('Provider Registry', () => {
        it('should validate provider configs', () => {
            expect(PROVIDER_CONFIGS).toHaveLength(3)

            const orion = PROVIDER_CONFIGS.find(c => c.name === 'Orion Connect')
            expect(orion).toBeDefined()
            expect(orion?.priority).toBe(1)
            expect(orion?.costPerRequest).toBe(0.02)

            const astra = PROVIDER_CONFIGS.find(c => c.name === 'Astra Dialer')
            expect(astra).toBeDefined()
            expect(astra?.priority).toBe(2)
            expect(astra?.costPerRequest).toBe(0.01)

            const nimbus = PROVIDER_CONFIGS.find(c => c.name === 'Nimbus Lookup')
            expect(nimbus).toBeDefined()
            expect(nimbus?.priority).toBe(3)
            expect(nimbus?.costPerRequest).toBe(0.015)
        })

        it('should have all providers enabled by default', () => {
            PROVIDER_CONFIGS.forEach(config => {
                expect(config.enabled).toBe(true)
            })
        })
    })

    describe('Cost Tracking', () => {
        it('should track costs across multiple providers', async () => {
            const configs = PROVIDER_CONFIGS
            const providers = [
                new OrionProvider(configs[0]),
                new AstraProvider(configs[1]),
                new NimbusProvider(configs[2])
            ]

            const results = await Promise.all(
                providers.map(p => p.execute({
                    fullName: 'Test User',
                    companyWebsite: 'example.com'
                }))
            )

            const totalCost = results.reduce((sum, r) => sum + r.cost, 0)
            expect(totalCost).toBe(0.02 + 0.01 + 0.015) // 0.045
        })
    })
})
