/**
 * Configuration options for the AssistantMessageQueue
 */
export interface AssistantMessageQueueOptions {
  /**
   * Redis connection URL (e.g., 'redis://localhost:6379')
   */
  redisUrl: string;
  
  /**
   * OpenAI API Key
   */
  openAIApiKey: string;
  
  /**
   * Assistant ID from OpenAI
   */
  assistantId: string;
  
  /**
   * Queue name prefix (default: 'assistant')
   */
  queuePrefix?: string;
  
  /**
   * Delay before processing messages to allow for batching (in milliseconds)
   * Default: 10000 (10 seconds)
   */
  messageDelay?: number;
  
  /**
   * Number of job processing attempts before giving up
   * Default: 3
   */
  maxAttempts?: number;
  
  /**
   * Backoff configuration for failed jobs
   */
  backoff?: {
    /**
     * Type of backoff delay ('fixed' or 'exponential')
     * Default: 'exponential'
     */
    type?: 'fixed' | 'exponential';
    
    /**
     * Initial delay in milliseconds
     * Default: 5000 (5 seconds)
     */
    delay?: number;
  };
  
  /**
   * Maximum number of concurrent jobs a worker can process
   * Default: 5
   */
  concurrency?: number;
  
  /**
   * Default instructions for the assistant when processing messages
   */
  defaultInstructions?: string;
  
  /**
   * Lock duration for thread processing (in milliseconds)
   * Default: 300000 (5 minutes)
   */
  lockDuration?: number;
  
  /**
   * Whether to remove completed jobs from the queue
   * Default: true
   */
  removeOnComplete?: boolean;
}

/**
 * Internal message job data structure
 */
export interface MessageJobData {
  /**
   * Thread ID
   */
  threadId: string;
  
  /**
   * Message content
   */
  message: string;
  
  /**
   * Timestamp when the message was added
   */
  timestamp: number;
  
  /**
   * Optional instructions for this specific message batch
   */
  instructions?: string;
}

/**
 * Information about a processed job
 */
export interface ProcessedJob {
  /**
   * Job ID
   */
  id: string;
  
  /**
   * Thread ID
   */
  threadId: string;
  
  /**
   * Message content
   */
  message: string;
  
  /**
   * Timestamp when the message was added
   */
  timestamp: number;
}

/**
 * Result of processing messages
 */
export interface ProcessingResult {
  /**
   * Thread ID
   */
  threadId: string;
  
  /**
   * Number of messages processed
   */
  messagesProcessed: number;
  
  /**
   * Job IDs that were processed
   */
  processedJobIds: string[];
  
  /**
   * Run ID from OpenAI
   */
  runId: string;
  
  /**
   * Status of the run
   */
  status: string;
}

/**
 * Status of the assistant message queue
 */
export interface QueueStatus {
  /**
   * Number of active jobs
   */
  activeCount: number;
  
  /**
   * Number of waiting jobs
   */
  waitingCount: number;
  
  /**
   * Number of delayed jobs
   */
  delayedCount: number;
  
  /**
   * Number of completed jobs
   */
  completedCount: number;
  
  /**
   * Number of failed jobs
   */
  failedCount: number;
} 