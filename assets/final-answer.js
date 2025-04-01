// worker.js (phần code liên quan đến việc xử lý job)
const worker = new Worker("messageQueue", async (job) => {
  const { threadId, timestamp } = job.data;
  const jobId = job.id;

  // Lấy các job có cùng threadId
  const relatedJobs = await getJobsByThreadId(threadId);
  if (relatedJobs.length === 0) return;

  // Sắp xếp jobs theo timestamp để tìm job cũ nhất
  relatedJobs.sort((a, b) => a.data.timestamp - b.data.timestamp);

  // Kiểm tra xem thread có đang bị khóa không
  const lockKey = `lock_thread_${threadId}`;
  const isLocked = await redisConnection.exists(lockKey);

  // Nếu thread đang bị khóa, đưa job vào trạng thái delay để retry sau
  if (isLocked) {
    console.log(`⏳ Thread ${threadId} đang bị khóa, đặt lại job ${jobId} để xử lý sau`);
    // Delay job thêm 5 giây nữa để thử lại
    await job.moveToDelayed(Date.now() + 5000);
    return;
  }

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

// Hàm xử lý tất cả message của một thread.
async function processMessages(threadId, jobs) {
  const lockKey = `lock_thread_${threadId}`;
  // Dùng Redis lock với thời gian hết hạn 5 phút và lưu timestamp bắt đầu xử lý
  const processingTimestamp = Date.now();
  const lockValue = processingTimestamp.toString();

  const lock = await redisConnection.set(lockKey, lockValue, {
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

    // Lưu lại timestamp lớn nhất đã xử lý trong batch này
    const maxTimestamp = Math.max(...jobs.map(job => job.data.timestamp));
    await redisConnection.set(`last_processed_${threadId}`, maxTimestamp.toString());

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

    // Kiểm tra xem có jobs mới được thêm vào trong quá trình xử lý không
    const newerJobs = await getNewerJobsByThreadId(threadId, maxTimestamp);
    if (newerJobs.length > 0) {
      console.log(`📣 Phát hiện ${newerJobs.length} tin nhắn mới cho thread ${threadId}, kích hoạt xử lý`);
      // Lấy job đầu tiên trong danh sách jobs mới và đưa về trạng thái active ngay lập tức
      // để bắt đầu chu trình xử lý mới
      if (newerJobs.length > 0) {
        await newerJobs[0].moveToActive();
      }
    }

  } catch (error) {
    console.error(`❌ Lỗi khi xử lý thread ${threadId}:`, error);
  } finally {
    // Chỉ xóa lock nếu giá trị lock vẫn là giá trị ban đầu (tránh xóa lock của process khác)
    const currentLock = await redisConnection.get(lockKey);
    if (currentLock === lockValue) {
      await redisConnection.del(lockKey);
    }
  }
}

// Thêm hàm để lấy các job mới hơn timestamp đã cho
export async function getNewerJobsByThreadId(threadId, timestamp) {
  // Lấy jobIds từ Set của thread
  const jobIds = await redisConnection.sMembers(`bull:threadJobs:${threadId}`);

  // Nếu không có job nào, trả về mảng rỗng
  if (!jobIds || jobIds.length === 0) {
    return [];
  }

  // Lấy tất cả jobs
  const allJobs = await Promise.all(
    jobIds.map(id => messageQueue.getJob(id))
  );

  // Lọc ra các jobs có timestamp lớn hơn timestamp đã cho
  const newerJobs = allJobs
    .filter(Boolean)
    .filter(job => job.data.timestamp > timestamp)
    .sort((a, b) => a.data.timestamp - b.data.timestamp);

  return newerJobs;
}