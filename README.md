# OpenAI Assistant Message Queue Manager

## Problem Statement

When working with OpenAI's [Assistants API](https://platform.openai.com/docs/assistants/how-it-works), developers face a significant limitation:

**You can only have one active Run in a Thread at any time.**

This creates several challenges:

1. **Message Batching Problem** - If users send multiple messages in quick succession, each message would require a separate Run, but we can't start a new Run until the previous one completes.

2. **Data Loss Risk** - Without proper queueing, newer messages might be lost if they arrive while a Run is in progress.

3. **API Inefficiency** - Processing each message individually is inefficient, especially given OpenAI's API rate limits and latency.

4. **User Experience Issues** - Users expect their messages to be processed in order and without data loss.

## Solution

This repository provides an optimized solution using BullMQ and Redis to address these challenges:

### Key Features

- **Message Batching** - Groups messages arriving within configurable time windows to be processed together in a single Run.
- **Thread Locking** - Uses Redis locks to ensure only one worker processes a Thread at a time.
- **Race Condition Prevention** - Carefully manages concurrent jobs to prevent data loss.
- **Automatic New Message Detection** - Detects and processes new messages that arrived during processing.
- **Optimized for Scalability** - Works well in environments with multiple workers.

### How It Works

1. Messages are added to a BullMQ queue with a configurable delay (default 10s)
2. Workers process the oldest unprocessed message from each Thread
3. When processing starts, all messages for that Thread are batched together
4. A Redis lock prevents concurrent processing of the same Thread
5. After processing completes, the system checks for newer messages and processes them immediately

## Getting Started

Check out the [example](./example) directory for implementation examples or the [documentation](./src/README.md) for detailed usage instructions.

## Installation

```bash
npm install openai-assistant-message-bullmq
```

## Basic Usage

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
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 