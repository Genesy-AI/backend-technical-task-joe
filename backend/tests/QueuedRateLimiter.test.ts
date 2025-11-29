import { describe, it, expect } from 'vitest'
import { QueuedRateLimiter } from '../src/utils/QueuedRateLimiter'

describe('QueuedRateLimiter', () => {
    describe('Basic Functionality', () => {
        it('should execute a single request immediately', async () => {
            const limiter = new QueuedRateLimiter(5, 1000, 10)
            const startTime = Date.now()

            const result = await limiter.execute(async () => {
                return 'success'
            })

            const duration = Date.now() - startTime
            expect(result).toBe('success')
            expect(duration).toBeLessThan(100) // Should be immediate
        })

        it('should handle errors in executed functions', async () => {
            const limiter = new QueuedRateLimiter(5, 1000, 10)

            await expect(
                limiter.execute(async () => {
                    throw new Error('Test error')
                })
            ).rejects.toThrow('Test error')
        })

        it('should return correct stats', async () => {
            const limiter = new QueuedRateLimiter(5, 1000, 3)

            // Queue 10 requests
            const promises = Array.from({ length: 10 }, (_, i) =>
                limiter.execute(async () => {
                    await new Promise(resolve => setTimeout(resolve, 100))
                    return i
                })
            )

            // Check stats while processing
            await new Promise(resolve => setTimeout(resolve, 50))
            const stats = limiter.getStats()

            expect(stats.activeRequests).toBeGreaterThan(0)
            expect(stats.queueLength).toBeGreaterThan(0)

            await Promise.all(promises)
        })
    })

    describe('Rate Limiting', () => {
        it('should respect rate limits', async () => {
            // 2 requests per second
            const limiter = new QueuedRateLimiter(2, 1000, 10)
            const executionTimes: number[] = []

            const promises = Array.from({ length: 5 }, () =>
                limiter.execute(async () => {
                    executionTimes.push(Date.now())
                    return 'done'
                })
            )

            await Promise.all(promises)

            // First 2 should be immediate, next 2 should wait ~1 second, last one ~2 seconds
            const timeDiffs = executionTimes.map((time, i) =>
                i === 0 ? 0 : time - executionTimes[0]
            )

            expect(timeDiffs[0]).toBeLessThan(100) // First request immediate
            expect(timeDiffs[1]).toBeLessThan(100) // Second request immediate
            expect(timeDiffs[2]).toBeGreaterThanOrEqual(900) // Third waits ~1s
            expect(timeDiffs[3]).toBeGreaterThanOrEqual(900) // Fourth waits ~1s
            expect(timeDiffs[4]).toBeGreaterThanOrEqual(1800) // Fifth waits ~2s
        })

        it('should refill tokens over time', async () => {
            const limiter = new QueuedRateLimiter(2, 1000, 10)

            // Use up all tokens
            await Promise.all([
                limiter.execute(async () => 'done'),
                limiter.execute(async () => 'done')
            ])

            // Wait for refill
            await new Promise(resolve => setTimeout(resolve, 1100))

            // Should have tokens again
            const startTime = Date.now()
            await limiter.execute(async () => 'done')
            const duration = Date.now() - startTime

            expect(duration).toBeLessThan(200) // Should be quick, not waiting
        })
    })

    describe('Concurrency Limiting', () => {
        it('should respect max concurrent limit', async () => {
            const limiter = new QueuedRateLimiter(100, 1000, 3) // High rate limit, low concurrency
            let activeCount = 0
            let maxActiveCount = 0

            const promises = Array.from({ length: 10 }, () =>
                limiter.execute(async () => {
                    activeCount++
                    maxActiveCount = Math.max(maxActiveCount, activeCount)
                    await new Promise(resolve => setTimeout(resolve, 100))
                    activeCount--
                })
            )

            await Promise.all(promises)

            expect(maxActiveCount).toBeLessThanOrEqual(3)
            expect(maxActiveCount).toBeGreaterThan(0)
        })

        it('should process queued requests as slots become available', async () => {
            const limiter = new QueuedRateLimiter(100, 1000, 2)
            const completionOrder: number[] = []

            const promises = Array.from({ length: 5 }, (_, i) =>
                limiter.execute(async () => {
                    await new Promise(resolve => setTimeout(resolve, 50))
                    completionOrder.push(i)
                    return i
                })
            )

            await Promise.all(promises)

            expect(completionOrder).toHaveLength(5)
            // All should complete
            expect(completionOrder.sort()).toEqual([0, 1, 2, 3, 4])
        })
    })

    describe('Combined Rate and Concurrency Limits', () => {
        it('should handle both limits simultaneously', async () => {
            // 3 req/sec, max 2 concurrent
            const limiter = new QueuedRateLimiter(3, 1000, 2)
            let activeCount = 0
            let maxActiveCount = 0
            const executionTimes: number[] = []

            const promises = Array.from({ length: 6 }, () =>
                limiter.execute(async () => {
                    activeCount++
                    maxActiveCount = Math.max(maxActiveCount, activeCount)
                    executionTimes.push(Date.now())
                    await new Promise(resolve => setTimeout(resolve, 100))
                    activeCount--
                })
            )

            await Promise.all(promises)

            // Should never exceed 2 concurrent
            expect(maxActiveCount).toBeLessThanOrEqual(2)

            // Should respect rate limit (6 requests should take at least 1 second)
            const totalDuration = executionTimes[executionTimes.length - 1] - executionTimes[0]
            expect(totalDuration).toBeGreaterThanOrEqual(900)
        })
    })

    describe('Stress Test', () => {
        it('should handle 100 requests without errors', async () => {
            const limiter = new QueuedRateLimiter(10, 1000, 5)

            const promises = Array.from({ length: 100 }, (_, i) =>
                limiter.execute(async () => {
                    await new Promise(resolve => setTimeout(resolve, 10))
                    return i
                })
            )

            const results = await Promise.all(promises)

            expect(results).toHaveLength(100)
            expect(results.sort((a, b) => a - b)).toEqual(
                Array.from({ length: 100 }, (_, i) => i)
            )
        })
    })
})
