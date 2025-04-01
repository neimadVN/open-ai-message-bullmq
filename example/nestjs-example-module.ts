import { Module, Controller, Get, Post, Body, Param, UseGuards, Injectable } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AssistantMessageQueueService, assistantMessageQueueFactory } from '../src/lib/nestjs-adapter';
import { ToolCall, ToolOutput, QueueStatus } from '../src';

/**
 * Example service that handles function calls from the assistant
 */
@Injectable()
export class FunctionCallingService {
  /**
   * Handles function calls
   * @param threadId Thread ID
   * @param runId Run ID
   * @param toolCalls Tool calls
   * @returns Tool outputs
   */
  async handleFunctionCalls(threadId: string, runId: string, toolCalls: ToolCall[]): Promise<ToolOutput[]> {
    console.log(`Handling function calls for thread ${threadId}, run ${runId}`);
    
    return Promise.all(toolCalls.map(async (toolCall) => {
      const args = JSON.parse(toolCall.function.arguments);
      
      // Handle different functions
      let result: any;
      switch (toolCall.function.name) {
        case 'get_user_data':
          result = await this.getUserData(args.userId);
          break;
        
        case 'create_order':
          result = await this.createOrder(args.productId, args.quantity);
          break;
          
        default:
          result = { error: `Unknown function: ${toolCall.function.name}` };
      }
      
      return {
        tool_call_id: toolCall.id,
        output: JSON.stringify(result)
      };
    }));
  }
  
  /**
   * Example function: Get user data
   */
  private async getUserData(userId: string): Promise<any> {
    // This would typically fetch from a database
    return {
      id: userId,
      name: 'John Doe',
      email: 'john.doe@example.com',
      createdAt: new Date().toISOString()
    };
  }
  
  /**
   * Example function: Create an order
   */
  private async createOrder(productId: string, quantity: number): Promise<any> {
    // This would typically create an order in a database
    return {
      orderId: `order_${Math.random().toString(36).substr(2, 9)}`,
      productId,
      quantity,
      totalPrice: quantity * 99.99,
      status: 'created',
      createdAt: new Date().toISOString()
    };
  }
}

/**
 * Example controller that uses the AssistantMessageQueueService
 */
@Controller('chat')
export class ChatController {
  constructor(
    private readonly assistantService: AssistantMessageQueueService
  ) {}
  
  /**
   * Create a new chat thread
   */
  @Post('threads')
  async createThread(): Promise<{ threadId: string }> {
    const threadId = await this.assistantService.createThread();
    return { threadId };
  }
  
  /**
   * Send a message to a thread
   */
  @Post('threads/:threadId/messages')
  async sendMessage(
    @Param('threadId') threadId: string,
    @Body() body: { message: string }
  ): Promise<{ jobId: string }> {
    const jobId = await this.assistantService.addMessageToThread(
      threadId,
      body.message
    );
    
    return { jobId };
  }
  
  /**
   * Get messages from a thread
   */
  @Get('threads/:threadId/messages')
  async getMessages(@Param('threadId') threadId: string): Promise<{ id: string; role: string; content: any; createdAt: number }[]> {
    const messages = await this.assistantService.listMessages(threadId, {
      order: 'asc'
    });
    
    return messages.data.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content[0]?.type === 'text' 
        ? (msg.content[0] as any).text.value 
        : JSON.stringify(msg.content),
      createdAt: msg.created_at
    }));
  }
  
  /**
   * Get queue status
   */
  @Get('status')
  async getStatus(): Promise<QueueStatus> {
    return this.assistantService.getQueueStatus();
  }
}

/**
 * Example NestJS module for the Assistant Message Queue
 */
@Module({
  imports: [
    ConfigModule.forRoot(),
  ],
  providers: [
    FunctionCallingService,
    {
      provide: AssistantMessageQueueService,
      useFactory: (configService: ConfigService, functionCallingService: FunctionCallingService) => {
        return new AssistantMessageQueueService({
          redisUrl: configService.get<string>('REDIS_URL') || 'redis://localhost:6379',
          openAIApiKey: configService.get<string>('OPENAI_API_KEY') || '',
          assistantId: configService.get<string>('OPENAI_ASSISTANT_ID') || '',
          handleRequiresAction: functionCallingService.handleFunctionCalls.bind(functionCallingService)
        });
      },
      inject: [ConfigService, FunctionCallingService]
    }
  ],
  controllers: [ChatController],
  exports: [AssistantMessageQueueService]
})
export class AssistantMessageQueueModule {}

/**
 * App module example showing how to import the AssistantMessageQueueModule
 */
@Module({
  imports: [
    ConfigModule.forRoot(),
    AssistantMessageQueueModule
  ]
})
export class AppModule {} 