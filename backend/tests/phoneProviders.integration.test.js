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
const phoneProviders_1 = require("../src/workflows/activities/phoneProviders");
/**
 * Integration tests for phone provider classes using real API endpoints.
 * These tests use the actual provider APIs specified in the README.
 */
(0, vitest_1.describe)('Phone Provider Integration Tests', () => {
    (0, vitest_1.describe)('Orion Connect Provider', () => {
        (0, vitest_1.it)('should make a successful API call', () => __awaiter(void 0, void 0, void 0, function* () {
            const config = phoneProviders_1.PROVIDER_CONFIGS.find(c => c.name === 'Orion Connect');
            const provider = new phoneProviders_1.OrionProvider(config);
            const result = yield provider.execute({
                fullName: 'John Doe',
                companyWebsite: 'example.com'
            });
            (0, vitest_1.expect)(result).toBeDefined();
            (0, vitest_1.expect)(result.provider).toBe('Orion Connect');
            (0, vitest_1.expect)(result.cost).toBe(0.02);
            (0, vitest_1.expect)(result.timestamp).toBeInstanceOf(Date);
            if (result.phone) {
                (0, vitest_1.expect)(typeof result.phone).toBe('string');
                (0, vitest_1.expect)(result.phone.length).toBeGreaterThan(0);
            }
        }));
        (0, vitest_1.it)('should respect rate limits', () => __awaiter(void 0, void 0, void 0, function* () {
            const config = phoneProviders_1.PROVIDER_CONFIGS.find(c => c.name === 'Orion Connect');
            const provider = new phoneProviders_1.OrionProvider(config);
            const startTime = Date.now();
            // Make requests that exceed rate limit (5 req/sec)
            const promises = Array.from({ length: 10 }, () => provider.execute({
                fullName: 'Test User',
                companyWebsite: 'example.com'
            }));
            yield Promise.all(promises);
            const duration = Date.now() - startTime;
            // Should take at least 1 second due to rate limiting
            (0, vitest_1.expect)(duration).toBeGreaterThan(900);
        }));
        (0, vitest_1.it)('should track provider and cost in results', () => __awaiter(void 0, void 0, void 0, function* () {
            const config = phoneProviders_1.PROVIDER_CONFIGS.find(c => c.name === 'Orion Connect');
            const provider = new phoneProviders_1.OrionProvider(config);
            const result = yield provider.execute({
                fullName: 'Jane Smith',
                companyWebsite: 'test.com'
            });
            (0, vitest_1.expect)(result.provider).toBe('Orion Connect');
            (0, vitest_1.expect)(result.cost).toBe(0.02);
        }));
    });
    (0, vitest_1.describe)('Astra Dialer Provider', () => {
        (0, vitest_1.it)('should make a successful API call', () => __awaiter(void 0, void 0, void 0, function* () {
            const config = phoneProviders_1.PROVIDER_CONFIGS.find(c => c.name === 'Astra Dialer');
            const provider = new phoneProviders_1.AstraProvider(config);
            const result = yield provider.execute({
                fullName: 'Alice Johnson',
                companyWebsite: 'example.org'
            });
            (0, vitest_1.expect)(result).toBeDefined();
            (0, vitest_1.expect)(result.provider).toBe('Astra Dialer');
            (0, vitest_1.expect)(result.cost).toBe(0.01);
            (0, vitest_1.expect)(result.timestamp).toBeInstanceOf(Date);
        }));
        (0, vitest_1.it)('should track provider and cost in results', () => __awaiter(void 0, void 0, void 0, function* () {
            const config = phoneProviders_1.PROVIDER_CONFIGS.find(c => c.name === 'Astra Dialer');
            const provider = new phoneProviders_1.AstraProvider(config);
            const result = yield provider.execute({
                fullName: 'Bob Wilson',
                companyWebsite: 'sample.com'
            });
            (0, vitest_1.expect)(result.provider).toBe('Astra Dialer');
            (0, vitest_1.expect)(result.cost).toBe(0.01);
        }));
    });
    (0, vitest_1.describe)('Nimbus Lookup Provider', () => {
        (0, vitest_1.it)('should make a successful API call', () => __awaiter(void 0, void 0, void 0, function* () {
            const config = phoneProviders_1.PROVIDER_CONFIGS.find(c => c.name === 'Nimbus Lookup');
            const provider = new phoneProviders_1.NimbusProvider(config);
            const result = yield provider.execute({
                fullName: 'Charlie Brown',
                companyWebsite: 'demo.com',
                jobTitle: 'Engineer'
            });
            (0, vitest_1.expect)(result).toBeDefined();
            (0, vitest_1.expect)(result.provider).toBe('Nimbus Lookup');
            (0, vitest_1.expect)(result.cost).toBe(0.015);
            (0, vitest_1.expect)(result.timestamp).toBeInstanceOf(Date);
        }));
        (0, vitest_1.it)('should handle missing jobTitle gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            const config = phoneProviders_1.PROVIDER_CONFIGS.find(c => c.name === 'Nimbus Lookup');
            const provider = new phoneProviders_1.NimbusProvider(config);
            const result = yield provider.execute({
                fullName: 'David Lee',
                companyWebsite: 'test.org'
            });
            (0, vitest_1.expect)(result).toBeDefined();
            (0, vitest_1.expect)(result.provider).toBe('Nimbus Lookup');
        }));
        (0, vitest_1.it)('should track provider and cost in results', () => __awaiter(void 0, void 0, void 0, function* () {
            const config = phoneProviders_1.PROVIDER_CONFIGS.find(c => c.name === 'Nimbus Lookup');
            const provider = new phoneProviders_1.NimbusProvider(config);
            const result = yield provider.execute({
                fullName: 'Eve Davis',
                companyWebsite: 'example.net'
            });
            (0, vitest_1.expect)(result.provider).toBe('Nimbus Lookup');
            (0, vitest_1.expect)(result.cost).toBe(0.015);
        }));
    });
    (0, vitest_1.describe)('Provider Registry', () => {
        (0, vitest_1.it)('should validate provider configs', () => {
            (0, vitest_1.expect)(phoneProviders_1.PROVIDER_CONFIGS).toHaveLength(3);
            const orion = phoneProviders_1.PROVIDER_CONFIGS.find(c => c.name === 'Orion Connect');
            (0, vitest_1.expect)(orion).toBeDefined();
            (0, vitest_1.expect)(orion === null || orion === void 0 ? void 0 : orion.priority).toBe(1);
            (0, vitest_1.expect)(orion === null || orion === void 0 ? void 0 : orion.costPerRequest).toBe(0.02);
            const astra = phoneProviders_1.PROVIDER_CONFIGS.find(c => c.name === 'Astra Dialer');
            (0, vitest_1.expect)(astra).toBeDefined();
            (0, vitest_1.expect)(astra === null || astra === void 0 ? void 0 : astra.priority).toBe(2);
            (0, vitest_1.expect)(astra === null || astra === void 0 ? void 0 : astra.costPerRequest).toBe(0.01);
            const nimbus = phoneProviders_1.PROVIDER_CONFIGS.find(c => c.name === 'Nimbus Lookup');
            (0, vitest_1.expect)(nimbus).toBeDefined();
            (0, vitest_1.expect)(nimbus === null || nimbus === void 0 ? void 0 : nimbus.priority).toBe(3);
            (0, vitest_1.expect)(nimbus === null || nimbus === void 0 ? void 0 : nimbus.costPerRequest).toBe(0.015);
        });
        (0, vitest_1.it)('should have all providers enabled by default', () => {
            phoneProviders_1.PROVIDER_CONFIGS.forEach(config => {
                (0, vitest_1.expect)(config.enabled).toBe(true);
            });
        });
    });
    (0, vitest_1.describe)('Cost Tracking', () => {
        (0, vitest_1.it)('should track costs across multiple providers', () => __awaiter(void 0, void 0, void 0, function* () {
            const configs = phoneProviders_1.PROVIDER_CONFIGS;
            const providers = [
                new phoneProviders_1.OrionProvider(configs[0]),
                new phoneProviders_1.AstraProvider(configs[1]),
                new phoneProviders_1.NimbusProvider(configs[2])
            ];
            const results = yield Promise.all(providers.map(p => p.execute({
                fullName: 'Test User',
                companyWebsite: 'example.com'
            })));
            const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
            (0, vitest_1.expect)(totalCost).toBe(0.02 + 0.01 + 0.015); // 0.045
        }));
    });
});
