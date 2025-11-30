import { PrismaClient } from '@prisma/client'
import { socketService } from '../../utils/socketService'

const prisma = new PrismaClient()

interface UpdateLeadParams {
    leadId: number
    jobId: string
    operation: 'verify-email' | 'phone-lookup'
    result: any
}

export async function updateLeadAndNotify({ leadId, jobId, operation, result }: UpdateLeadParams): Promise<void> {
    try {
        if (operation === 'verify-email') {
            await prisma.lead.update({
                where: { id: leadId },
                data: { emailVerified: Boolean(result.emailVerified) },
            })

            socketService.emit(jobId, 'operation-complete', {
                leadId,
                operation,
                data: { emailVerified: result.emailVerified },
                // Progress tracking is simplified here; we might need to pass total/completed if we want accurate bars
                // For now, let's just emit the completion. The frontend accumulates.
            })
        } else if (operation === 'phone-lookup') {
            if (result.phone) {
                await prisma.lead.update({
                    where: { id: leadId },
                    data: { phoneNumber: result.phone },
                })
            }

            socketService.emit(jobId, 'operation-complete', {
                leadId,
                operation,
                data: { phone: result.phone, provider: result.provider, cost: result.cost },
            })
        }

        console.log(`[Activity] Updated lead ${leadId} for ${operation}`)
    } catch (error) {
        console.error(`[Activity] Failed to update lead ${leadId}:`, error)
        throw error
    }
}
