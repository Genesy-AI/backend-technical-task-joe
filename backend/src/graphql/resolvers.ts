import { PrismaClient } from '@prisma/client'
import { Connection, Client } from '@temporalio/client'
import { verifyEmailWorkflow, phoneLookupWorkflow, batchEnrichmentWorkflow } from '../workflows'
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

    try {
        // Start the parent batch workflow
        // This decouples the process: The parent workflow will spawn child workflows for each lead/operation
        // Rate limiting is handled by the Task Queues assigned in the child workflows
        await client.workflow.start(batchEnrichmentWorkflow, {
            taskQueue: 'myQueue', // Parent workflow runs on default queue
            workflowId: `batch-enrichment-${jobId}`,
            args: [{
                leads,
                operations,
                jobId
            }],
        })

        console.log(`[Enrichment] Started batch workflow for job ${jobId}`)

        // Note: We don't await the result here because it's a long-running background process.
        // The individual child workflows (or activities) will emit WebSocket events to update the UI.
        // We can optionally listen for the parent workflow completion if we want a final "Job Done" signal from Temporal,
        // but our current architecture emits 'job-complete' from the backend when all items are processed (tracked via JobTracker).
        // Wait... if we offload to Temporal, the JobTracker logic in the previous loop is gone.
        // We need a way to track progress.
        //
        // Option A: The Child Workflows emit the socket events (via activities calling back to API? No, activities are stateless).
        // Option B: The Child Workflows return results to Parent, Parent updates status?
        // Option C: We keep the "Activity" approach where the Activity does the work AND updates the DB/Socket.
        //
        // In our current setup, `verifyEmailWorkflow` calls `verifyEmail` activity.
        // The `verifyEmail` activity (in `utils/index.ts` -> `activities/utils.ts`) currently just returns boolean.
        // It does NOT emit socket events.
        //
        // The previous `processEnrichment` was doing the `client.workflow.execute` AND then emitting events.
        //
        // If we move to `BatchEnrichmentWorkflow` -> `ChildWorkflow` -> `Activity`,
        // The `Activity` needs to be responsible for the side effects (DB update + Socket emit),
        // OR the `ChildWorkflow` needs to do it.
        //
        // But Workflows cannot have side effects (like DB updates or Socket emits) directly. They must use Activities.
        //
        // So we need to:
        // 1. Ensure `verifyEmailWorkflow` calls an activity that updates DB and emits Socket event?
        //    Or `verifyEmailWorkflow` returns result, and `BatchEnrichmentWorkflow` calls a `notifyProgress` activity?
        //
        // Actually, the simplest way to keep our "Push" architecture working without rewriting everything is:
        // The `Activity` should perform the lookup AND update the DB.
        // But Activities shouldn't really talk to Socket.IO directly if they are running in a separate worker process (which they are).
        //
        // However, in this "monolith" setup, the Worker is running in the same process as the Express server (started via `runTemporalWorker` in `index.ts`).
        // So technically they share the `socketIO` instance if we export it?
        //
        // Let's check `backend/src/index.ts`. Yes, `socketIO` is exported.
        //
        // So we can create a `notifyProgress` activity or make the existing activities emit events.
        //
        // Let's look at `verifyEmail` activity.
        //
        // Wait, the previous `processEnrichment` was:
        // 1. Call Workflow (which calls Activity)
        // 2. Await result
        // 3. Update DB
        // 4. Emit Socket
        //
        // If we move this to `BatchEnrichmentWorkflow` (Temporal side):
        // The Workflow code runs deterministically. It cannot update DB or emit Sockets.
        // It must call an Activity to do that.
        //
        // So `BatchEnrichmentWorkflow` should:
        // 1. Call `VerifyEmailChildWorkflow`
        // 2. `VerifyEmailChildWorkflow` calls `VerifyEmailActivity` (returns bool)
        // 3. `VerifyEmailChildWorkflow` calls `UpdateLeadActivity` (updates DB + emits Socket)
        //
        // OR
        //
        // `BatchEnrichmentWorkflow` calls `VerifyEmailChildWorkflow`.
        // `VerifyEmailChildWorkflow` returns result.
        // `BatchEnrichmentWorkflow` calls `UpdateLeadActivity`.
        //
        // This seems complicated to refactor right now.
        //
        // Alternative:
        // Keep `processEnrichment` as the orchestrator (Node.js code), but use `Promise.all` to trigger the Child Workflows?
        // No, `processEnrichment` IS the "Client" code.
        //
        // If we want "Temporal to handle the queueing", we MUST use a Parent Workflow.
        //
        // So, we need a new Activity: `updateLeadAndNotify`.
        //
        // Let's create `backend/src/workflows/activities/updateLead.ts`.
        // And register it.
        // And call it from the Child Workflows?
        //
        // Actually, `verifyEmailWorkflow` is existing. Let's see it.
        // It probably just calls `verifyEmail`.
        //
        // If we change `verifyEmailWorkflow` to also call `updateLeadAndNotify`, that works.
        //
        // But `verifyEmailWorkflow` is likely simple.
        //
        // Let's check `verifyEmailWorkflow`.
    } catch (error) {
        console.error('Error starting batch enrichment:', error)
    }

    await connection.close()
}
