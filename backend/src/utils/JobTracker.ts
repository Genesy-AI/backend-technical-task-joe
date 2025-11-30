export type JobType = 'email-verification' | 'phone-lookup' | 'enrichment'
export type Operation = 'verify-email' | 'phone-lookup'

interface Job {
    id: string
    type: JobType
    operations?: Operation[]  // For enrichment jobs
    totalLeads: number
    processedLeads: number
    startedAt: Date
    completedAt?: Date
}

/**
 * In-memory job tracking system.
 * Tracks async job progress for WebSocket updates.
 * TODO: Move to Redis for multi-instance support.
 */
export class JobTracker {
    private jobs = new Map<string, Job>()

    /**
     * Create a new job and return its ID
     */
    createJob(type: JobType, leadCount: number): string {
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        this.jobs.set(jobId, {
            id: jobId,
            type,
            totalLeads: leadCount,
            processedLeads: 0,
            startedAt: new Date()
        })

        console.log(`[JobTracker] Created ${type} job ${jobId} for ${leadCount} leads`)
        return jobId
    }

    /**
     * Create enrichment job with multiple operations
     */
    createEnrichmentJob(leadCount: number, operations: Operation[]): string {
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        this.jobs.set(jobId, {
            id: jobId,
            type: 'enrichment',
            operations,
            totalLeads: leadCount,
            processedLeads: 0,
            startedAt: new Date()
        })

        console.log(`[JobTracker] Created enrichment job ${jobId} for ${leadCount} leads with operations: ${operations.join(', ')}`)
        return jobId
    }

    /**
     * Increment progress counter for a job
     */
    incrementProgress(jobId: string): void {
        const job = this.jobs.get(jobId)
        if (job) {
            job.processedLeads++

            if (job.processedLeads >= job.totalLeads) {
                job.completedAt = new Date()
                const duration = job.completedAt.getTime() - job.startedAt.getTime()
                console.log(`[JobTracker] Job ${jobId} completed in ${duration}ms`)
            }
        }
    }

    /**
     * Get job details
     */
    getJob(jobId: string): Job | undefined {
        return this.jobs.get(jobId)
    }

    /**
     * Check if job is complete
     */
    isComplete(jobId: string): boolean {
        const job = this.jobs.get(jobId)
        return job ? job.processedLeads >= job.totalLeads : false
    }

    /**
     * Clean up completed job after delay
     */
    cleanup(jobId: string): void {
        const job = this.jobs.get(jobId)
        if (job) {
            setTimeout(() => {
                this.jobs.delete(jobId)
                console.log(`[JobTracker] Cleaned up job ${jobId}`)
            }, 60000) // 1 minute
        }
    }

    /**
     * Get all active jobs (for debugging)
     */
    getActiveJobs(): Job[] {
        return Array.from(this.jobs.values()).filter(j => !j.completedAt)
    }
}
