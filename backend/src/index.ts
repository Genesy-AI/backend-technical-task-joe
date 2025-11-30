import { PrismaClient } from '@prisma/client'
import express, { Request, Response } from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { ApolloServer } from '@apollo/server'
import { startStandaloneServer } from '@apollo/server/standalone'
import cors from 'cors'
import { Connection, Client } from '@temporalio/client'
import { verifyEmailWorkflow, phoneLookupWorkflow } from './workflows'
import { generateMessageFromTemplate } from './utils/messageGenerator'
import { runTemporalWorker } from './worker'
import { JobTracker } from './utils/JobTracker'
import { typeDefs } from './graphql/schema'
import { resolvers } from './graphql/resolvers'

const prisma = new PrismaClient()
const app = express()
const httpServer = createServer(app)

// Socket.IO setup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

// Initialize Socket Service
const { socketService } = require('./utils/socketService')
socketService.setIO(io)

// Job tracker for async operations
const jobTracker = new JobTracker()

// Make io available for async processing
export const socketIO = io

io.on('connection', (socket: Socket) => {
  console.log(`[WebSocket] Client connected: ${socket.id}`)

  socket.on('subscribe-job', (jobId: string) => {
    socket.join(jobId)
    console.log(`[WebSocket] ${socket.id} subscribed to job ${jobId}`)
  })

  socket.on('disconnect', () => {
    console.log(`[WebSocket] Client disconnected: ${socket.id}`)
  })
})

// Apollo Server setup
const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
})

// Start Apollo Server and add GraphQL endpoint
apolloServer.start().then(() => {
  console.log('[GraphQL] Apollo Server ready at /graphql')

  // GraphQL endpoint
  app.post('/graphql', cors(), express.json(), async (req, res) => {
    try {
      const { query, variables } = req.body
      const response = await apolloServer.executeOperation(
        { query, variables },
        { contextValue: { io, jobTracker } }
      )

      if (response.body.kind === 'single') {
        res.json(response.body.singleResult)
      } else {
        res.status(500).json({ error: 'Incremental delivery not supported' })
      }
    } catch (error) {
      console.error('[GraphQL] Error:', error)
      res.status(500).json({ error: 'GraphQL execution failed' })
    }
  })
})

app.use(express.json({ limit: '10mb' })) // Increase limit for large CSV imports

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
    return
  }

  next()
})

app.post('/leads', async (req: Request, res: Response) => {
  const { name, lastName, email } = req.body

  if (!name || !lastName || !email) {
    return res.status(400).json({ error: 'firstName, lastName, and email are required' })
  }

  const lead = await prisma.lead.create({
    data: {
      firstName: String(name),
      lastName: String(lastName),
      email: String(email),
    },
  })
  res.json(lead)
})

app.get('/leads/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const lead = await prisma.lead.findUnique({
    where: {
      id: Number(id),
    },
  })
  res.json(lead)
})

app.get('/leads', async (req: Request, res: Response) => {
  const leads = await prisma.lead.findMany()

  res.json(leads)
})

app.patch('/leads/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const { name, email } = req.body
  const lead = await prisma.lead.update({
    where: {
      id: Number(id),
    },
    data: {
      firstName: String(name),
      email: String(email),
    },
  })
  res.json(lead)
})

app.delete('/leads/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  await prisma.lead.delete({
    where: {
      id: Number(id),
    },
  })
  res.json()
})

app.delete('/leads', async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body is required and must be valid JSON' })
  }

  const { ids } = req.body

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' })
  }

  try {
    const result = await prisma.lead.deleteMany({
      where: {
        id: {
          in: ids.map((id) => Number(id)),
        },
      },
    })

    res.json({ deletedCount: result.count })
  } catch (error) {
    console.error('Error deleting leads:', error)
    res.status(500).json({ error: 'Failed to delete leads' })
  }
})

