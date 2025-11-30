import { proxyActivities, startChild } from '@temporalio/workflow'
import { verifyEmailWorkflow } from './workflows'
import { phoneLookupWorkflow } from './phoneLookup'
import type * as activities from './activities'

const { updateLeadAndNotify } = proxyActivities<typeof activities>({
    startToCloseTimeout: '1 minute',
})

interface BatchEnrichmentInput {
    leads: any[]
    operations: string[]
    jobId: string
}

export async function batchEnrichmentWorkflow({ leads, operations, jobId }: BatchEnrichmentInput): Promise<void> {
    const promises: Promise<any>[] = []

    for (const lead of leads) {
        // 1. Email Verification
        if (operations.includes('verify-email')) {
            if (lead.emailVerified === null) {
                const p = (async () => {
                    const handle = await startChild(verifyEmailWorkflow, {
                        workflowId: `verify-email-${lead.id}-${jobId}`,
                        taskQueue: 'email-verification-queue',
                        args: [lead.email],
                    })

                    const isVerified = await handle.result()

                    await updateLeadAndNotify({
                        leadId: lead.id,
                        jobId,
                        operation: 'verify-email',
                        result: { emailVerified: isVerified }
                    })
                })()
                promises.push(p)
            }
        }

        // 2. Phone Lookup
        if (operations.includes('phone-lookup')) {
            if (!lead.phoneNumber) {
                const p = (async () => {
                    const handle = await startChild(phoneLookupWorkflow, {
                        workflowId: `phone-lookup-${lead.id}-${jobId}`,
                        taskQueue: 'phone-verify-1', // Start with primary queue (Orion)
                        args: [{
                            firstName: lead.firstName,
                            lastName: lead.lastName,
                            email: lead.email,
                            companyWebsite: lead.companyName || undefined,
                            jobTitle: lead.jobTitle || undefined,
                        }],
                    })

                    const result = await handle.result()

                    await updateLeadAndNotify({
                        leadId: lead.id,
                        jobId,
                        operation: 'phone-lookup',
                        result
                    })
                })()
                promises.push(p)
            }
        }
    }

    // Wait for all child workflows to complete
    await Promise.all(promises)
}
