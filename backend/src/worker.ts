import { NativeConnection, Worker } from '@temporalio/worker'
import * as activities from './workflows/activities'

export async function runTemporalWorker() {
  const connection = await NativeConnection.connect({
    address: 'localhost:7233',
  })
  try {
    const emailWorker = await Worker.create({
      connection,
      namespace: 'default',
      taskQueue: 'email-verification-queue',
      workflowsPath: require.resolve('./workflows'),
      activities,
      maxConcurrentActivityTaskExecutions: 10, // Rate limit: 10 concurrent emails
    })

    const orionWorker = await Worker.create({
      connection,
      namespace: 'default',
      taskQueue: 'phone-verify-1', // Orion Queue
      workflowsPath: require.resolve('./workflows'),
      activities,
      maxConcurrentActivityTaskExecutions: 3, // Rate limit: 3 concurrent Orion lookups
    })

    const secondaryWorker = await Worker.create({
      connection,
      namespace: 'default',
      taskQueue: 'phone-verify-2', // Secondary Queue
      workflowsPath: require.resolve('./workflows'),
      activities,
      maxConcurrentActivityTaskExecutions: 10, // Rate limit: 10 concurrent secondary lookups
    })

    // Keep the original queue for backward compatibility or general tasks if needed
    const defaultWorker = await Worker.create({
      connection,
      namespace: 'default',
      taskQueue: 'myQueue',
      workflowsPath: require.resolve('./workflows'),
      activities,
    })

    await Promise.all([emailWorker.run(), orionWorker.run(), secondaryWorker.run(), defaultWorker.run()])
  } finally {
    await connection.close()
  }
}
