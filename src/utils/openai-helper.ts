import OpenAI from 'openai';

/**
 * Wait for an OpenAI run to complete with exponential backoff
 * 
 * @param openai OpenAI client
 * @param threadId Thread ID
 * @param runId Run ID
 * @param options Configuration options
 * @returns Final run status
 */
export async function waitForRunCompletion(
  openai: OpenAI,
  threadId: string,
  runId: string,
  options: {
    initialDelay?: number;
    maxDelay?: number;
    maxWaitTime?: number;
  } = {}
): Promise<string> {
  const {
    initialDelay = 1000,
    maxDelay = 15000,
    maxWaitTime = 300000,
  } = options;
  
  let status = "in_progress";
  let delay = initialDelay;
  const startTime = Date.now();
  
  while (["in_progress", "queued", "requires_action"].includes(status)) {
    // Check for timeout
    if (Date.now() - startTime > maxWaitTime) {
      throw new Error(`Run timeout exceeded for thread ${threadId}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Check status
    const checkRun = await openai.beta.threads.runs.retrieve(threadId, runId);
    status = checkRun.status;
    
    // Exponential backoff with maximum limit
    delay = Math.min(delay * 1.5, maxDelay);
  }
  
  if (status !== "completed") {
    throw new Error(`Run ended with status: ${status} for thread ${threadId}`);
  }
  
  return status;
}

/**
 * Creates a message in an OpenAI thread
 * 
 * @param openai OpenAI client
 * @param threadId Thread ID
 * @param content Message content
 * @returns Created message
 */
export async function createThreadMessage(
  openai: OpenAI,
  threadId: string,
  content: string
) {
  return openai.beta.threads.messages.create(threadId, {
    role: "user",
    content
  });
}

/**
 * Creates and starts a run in an OpenAI thread
 * 
 * @param openai OpenAI client
 * @param threadId Thread ID
 * @param assistantId Assistant ID
 * @param instructions Optional instructions for the run
 * @returns Created run
 */
export async function createAndStartRun(
  openai: OpenAI,
  threadId: string,
  assistantId: string,
  instructions?: string
) {
  return openai.beta.threads.runs.create(threadId, {
    assistant_id: assistantId,
    instructions
  });
} 