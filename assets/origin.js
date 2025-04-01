// queue.js
import { Queue } from "bullmq";
import { createClient } from "redis";

export const redisConnection = createClient({ url: "redis://localhost:6379" });
await redisConnection.connect();

// Tạo queue với BullMQ, sử dụng mặc định prefix "bull"
export const messageQueue = new Queue("messageQueue", {
  connection: redisConnection,
});

/**
 * Thêm message vào thread.
 * Mỗi job chứa 1 message và được đặt jobId theo định dạng: thread_<threadId>_<timestamp>
 * Đồng thời lưu jobId vào một Set trong Redis để tra cứu hiệu quả hơn
 */
export async function addMessageToThread(threadId, message) {
  const timestamp = Date.now();
  const jobId = `thread_${threadId}_${timestamp}`;
  
  // Thêm job vào queue
  await messageQueue.add(jobId, { threadId, message, timestamp }, {
    delay: 10000, // Delay 10 giây để gom nhóm message
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
  });
  
  // Lưu jobId vào Set của thread để truy vấn nhanh
  await redisConnection.sAdd(`bull:threadJobs:${threadId}`, jobId);
  
  console.log(`📝 Added message to thread ${threadId}: ${message}`);
}

/**
 * Lấy tất cả các job có jobId bắt đầu với "thread_<threadId>_"
 * Sử dụng Redis Set để tra cứu thay vì dùng lệnh KEYS
 */
export async function getJobsByThreadId(threadId) {
  // Lấy jobIds từ Set của thread
  const jobIds = await redisConnection.sMembers(`bull:threadJobs:${threadId}`);
  
  // Nếu không có job nào, trả về mảng rỗng
  if (!jobIds || jobIds.length === 0) {
    return [];
  }
  
  // Lấy jobs theo batch để tối ưu hiệu suất
  const batchSize = 20;
  const jobs = [];
  
  for (let i = 0; i < jobIds.length; i += batchSize) {
    const batchIds = jobIds.slice(i, i + batchSize);
    const batchJobs = await Promise.all(
      batchIds.map(id => messageQueue.getJob(id))
    );
    jobs.push(...batchJobs.filter(Boolean));
  }
  
  return jobs;
}

/**
 * Xóa jobId khỏi Set của thread sau khi job được xử lý
 */
export async function removeJobsFromThreadIndex(threadId, jobIds) {
  if (jobIds.length === 0) return;
  
  await redisConnection.sRem(`bull:threadJobs:${threadId}`, ...jobIds);
}

// worker.js
import { Worker, QueueScheduler } from "bullmq";
import { redisConnection, messageQueue, getJobsByThreadId, removeJobsFromThreadIndex } from "./queue.js";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Khởi tạo QueueScheduler để đảm bảo xử lý các job bị treo (stalled)
new QueueScheduler("messageQueue", { connection: redisConnection });

/**
 * Hàm kiểm tra trạng thái run của OpenAI với exponential backoff
 */
