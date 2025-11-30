export interface ProviderConfig {
    name: string
    priority: number          // 1 = highest priority, try first
    costPerRequest: number    // Cost in USD per API call
    rateLimit: number         // Requests per second
    timeWindow: number        // Time window in milliseconds (usually 1000)
    maxConcurrent: number     // Maximum concurrent requests
    enabled: boolean          // Can disable without code changes
    timeout: number           // Request timeout in milliseconds
}

export interface LookupParams {
    fullName: string
    companyWebsite: string
    jobTitle?: string
}

export interface PhoneResult {
    phone: string | null
    provider: string
    cost: number
    timestamp: Date
}
