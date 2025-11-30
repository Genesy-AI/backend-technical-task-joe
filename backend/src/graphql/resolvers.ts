import { PrismaClient } from '@prisma/client'
import { Connection, Client } from '@temporalio/client'
import { verifyEmailWorkflow, phoneLookupWorkflow } from '../workflows'
import { Operation } from '../utils/JobTracker'
import { Server as SocketIOServer } from 'socket.io'

const prisma = new PrismaClient()

/**
 * GraphQL Resolvers
 */
export const resolvers = {
    Query: {
        _empty: () => 'GraphQL server is running'
    },

    Mutation: {
        enrichLeads: async (
            _: any,
            { leadIds, operations }: { leadIds: number[]; operations: string[] },
            context: { io: SocketIOServer; jobTracker: any }
        ) => {
            const { io, jobTracker } = context

            // Validate leads exist
            const leads = await prisma.lead.findMany({
                where: { id: { in: leadIds } }
            })

            if (leads.length === 0) {
                throw new Error('No leads found with the provided IDs')
            }

            // Map GraphQL enum to internal operation type
            const ops = operations.map(op =>
                op === 'VERIFY_EMAIL' ? 'verify-email' : 'phone-lookup'
            ) as Operation[]

            // Create enrichment job
            const jobId = jobTracker.createEnrichmentJob(leads.length, ops)

            console.log(`[GraphQL] Created enrichment job ${jobId} for ${leads.length} leads with operations: ${ops.join(', ')}`)

            // Process async
            processEnrichment(leads, ops, jobId, io, jobTracker)

            return {
                jobId,
                totalLeads: leads.length,
                operations
            }
        }
    }
}

/**
 * Process enrichment operations for multiple leads
 */
async function processEnrichment(
    leads: any[],
    operations: Operation[],
    jobId: string,
    io: SocketIOServer,
    jobTracker: any
) {
    const connection = await Connection.connect({ address: 'localhost:7233' })
    const client = new Client({ connection, namespace: 'default' })

    let completedOperations = 0
    const totalOperations = leads.length * operations.length

    // Process all leads and operations in parallel
    await Promise.all(leads.map(async (lead) => {
        // For each lead, process all selected operations in parallel
        await Promise.all(operations.map(async (operation) => {
            try {
                if (operation === 'verify-email') {
                    // Skip if already verified
                    if (lead.emailVerified !== null) {
                        console.log(`[Enrichment] Lead ${lead.id} - Email already verified: ${lead.emailVerified} - Skipping`)
                        io.to(jobId).emit('operation-complete', {
                            leadId: lead.id,
                            operation: 'verify-email',
                            data: { emailVerified: lead.emailVerified },
                            progress: { completed: ++completedOperations, total: totalOperations }
                        })
                        return
                    }

                    const isVerified = await client.workflow.execute(verifyEmailWorkflow, {
                        taskQueue: 'email-verification-queue', // Use specific queue
                        workflowId: `verify-email-${lead.id}-${Date.now()}`,
                        args: [lead.email],
                    })

                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: { emailVerified: Boolean(isVerified) },
                    })

                    io.to(jobId).emit('operation-complete', {
                        leadId: lead.id,
                        operation: 'verify-email',
                        data: { emailVerified: isVerified },
                        progress: { completed: ++completedOperations, total: totalOperations }
                    })

                    console.log(`[Enrichment] Lead ${lead.id} - Email verified: ${isVerified}`)
                }

                if (operation === 'phone-lookup') {
                    // Skip if phone number exists
                    if (lead.phoneNumber) {
                        console.log(`[Enrichment] Lead ${lead.id} - Phone already exists: ${lead.phoneNumber} - Skipping`)
                        io.to(jobId).emit('operation-complete', {
                            leadId: lead.id,
                            operation: 'phone-lookup',
                            data: { phone: lead.phoneNumber, provider: 'Existing', cost: 0 },
                            progress: { completed: ++completedOperations, total: totalOperations }
                        })
                        return
                    }

                    const handle = await client.workflow.start(phoneLookupWorkflow, {
                        taskQueue: 'phone-lookup-queue', // Use specific queue
                        workflowId: `phone-lookup-${lead.id}-${Date.now()}`,
                        args: [
                            {
                                firstName: lead.firstName,
                                lastName: lead.lastName,
                                email: lead.email,
                                companyWebsite: lead.companyName || undefined,
                                jobTitle: lead.jobTitle || undefined,
                            },
                        ],
                    })

                    const result = await handle.result()

                    if (result.phone) {
                        await prisma.lead.update({
                            where: { id: lead.id },
                            data: { phoneNumber: result.phone },
                        })
                    }

                    io.to(jobId).emit('operation-complete', {
                        leadId: lead.id,
                        operation: 'phone-lookup',
                        data: { phone: result.phone, provider: result.provider, cost: result.cost },
                        progress: { completed: ++completedOperations, total: totalOperations }
                    })

                    console.log(`[Enrichment] Lead ${lead.id} - Phone: ${result.phone || 'not found'}`)
                }
            } catch (error) {
                console.error(`[Enrichment] Error for lead ${lead.id}, operation ${operation}:`, error)

                io.to(jobId).emit('operation-error', {
                    leadId: lead.id,
                    operation,
                    error: error instanceof Error ? error.message : 'Unknown error'
                })
            }
        }))

        // Increment job progress per lead (approximate, as we track ops now)
        jobTracker.incrementProgress(jobId)
    }))

    // Job complete
    io.to(jobId).emit('job-complete', {
        jobId,
        type: 'enrichment',
        totalProcessed: jobTracker.getJob(jobId)?.processedLeads || 0
    })

    await connection.close()
    jobTracker.cleanup(jobId)
}
