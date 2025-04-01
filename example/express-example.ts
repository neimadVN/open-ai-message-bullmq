import express from 'express';
import dotenv from 'dotenv';
import { createAssistantRouter, createFunctionCallHandler } from '../src/lib/express-adapter';

// Load environment variables
dotenv.config();

// Define function handlers for the assistant
const functionHandlers = {
  get_weather: async ({ location }: { location: string }) => {
    console.log(`Getting weather for ${location}`);
    // Simulate API call
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
  },
  
  get_current_time: async () => {
    return {
      time: new Date().toLocaleTimeString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      date: new Date().toLocaleDateString()
    };
  }
};

// Check for required environment variables
const requiredEnvVars = ['REDIS_URL', 'OPENAI_API_KEY', 'OPENAI_ASSISTANT_ID'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Create the express app
const app = express();
app.use(express.json());

// Create the assistant router with the function handlers
const { router, assistantQueue } = createAssistantRouter({
  redisUrl: process.env.REDIS_URL!,
  openAIApiKey: process.env.OPENAI_API_KEY!,
  assistantId: process.env.OPENAI_ASSISTANT_ID!,
  basePath: '/api/assistant',
  handleRequiresAction: createFunctionCallHandler(functionHandlers)
});

// Add the router to the app
app.use(router);

// Add a simple frontend for testing
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Assistant API Tester</title>
      <style>
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .card {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
        }
        button {
          background-color: #0066ff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        input, textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin-bottom: 10px;
        }
        #messages {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 10px;
          max-height: 400px;
          overflow-y: auto;
        }
        .message {
          margin-bottom: 10px;
          padding: 10px;
          border-radius: 8px;
        }
        .user {
          background-color: #f0f0f0;
          align-self: flex-end;
        }
        .assistant {
          background-color: #e6f2ff;
          align-self: flex-start;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>OpenAI Assistant API Tester</h1>
        
        <div class="card">
          <h2>Create Thread</h2>
          <button id="createThread">Create New Thread</button>
          <p>Thread ID: <span id="threadId">${process.env.THREAD_ID || 'None'}</span></p>
        </div>
        
        <div class="card">
          <h2>Send Message</h2>
          <input type="text" id="message" placeholder="Type your message here...">
          <button id="sendMessage">Send</button>
        </div>
        
        <div class="card">
          <h2>Conversation</h2>
          <div id="messages"></div>
          <button id="refreshMessages">Refresh Messages</button>
        </div>
      </div>
      
      <script>
        const threadIdEl = document.getElementById('threadId');
        const messagesEl = document.getElementById('messages');
        
        // Set initial thread ID if available
        let threadId = '${process.env.THREAD_ID || ''}';
        if (threadId) {
          threadIdEl.textContent = threadId;
          loadMessages();
        }
        
        // Create thread
        document.getElementById('createThread').addEventListener('click', async () => {
          try {
            const response = await fetch('/api/assistant/threads', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            threadId = data.threadId;
            threadIdEl.textContent = threadId;
            messagesEl.innerHTML = '';
          } catch (error) {
            console.error('Error creating thread:', error);
            alert('Error creating thread');
          }
        });
        
        // Send message
        document.getElementById('sendMessage').addEventListener('click', async () => {
          const messageInput = document.getElementById('message');
          const message = messageInput.value.trim();
          
          if (!message) return;
          if (!threadId) {
            alert('Please create a thread first');
            return;
          }
          
          try {
            // Add user message to UI immediately
            addMessageToUI('user', message);
            messageInput.value = '';
            
            await fetch(\`/api/assistant/threads/\${threadId}/messages\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message })
            });
            
            // Wait a moment and then refresh messages to see the assistant's response
            setTimeout(loadMessages, 2000);
            setTimeout(loadMessages, 5000);
            setTimeout(loadMessages, 10000);
          } catch (error) {
            console.error('Error sending message:', error);
            alert('Error sending message');
          }
        });
        
        // Refresh messages
        document.getElementById('refreshMessages').addEventListener('click', loadMessages);
        
        // Load messages
        async function loadMessages() {
          if (!threadId) return;
          
          try {
            const response = await fetch(\`/api/assistant/threads/\${threadId}/messages\`);
            const data = await response.json();
            
            // Clear and rebuild messages UI
            messagesEl.innerHTML = '';
            data.data.forEach(msg => {
              addMessageToUI(msg.role, msg.content);
            });
          } catch (error) {
            console.error('Error loading messages:', error);
          }
        }
        
        // Add message to UI
        function addMessageToUI(role, content) {
          const messageEl = document.createElement('div');
          messageEl.className = \`message \${role}\`;
          messageEl.innerHTML = \`<strong>\${role.toUpperCase()}:</strong> \${content}\`;
          messagesEl.appendChild(messageEl);
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      </script>
    </body>
    </html>
  `);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser to test the assistant`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await assistantQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await assistantQueue.close();
  process.exit(0);
}); 