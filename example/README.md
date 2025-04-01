# Assistant Message Queue Examples

This directory contains example code for using the OpenAI Assistant Message Queue library.

## Prerequisites

Before running the examples, you need:

1. A running Redis server
2. An OpenAI API key
3. An OpenAI Assistant ID
4. (Optional) An existing OpenAI Thread ID

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create an `.env` file in the project root directory with your credentials:
   ```
   REDIS_URL=redis://localhost:6379
   OPENAI_API_KEY=sk-your-openai-api-key
   OPENAI_ASSISTANT_ID=asst_your-assistant-id
   THREAD_ID=thread_your-thread-id  # Optional
   ```

   You can copy the `.env.example` file as a starting point:
   ```bash
   cp .env.example .env
   ```

3. If you don't have a local Redis server, you can run one with Docker:
   ```bash
   docker run -d --name redis -p 6379:6379 redis:alpine
   ```

## Running the Basic Example

The basic example demonstrates adding messages to a thread and processing them in batches:

```bash
npm run example
```

Or directly:

```bash
ts-node example/basic.ts
```

## What to Expect

The basic example:

1. Adds a batch of 3 messages to a thread
2. Waits for the worker to process them (after message delay)
3. Adds a second batch of 2 messages
4. Adds a final message
5. Observes how messages are batched and processed

You should see console output similar to:

```
=== Demo: Sequential messages in same thread ===
Adding batch 1 messages...
Batch 1 added in 123ms
Adding batch 2 messages...
Batch 2 added in 89ms
🚀 Processing jobs for thread thread_abc123...
Adding final message...
Final message added in 45ms
✅ Job thread_abc123_1234567890123 completed for thread thread_abc123
Result: {
  threadId: 'thread_abc123',
  messagesProcessed: 3,
  processedJobIds: [...],
  runId: 'run_abc123',
  status: 'completed'
}
🚀 Processing jobs for thread thread_abc123...
✅ Job thread_abc123_1234567891234 completed for thread thread_abc123
Result: {
  threadId: 'thread_abc123',
  messagesProcessed: 3,
  processedJobIds: [...],
  runId: 'run_def456',
  status: 'completed'
}
```

This demonstrates how messages are efficiently batched together and processed in the order they are received, without data loss.

## Creating Your Own Examples

You can modify `basic.ts` or create new examples to test different scenarios:

- Testing with multiple threads
- Using custom instructions for different messages
- Testing error handling and retries
- Monitoring queue status 