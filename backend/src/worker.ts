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

    const phoneWorker = await Worker.create({
      connection,
      namespace: 'default',
      taskQueue: 'phone-lookup-queue',
      workflowsPath: require.resolve('./workflows'),
      activities,
      maxConcurrentActivityTaskExecutions: 10, // Rate limit: 10 concurrent phone lookups
    })

    // Keep the original queue for backward compatibility or general tasks if needed
    const defaultWorker = await Worker.create({
      connection,
      namespace: 'default',
      taskQueue: 'myQueue',
      workflowsPath: require.resolve('./workflows'),
      activities,
    })

    await Promise.all([emailWorker.run(), phoneWorker.run(), defaultWorker.run()])
  } finally {
    await connection.close()
  }
}