app.post('/leads/generate-messages', async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body is required and must be valid JSON' })
  }

  const { leadIds, template } = req.body

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({ error: 'leadIds must be a non-empty array' })
  }

  if (!template || typeof template !== 'string') {
    return res.status(400).json({ error: 'template must be a non-empty string' })
  }

  try {
    const leads = await prisma.lead.findMany({
      where: {
        id: {
          in: leadIds.map((id) => Number(id)),
        },
      },
    })

    if (leads.length === 0) {
      return res.status(404).json({ error: 'No leads found with the provided IDs' })
    }

    let generatedCount = 0
    const errors: Array<{ leadId: number; leadName: string; error: string }> = []

    for (const lead of leads) {
      try {
        const message = generateMessageFromTemplate(template, lead)

        await prisma.lead.update({
          where: { id: lead.id },
          data: { message },
        })

        generatedCount++
      } catch (error) {
        errors.push({
          leadId: lead.id,
          leadName: `${lead.firstName} ${lead.lastName}`.trim(),
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    res.json({
      success: true,
      generatedCount,
      errors,
    })
  } catch (error) {
    console.error('Error generating messages:', error)
    res.status(500).json({ error: 'Failed to generate messages' })
  }
})

app.post('/leads/bulk', async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body is required and must be valid JSON' })
  }

  const { leads } = req.body

  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: 'leads must be a non-empty array' })
  }

  try {
    const validLeads = leads.filter((lead) => {
      return (
        lead.firstName &&
        lead.lastName &&
        lead.email &&
        typeof lead.firstName === 'string' &&
        lead.firstName.trim() &&
        typeof lead.lastName === 'string' &&
        lead.lastName.trim() &&
        typeof lead.email === 'string' &&
        lead.email.trim()
      )
    })

    if (validLeads.length === 0) {
      return res
        .status(400)
        .json({ error: 'No valid leads found. firstName, lastName, and email are required.' })
    }

    const existingLeads = await prisma.lead.findMany({
      where: {
        OR: validLeads.map((lead) => ({
          AND: [{ firstName: lead.firstName.trim() }, { lastName: lead.lastName.trim() }],
        })),
      },
    })

    const leadKeys = new Set(
      existingLeads.map((lead) => `${lead.firstName.toLowerCase()}_${(lead.lastName || '').toLowerCase()}`)
    )

    const uniqueLeads = validLeads.filter((lead) => {
      const key = `${lead.firstName.toLowerCase()}_${lead.lastName.toLowerCase()}`
      return !leadKeys.has(key)
    })

    let importedCount = 0
    const errors: Array<{ lead: any; error: string }> = []

    for (const lead of uniqueLeads) {
      try {
        await prisma.lead.create({
          data: {
            firstName: lead.firstName.trim(),
            lastName: lead.lastName.trim(),
            email: lead.email.trim(),
            jobTitle: lead.jobTitle ? lead.jobTitle.trim() : null,
            countryCode: lead.countryCode ? lead.countryCode.trim() : null,
            companyName: lead.companyName ? lead.companyName.trim() : null,
          },
        })
        importedCount++
      } catch (error) {
        errors.push({
          lead: lead,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    res.json({
      success: true,
      importedCount,
      duplicatesSkipped: validLeads.length - uniqueLeads.length,
      invalidLeads: leads.length - validLeads.length,
      errors,
    })
  } catch (error) {
    console.error('Error importing leads:', error)
    res.status(500).json({ error: 'Failed to import leads' })
  }
})

app.post('/leads/verify-emails', async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body is required and must be valid JSON' })
  }

  const { leadIds } = req.body as { leadIds?: number[] }

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({ error: 'leadIds must be a non-empty array' })
  }

  try {
    // Validate leads exist
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds.map((id) => Number(id)) } },
    })

    if (leads.length === 0) {
      return res.status(404).json({ error: 'No leads found with the provided IDs' })
    }

    // Create job and return immediately
    const jobId = jobTracker.createJob('email-verification', leads.length)

    res.json({
      jobId,
      totalLeads: leads.length,
      message: 'Email verification started. Subscribe to WebSocket for updates.'
    })

    // Process async (don't await)
    processEmailVerifications(leads, jobId)
  } catch (error) {
    console.error('Error starting email verification:', error)
    res.status(500).json({ error: 'Failed to start email verification' })
  }
})

/**
 * Process email verifications asynchronously with WebSocket updates
 */
async function processEmailVerifications(leads: any[], jobId: string) {
  const connection = await Connection.connect({ address: 'localhost:7233' })
  const client = new Client({ connection, namespace: 'default' })

  for (const lead of leads) {
    try {
      const isVerified = await client.workflow.execute(verifyEmailWorkflow, {
        taskQueue: 'myQueue',
        workflowId: `verify-email-${lead.id}-${Date.now()}`,
        args: [lead.email],
      })

      await prisma.lead.update({
        where: { id: lead.id },
        data: { emailVerified: Boolean(isVerified) },
      })

      // Emit WebSocket event
      const job = jobTracker.getJob(jobId)
      jobTracker.incrementProgress(jobId)

      io.to(jobId).emit('lead-verified', {
        leadId: lead.id,
        emailVerified: isVerified,
        progress: {
          processed: job?.processedLeads || 0,
          total: job?.totalLeads || 0
        }
      })

      console.log(`[Email Verification] Lead ${lead.id} verified: ${isVerified}`)
    } catch (error) {
      console.error(`[Email Verification] Error for lead ${lead.id}:`, error)

      io.to(jobId).emit('lead-error', {
        leadId: lead.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Job complete
  io.to(jobId).emit('job-complete', {
    jobId,
    type: 'email-verification',
    totalProcessed: jobTracker.getJob(jobId)?.processedLeads || 0
  })

  await connection.close()
  jobTracker.cleanup(jobId)
}

// Bulk phone lookup with WebSocket updates
app.post('/leads/phone-lookup', async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body is required and must be valid JSON' })
  }

  const { leadIds } = req.body as { leadIds?: number[] }

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({ error: 'leadIds must be a non-empty array' })
  }

  try {
    // Validate leads exist
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds.map((id) => Number(id)) } },
    })

    if (leads.length === 0) {
      return res.status(404).json({ error: 'No leads found with the provided IDs' })
    }

    // Filter out leads that already have phone numbers
    const leadsWithoutPhone = leads.filter(lead => !lead.phoneNumber)

    if (leadsWithoutPhone.length === 0) {
      return res.json({
        message: 'All selected leads already have phone numbers',
        skipped: leads.length
      })
    }

    // Create job and return immediately
    const jobId = jobTracker.createJob('phone-lookup', leadsWithoutPhone.length)

    res.json({
      jobId,
      totalLeads: leadsWithoutPhone.length,
      skipped: leads.length - leadsWithoutPhone.length,
      message: 'Phone lookup started. Subscribe to WebSocket for updates.'
    })

    // Process async (don't await)
    processPhoneLookups(leadsWithoutPhone, jobId)
  } catch (error) {
    console.error('Error starting phone lookup:', error)
    res.status(500).json({ error: 'Failed to start phone lookup' })
  }
})

