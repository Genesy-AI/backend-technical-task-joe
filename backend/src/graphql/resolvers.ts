import { PrismaClient } from '@prisma/client'
import { Connection, Client } from '@temporalio/client'
import { batchEnrichmentWorkflow } from '../workflows'
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
            const connection = await Connection.connect({ address: 'localhost:7233' })
            const client = new Client({ connection, namespace: 'default' })

            try {
                await client.workflow.start(batchEnrichmentWorkflow, {
                    taskQueue: 'myQueue',
                    workflowId: `batch-enrichment-${jobId}`,
                    args: [{
                        leads,
                        operations,
                        jobId
                    }],
                })
                console.log(`[Enrichment] Started batch workflow for job ${jobId}`)
            } catch (error) {
                console.error('Error starting batch enrichment:', error)
            } finally {
                await connection.close()
            }

            return {
                jobId,
                totalLeads: leads.length,
                operations
            }
        }
    }
}
