import { AssistantMessageQueue, ToolCall, ToolOutput } from '../src';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Handler for processing function calls
async function handleFunctionCalls(threadId: string, runId: string, toolCalls: ToolCall[]): Promise<ToolOutput[]> {
  console.log(`🔧 Handling function calls for thread ${threadId}, run ${runId}`);
  console.log(`Found ${toolCalls.length} tool calls`);
  
  // Process each function call
  return Promise.all(toolCalls.map(async (toolCall) => {
    console.log(`Processing function: ${toolCall.function.name}`);
    
    // Parse arguments
    const args = JSON.parse(toolCall.function.arguments);
    console.log('Arguments:', args);
    
    let result: any;
    
    // Handle different functions
    switch (toolCall.function.name) {
      case 'get_weather':
        result = await simulateWeatherApi(args.location);
        break;
      
      case 'get_current_time':
        result = {
          time: new Date().toLocaleTimeString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
        break;
      
      default:
        result = { error: `Unknown function: ${toolCall.function.name}` };
    }
    
    // Return the tool output
    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify(result)
    };
  }));
}

// Simulate weather API
async function simulateWeatherApi(location: string): Promise<any> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const conditions = ['sunny', 'cloudy', 'rainy', 'snowy'];
  const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
  const randomTemp = Math.floor(15 + Math.random() * 15); // 15-30°C
  
  return {
    location,
    temperature: `${randomTemp}°C`,
    condition: randomCondition,
    humidity: `${Math.floor(50 + Math.random() * 40)}%`,
    updated: new Date().toISOString()
  };
}

async function runExample() {
  // Check for required environment variables
  const requiredEnvVars = ['REDIS_URL', 'OPENAI_API_KEY', 'OPENAI_ASSISTANT_ID'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  // Create assistant message queue with function calling handler
  const assistantQueue = new AssistantMessageQueue({
    redisUrl: process.env.REDIS_URL!,
    openAIApiKey: process.env.OPENAI_API_KEY!,
    assistantId: process.env.OPENAI_ASSISTANT_ID!,
    messageDelay: 1000, // 1 second delay for demo purposes
    handleRequiresAction: handleFunctionCalls
  });

  // Listen for worker events
  assistantQueue.startWorker()
    .on('completed', job => {
      console.log(`✅ Job ${job.id} completed for thread ${job.data.threadId}`);
      console.log('Result:', job.returnvalue);
    })
    .on('failed', (job, err) => {
      console.error(`❌ Job ${job?.id} failed for thread ${job?.data.threadId}:`, err);
    })
    .on('active', job => {
      console.log(`🚀 Processing job for thread ${job.data.threadId}...`);
    });

  try {
    // Create a thread or use existing one
    const threadId = process.env.THREAD_ID || await assistantQueue.createThread();
    console.log(`Using thread: ${threadId}`);
    
    // Example 1: Ask for weather information
    console.log('\n=== Example 1: Weather Request ===');
    await assistantQueue.addMessageToThread(
      threadId, 
      'What\'s the weather like in Paris?',
      'Use function calling to get weather information when requested.'
    );

    // Wait a bit before next message
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Example 2: Ask for current time
    console.log('\n=== Example 2: Time Request ===');
    await assistantQueue.addMessageToThread(
      threadId, 
      'What time is it now?',
      'Use function calling to get the current time when asked.'
    );
    
    // Example 3: Ask a regular question
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('\n=== Example 3: Regular Question ===');
    await assistantQueue.addMessageToThread(
      threadId,
      'Tell me a short joke.',
      'If the user asks for a joke, just tell them a joke without using functions.'
    );
    
    // Wait for processing to complete
    console.log('\nWaiting for all messages to be processed...');
    setTimeout(async () => {
      // Fetch and display the conversation
      const messages = await assistantQueue.listMessages(threadId, { order: 'asc' });
      
      console.log('\n=== Conversation ===');
      messages.data.forEach(msg => {
        const role = msg.role.toUpperCase();
        const content = msg.content[0]?.type === 'text' 
          ? (msg.content[0] as any).text.value 
          : JSON.stringify(msg.content);
        
        console.log(`[${role}]: ${content}`);
      });
      
      // Close the queue and exit
      await assistantQueue.close();
      console.log('\nQueue closed.');
      process.exit(0);
    }, 60000);
  } catch (error) {
    console.error('Example failed with error:', error);
    await assistantQueue.close();
    process.exit(1);
  }
}

// Run the example
runExample().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 