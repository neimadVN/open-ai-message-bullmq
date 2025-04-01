# OpenAI Assistant Message Queue Examples

This directory contains example applications demonstrating how to use the OpenAI Assistant Message Queue library with different frameworks.

## Examples

### Express Example

The `express-example.ts` file demonstrates how to use the library with Express. It includes:

- Setting up an Express server with the assistant router
- Implementation of function handlers for the assistant
- A simple web interface for testing the assistant

#### Running the Express Example

1. Create a `.env` file in the root directory with the following variables:
   ```
   REDIS_URL=redis://localhost:6379
   OPENAI_API_KEY=your_openai_api_key
   OPENAI_ASSISTANT_ID=your_assistant_id
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run the example:
   ```
   npm run example:express
   ```

4. Open your browser to `http://localhost:3000` to interact with the assistant.

## Setting up your OpenAI Assistant

For these examples to work, you need to create an assistant in the OpenAI platform with appropriate tools:

1. Go to the [OpenAI platform](https://platform.openai.com/assistants)
2. Create a new assistant with at least these tools:
   - `get_weather` - A function that gets weather information for a location
   - `get_current_time` - A function that returns the current time

For the Express example, these functions are implemented in the `express-example.ts` file as simple mock implementations. In a real application, you would implement these functions to call actual APIs or perform real operations.

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

## Running the Examples

### Basic Example

The basic example demonstrates adding messages to a thread and processing them in batches:

```bash
npm run example
```

Or directly:

```bash
ts-node example/basic.ts
```

### Function Calling Example

The function calling example demonstrates how to handle function calls from the Assistant API:

```bash
npm run example:function-calling
```

Or directly:

```bash
ts-node example/function-calling.ts
```

> **Note:** For this example to work, your OpenAI Assistant must be configured with function calling capabilities. You can set up functions in the OpenAI platform.

## What to Expect

### Basic Example

The basic example:

1. Adds a batch of 3 messages to a thread
2. Waits for the worker to process them (after message delay)
3. Adds a second batch of 2 messages
4. Adds a final message
5. Observes how messages are batched and processed

### Function Calling Example

The function calling example:

1. Sets up a handler for function calls (`get_weather` and `get_current_time`)
2. Sends messages that should trigger function calls
3. Processes the function calls and submits the results back to OpenAI
4. Shows the complete conversation including the results

## Expected Output

For the basic example, you should see output similar to:

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

For the function calling example, you should see function calls being processed:

```
=== Example 1: Weather Request ===
🚀 Processing job for thread thread_abc123...
🔧 Handling function calls for thread thread_abc123, run run_abc123
Found 1 tool calls
Processing function: get_weather
Arguments: { "location": "Paris" }
✅ Job thread_abc123_1234567890123 completed for thread thread_abc123
```

## Creating Your Own Examples

You can modify the example files or create new ones to test different scenarios:

- Testing with multiple threads
- Using custom instructions for different messages
- Testing error handling and retries
- Monitoring queue status 