async function waitForRunCompletion(threadId, runId) {
  let status = "in_progress";
  let delay = 1000; // Bắt đầu với 1 giây
  const maxDelay = 15000; // Tối đa 15 giây
  const maxWaitTime = 300000; // Tối đa 5 phút
  const startTime = Date.now();
  
  while (["in_progress", "queued", "requires_action"].includes(status)) {
    // Kiểm tra thời gian tối đa
    if (Date.now() - startTime > maxWaitTime) {
      throw new Error(`Run timeout exceeded for thread ${threadId}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Kiểm tra trạng thái
    const checkRun = await openai.beta.threads.runs.retrieve(threadId, runId);
    status = checkRun.status;
    
    // Exponential backoff với giới hạn tối đa
    delay = Math.min(delay * 1.5, maxDelay);
  }
  
  if (status !== "completed") {
    throw new Error(`Run ended with status: ${status} for thread ${threadId}`);
  }
  
  return status;
}

/**
 * Hàm xử lý tất cả message của một thread.
 * jobs: danh sách các job có cùng threadId (mỗi job chứa 1 message).
 */
async function processMessages(threadId, jobs) {
  const lockKey = `lock_thread_${threadId}`;
  // Dùng Redis lock với thời gian hết hạn 5 phút
  const lock = await redisConnection.set(lockKey, "locked", {
    NX: true,
    EX: 300
  });
  
  if (!lock) {
    console.log(`⚠️ Thread ${threadId} is already being processed.`);
    return;
  }
  
  try {
    // Gom nhóm các message từ các job và sắp xếp theo timestamp
    jobs.sort((a, b) => a.data.timestamp - b.data.timestamp);
    const messages = jobs.map(job => job.data.message);
    const combinedMessage = messages.join("\n");
    
    console.log(`🚀 Processing ${messages.length} messages for thread ${threadId}...`);
    
    // Gửi message đã gom vào OpenAI
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: combinedMessage,
    });
    
    // Gọi OpenAI để thực hiện run cho thread
    console.log("🔄 Calling OpenAI API...");
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: "your-assistant-id",
      instructions: "Trả lời tất cả các tin nhắn một cách logic.",
    });
    
    await waitForRunCompletion(threadId, run.id);
    console.log(`✅ OpenAI đã trả lời xong cho thread ${threadId}`);
    
    // Lấy tất cả jobIds để xóa khỏi index
    const jobIds = jobs.map(job => job.id);
    
    // Xóa jobs khỏi queue
    await Promise.all(jobs.map(job => job.remove()));
    
    // Xóa jobIds khỏi index
    await removeJobsFromThreadIndex(threadId, jobIds);
    
  } catch (error) {
    console.error(`❌ Lỗi khi xử lý thread ${threadId}:`, error);
    // Trong trường hợp lỗi, ta có thể quyết định có nên thử lại hay không
    // Ở đây, ta để cho jobs thử lại tự động theo cấu hình retry
  } finally {
    await redisConnection.del(lockKey);
  }
}

/**
 * Worker của BullMQ: Khi một job được kích hoạt, kiểm tra xem nó có phải job cũ nhất chưa xử lý không
 * Nếu có, lấy tất cả job có cùng threadId rồi xử lý chung
 */
const worker = new Worker("messageQueue", async (job) => {
  const { threadId, timestamp } = job.data;
  const jobId = job.id;
  
  // Lấy các job có cùng threadId
  const relatedJobs = await getJobsByThreadId(threadId);
  if (relatedJobs.length === 0) return;
  
  // Sắp xếp jobs theo timestamp để tìm job cũ nhất
  relatedJobs.sort((a, b) => a.data.timestamp - b.data.timestamp);
  
  // Chỉ xử lý nếu job hiện tại là job cũ nhất (hoặc cùng lô với job cũ nhất)
  if (relatedJobs[0].id !== jobId) {
    console.log(`⏭️ Bỏ qua job ${jobId}, không phải job cũ nhất của thread ${threadId}`);
    return;
  }
  
  await processMessages(threadId, relatedJobs);
}, {
  connection: redisConnection,
  lockDuration: 30000,
});

console.log("👷 Worker is running...");

// app.js
import { addMessageToThread } from "./queue.js";

async function main() {
  try {
    console.log("=== Test 1: Sequential messages in same thread ===");
    await testSequentialMessages();
    
    // Exit after tests complete
    setTimeout(() => {
      console.log("Tests completed, exiting process");
      process.exit(0);
    }, 60000);
  } catch (error) {
    console.error("Test failed with error:", error);
    process.exit(1);
  }
}

async function testSequentialMessages() {
  const startTime = Date.now();
  
  // Thêm các tin nhắn vào thread "thread-123"
  await addMessageToThread("thread-123", "Tin nhắn 1");
  await addMessageToThread("thread-123", "Tin nhắn 2");
  await addMessageToThread("thread-123", "Tin nhắn 3");
  console.log(`Batch 1 added in ${Date.now() - startTime}ms`);
  
  // Sau 11 giây (sau khi delay job 10 giây hết hạn), worker sẽ xử lý batch 1
  // Sau đó, thêm thêm các tin nhắn mới vào cùng thread
  setTimeout(async () => {
    const batchTime = Date.now();
    await addMessageToThread("thread-123", "Tin nhắn 4");
    await addMessageToThread("thread-123", "Tin nhắn 5");
    console.log(`Batch 2 added in ${Date.now() - batchTime}ms`);
    
    // Thêm thêm tin nhắn sau 3 giây nữa
    setTimeout(async () => {
      const finalTime = Date.now();
      await addMessageToThread("thread-123", "Tin nhắn 6");
      console.log(`Final message added in ${Date.now() - finalTime}ms`);
    }, 3000);
  }, 11000);
}

main();