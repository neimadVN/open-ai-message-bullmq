# OpenAI Assistant Message Queue

This module provides a robust solution for managing message queues for OpenAI's Assistant API. It handles batching messages, prevents data loss, and ensures efficient processing of messages.

## Installation

```bash
npm install openai-assistant-message-bullmq
```

## Prerequisites

- Node.js 16.x or higher
- Redis server (local or remote)
- OpenAI API key
- OpenAI Assistant ID (you need to create an assistant first)

## Architecture

The main components are:

1. **AssistantMessageQueue**: The main class that manages the queue and worker.
2. **BullMQ Queue**: Handles job queuing, retries, and scheduling.
3. **Redis**: Used for storage and thread locking.
4. **OpenAI API**: Processes messages and runs.

## Usage

### Basic Usage

```typescript
import { AssistantMessageQueue } from 'openai-assistant-message-bullmq';

// Initialize the queue manager
const assistantQueue = new AssistantMessageQueue({
  redisUrl: 'redis://localhost:6379',
  openAIApiKey: 'your-openai-api-key',
  assistantId: 'your-assistant-id',
});

// Add a message to a thread
await assistantQueue.addMessageToThread('thread-123', 'Hello, assistant!');

// Start the worker to process messages
assistantQueue.startWorker();

// When shutting down
await assistantQueue.close();
```

### Configuration Options

The `AssistantMessageQueue` constructor accepts various options:

```typescript
interface AssistantMessageQueueOptions {
  redisUrl: string;           // Redis connection URL
  openAIApiKey: string;       // OpenAI API Key
  assistantId: string;        // Assistant ID from OpenAI
  queuePrefix?: string;       // Queue name prefix (default: 'assistant')
  messageDelay?: number;      // Delay before processing (default: 10000ms)
  maxAttempts?: number;       // Max job attempts (default: 3)
  backoff?: {                 // Backoff config for failed jobs
    type?: 'fixed' | 'exponential';  // Backoff type (default: 'exponential')
    delay?: number;           // Initial delay (default: 5000ms)
  };
  concurrency?: number;       // Max concurrent jobs (default: 5)
  defaultInstructions?: string; // Default assistant instructions
  lockDuration?: number;      // Thread lock duration (default: 300000ms)
  removeOnComplete?: boolean; // Whether to remove completed jobs (default: true)
}
```

### Advanced Usage

#### Custom Instructions

You can provide custom instructions for each message:

```typescript
await assistantQueue.addMessageToThread(
  'thread-123', 
  'What is the weather?',
  'Answer the user query about weather.'
);
```

#### Monitoring

Get queue status:

```typescript
const status = await assistantQueue.getQueueStatus();
console.log(status);
// {
//   activeCount: 1,
//   waitingCount: 2,
//   delayedCount: 3,
//   completedCount: 10,
//   failedCount: 0
// }
```

#### Event Handling

The worker emits various events:

```typescript
assistantQueue.startWorker()
  .on('completed', job => {
    console.log(`Job ${job.id} completed`);
  })
  .on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
  });
```

## How It Works

1. When you add a message to a thread, it's added to the queue with a configurable delay.
2. The worker processes the oldest message for each thread.
3. When processing begins, the system fetches all messages for that thread.
4. A Redis lock prevents concurrent processing of the same thread.
5. Messages are combined and sent to OpenAI in a single API call.
6. After processing completes, the system checks for newer messages.
7. If newer messages exist, the system immediately processes them.

This approach ensures:
- No data loss when messages arrive during processing
- Efficient batching of messages
- Thread-safe processing across multiple workers
- Graceful handling of OpenAI API limitations

## Error Handling

The system includes exponential backoff for failed jobs, timeout handling for long-running operations, and proper lock management to prevent deadlocks.

## Scalability

The architecture supports:
- Multiple workers across different instances
- High message throughput
- Proper distribution of work 