/**
 * Process phone lookups asynchronously with WebSocket updates
 */
async function processPhoneLookups(leads: any[], jobId: string) {
  const connection = await Connection.connect({ address: 'localhost:7233' })
  const client = new Client({ connection, namespace: 'default' })

  for (const lead of leads) {
    try {
      const handle = await client.workflow.start(phoneLookupWorkflow, {
        taskQueue: 'myQueue',
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

      // Emit WebSocket event
      const job = jobTracker.getJob(jobId)
      jobTracker.incrementProgress(jobId)

      io.to(jobId).emit('phone-found', {
        leadId: lead.id,
        phone: result.phone,
        provider: result.provider,
        cost: result.cost,
        progress: {
          processed: job?.processedLeads || 0,
          total: job?.totalLeads || 0
        }
      })

      console.log(`[Phone Lookup] Lead ${lead.id} - ${result.phone ? `Found: ${result.phone} (${result.provider})` : 'Not found'}`)
    } catch (error) {
      console.error(`[Phone Lookup] Error for lead ${lead.id}:`, error)

      io.to(jobId).emit('lead-error', {
        leadId: lead.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Job complete
  io.to(jobId).emit('job-complete', {
    jobId,
    type: 'phone-lookup',
    totalProcessed: jobTracker.getJob(jobId)?.processedLeads || 0
  })

  await connection.close()
  jobTracker.cleanup(jobId)
}

// Single lead phone lookup (kept for backwards compatibility)
app.post('/leads/:id/phone-lookup', async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.id)

    // Find the lead
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    })

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' })
    }

    // Skip if phone number already exists
    if (lead.phoneNumber) {
      console.log(`[Phone Lookup] Lead ${leadId} (${lead.firstName} ${lead.lastName}) already has phone number: ${lead.phoneNumber} - Skipping`)
      return res.json({
        phone: lead.phoneNumber,
        skipped: true,
        message: 'Phone number already exists'
      })
    }

    console.log(`[Phone Lookup] Starting workflow for lead ${leadId} (${lead.firstName} ${lead.lastName})`)

    const connection = await Connection.connect({ address: 'localhost:7233' })
    const client = new Client({ connection, namespace: 'default' })

    // Start the phone lookup workflow
    const handle = await client.workflow.start(phoneLookupWorkflow, {
      taskQueue: 'myQueue',
      workflowId: `phone-lookup-${leadId}`, // Idempotency key
      args: [
        {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          companyWebsite: lead.companyName || undefined, // Use companyName from lead if available
          jobTitle: lead.jobTitle || undefined,
        },
      ],
    })

    // Wait for result (or we could return the workflow ID for async polling)
    // For this task, let's wait for the result to show it immediately in the UI if possible,
    // but usually workflows are async. The requirement says "Show process feedback to the user".
    // If we wait here, the HTTP request might timeout if the workflow takes too long.
    // However, the user wants "Show process feedback".
    // Let's return the workflowId and handle polling or just wait if it's fast enough.
    // Given the "waterfall" nature, it might take a few seconds.
    // but in production you'd want to make this async with webhooks/polling
    const result = await handle.result()

    // Update the lead with the phone number if found
    if (result.phone) {
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          phoneNumber: result.phone  // Only save the phone string
        },
      })

      console.log(`[Phone Lookup] Lead ${leadId} updated with phone: ${result.phone} from ${result.provider} (cost: $${result.cost})`)

      res.json({
        phone: result.phone,
        provider: result.provider,
        cost: result.cost,
        skipped: false
      })
    } else {
      console.log(`[Phone Lookup] No phone found for lead ${leadId}`)
      res.json({
        phone: null,
        skipped: false,
        message: 'No phone number found from any provider'
      })
    }

    await connection.close()
  } catch (error) {
    console.error('Error in phone lookup:', error)
    res.status(500).json({ error: 'Failed to perform phone lookup' })
  }
})

httpServer.listen(4000, () => {
  console.log('Server running on http://localhost:4000')
  console.log('[WebSocket] Socket.IO ready for connections')
})

runTemporalWorker().catch((err) => {
  console.error(err)
  process.exit(1)
})
