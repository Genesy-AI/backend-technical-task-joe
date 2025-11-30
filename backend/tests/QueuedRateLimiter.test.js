"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const QueuedRateLimiter_1 = require("../src/utils/QueuedRateLimiter");
(0, vitest_1.describe)('QueuedRateLimiter', () => {
    (0, vitest_1.describe)('Basic Functionality', () => {
        (0, vitest_1.it)('should execute a single request immediately', () => __awaiter(void 0, void 0, void 0, function* () {
            const limiter = new QueuedRateLimiter_1.QueuedRateLimiter(5, 1000, 10);
            const startTime = Date.now();
            const result = yield limiter.execute(() => __awaiter(void 0, void 0, void 0, function* () {
                return 'success';
            }));
            const duration = Date.now() - startTime;
            (0, vitest_1.expect)(result).toBe('success');
            (0, vitest_1.expect)(duration).toBeLessThan(100); // Should be immediate
        }));
        (0, vitest_1.it)('should handle errors in executed functions', () => __awaiter(void 0, void 0, void 0, function* () {
            const limiter = new QueuedRateLimiter_1.QueuedRateLimiter(5, 1000, 10);
            yield (0, vitest_1.expect)(limiter.execute(() => __awaiter(void 0, void 0, void 0, function* () {
                throw new Error('Test error');
            }))).rejects.toThrow('Test error');
        }));
        (0, vitest_1.it)('should return correct stats', () => __awaiter(void 0, void 0, void 0, function* () {
            const limiter = new QueuedRateLimiter_1.QueuedRateLimiter(5, 1000, 3);
            // Queue 10 requests
            const promises = Array.from({ length: 10 }, (_, i) => limiter.execute(() => __awaiter(void 0, void 0, void 0, function* () {
                yield new Promise(resolve => setTimeout(resolve, 100));
                return i;
            })));
            // Check stats while processing
            yield new Promise(resolve => setTimeout(resolve, 50));
            const stats = limiter.getStats();
            (0, vitest_1.expect)(stats.activeRequests).toBeGreaterThan(0);
            (0, vitest_1.expect)(stats.queueLength).toBeGreaterThan(0);
            yield Promise.all(promises);
        }));
    });
    (0, vitest_1.describe)('Rate Limiting', () => {
        (0, vitest_1.it)('should respect rate limits', () => __awaiter(void 0, void 0, void 0, function* () {
            // 2 requests per second
            const limiter = new QueuedRateLimiter_1.QueuedRateLimiter(2, 1000, 10);
            const executionTimes = [];
            const promises = Array.from({ length: 5 }, () => limiter.execute(() => __awaiter(void 0, void 0, void 0, function* () {
                executionTimes.push(Date.now());
                return 'done';
            })));
            yield Promise.all(promises);
            // First 2 should be immediate, next 2 should wait ~1 second, last one ~2 seconds
            const timeDiffs = executionTimes.map((time, i) => i === 0 ? 0 : time - executionTimes[0]);
            (0, vitest_1.expect)(timeDiffs[0]).toBeLessThan(100); // First request immediate
            (0, vitest_1.expect)(timeDiffs[1]).toBeLessThan(100); // Second request immediate
            (0, vitest_1.expect)(timeDiffs[2]).toBeGreaterThanOrEqual(900); // Third waits ~1s
            (0, vitest_1.expect)(timeDiffs[3]).toBeGreaterThanOrEqual(900); // Fourth waits ~1s
            (0, vitest_1.expect)(timeDiffs[4]).toBeGreaterThanOrEqual(1800); // Fifth waits ~2s
        }));
        (0, vitest_1.it)('should refill tokens over time', () => __awaiter(void 0, void 0, void 0, function* () {
            const limiter = new QueuedRateLimiter_1.QueuedRateLimiter(2, 1000, 10);
            // Use up all tokens
            yield Promise.all([
                limiter.execute(() => __awaiter(void 0, void 0, void 0, function* () { return 'done'; })),
                limiter.execute(() => __awaiter(void 0, void 0, void 0, function* () { return 'done'; }))
            ]);
            // Wait for refill
            yield new Promise(resolve => setTimeout(resolve, 1100));
            // Should have tokens again
            const startTime = Date.now();
            yield limiter.execute(() => __awaiter(void 0, void 0, void 0, function* () { return 'done'; }));
            const duration = Date.now() - startTime;
            (0, vitest_1.expect)(duration).toBeLessThan(200); // Should be quick, not waiting
        }));
    });
    (0, vitest_1.describe)('Concurrency Limiting', () => {
        (0, vitest_1.it)('should respect max concurrent limit', () => __awaiter(void 0, void 0, void 0, function* () {
            const limiter = new QueuedRateLimiter_1.QueuedRateLimiter(100, 1000, 3); // High rate limit, low concurrency
            let activeCount = 0;
            let maxActiveCount = 0;
            const promises = Array.from({ length: 10 }, () => limiter.execute(() => __awaiter(void 0, void 0, void 0, function* () {
                activeCount++;
                maxActiveCount = Math.max(maxActiveCount, activeCount);
                yield new Promise(resolve => setTimeout(resolve, 100));
                activeCount--;
            })));
            yield Promise.all(promises);
            (0, vitest_1.expect)(maxActiveCount).toBeLessThanOrEqual(3);
            (0, vitest_1.expect)(maxActiveCount).toBeGreaterThan(0);
        }));
        (0, vitest_1.it)('should process queued requests as slots become available', () => __awaiter(void 0, void 0, void 0, function* () {
            const limiter = new QueuedRateLimiter_1.QueuedRateLimiter(100, 1000, 2);
            const completionOrder = [];
            const promises = Array.from({ length: 5 }, (_, i) => limiter.execute(() => __awaiter(void 0, void 0, void 0, function* () {
                yield new Promise(resolve => setTimeout(resolve, 50));
                completionOrder.push(i);
                return i;
            })));
            yield Promise.all(promises);
            (0, vitest_1.expect)(completionOrder).toHaveLength(5);
            // All should complete
            (0, vitest_1.expect)(completionOrder.sort()).toEqual([0, 1, 2, 3, 4]);
        }));
    });
    (0, vitest_1.describe)('Combined Rate and Concurrency Limits', () => {
        (0, vitest_1.it)('should handle both limits simultaneously', () => __awaiter(void 0, void 0, void 0, function* () {
            // 3 req/sec, max 2 concurrent
            const limiter = new QueuedRateLimiter_1.QueuedRateLimiter(3, 1000, 2);
            let activeCount = 0;
            let maxActiveCount = 0;
            const executionTimes = [];
            const promises = Array.from({ length: 6 }, () => limiter.execute(() => __awaiter(void 0, void 0, void 0, function* () {
                activeCount++;
                maxActiveCount = Math.max(maxActiveCount, activeCount);
                executionTimes.push(Date.now());
                yield new Promise(resolve => setTimeout(resolve, 100));
                activeCount--;
            })));
            yield Promise.all(promises);
            // Should never exceed 2 concurrent
            (0, vitest_1.expect)(maxActiveCount).toBeLessThanOrEqual(2);
            // Should respect rate limit (6 requests should take at least 1 second)
            const totalDuration = executionTimes[executionTimes.length - 1] - executionTimes[0];
            (0, vitest_1.expect)(totalDuration).toBeGreaterThanOrEqual(900);
        }));
    });
    (0, vitest_1.describe)('Stress Test', () => {
        (0, vitest_1.it)('should handle 100 requests without errors', () => __awaiter(void 0, void 0, void 0, function* () {
            const limiter = new QueuedRateLimiter_1.QueuedRateLimiter(10, 1000, 5);
            const promises = Array.from({ length: 100 }, (_, i) => limiter.execute(() => __awaiter(void 0, void 0, void 0, function* () {
                yield new Promise(resolve => setTimeout(resolve, 10));
                return i;
            })));
            const results = yield Promise.all(promises);
            (0, vitest_1.expect)(results).toHaveLength(100);
            (0, vitest_1.expect)(results.sort((a, b) => a - b)).toEqual(Array.from({ length: 100 }, (_, i) => i));
        }));
    });
});
