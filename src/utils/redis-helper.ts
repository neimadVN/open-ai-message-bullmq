import { createClient, RedisClientType } from 'redis';

/**
 * Creates and connects to a Redis client
 * 
 * @param redisUrl Redis connection URL
 * @returns Connected Redis client
 */
export async function createAndConnectRedisClient(redisUrl: string): Promise<RedisClientType> {
  const client = createClient({ url: redisUrl });
  
  if (!client.isOpen) {
    await client.connect();
  }
  
  return client;
}

/**
 * Creates a lock in Redis
 * 
 * @param client Redis client
 * @param lockKey Lock key
 * @param lockValue Lock value
 * @param expiryInSeconds Lock expiry in seconds
 * @returns Whether the lock was acquired
 */
export async function acquireLock(
  client: RedisClientType,
  lockKey: string,
  lockValue: string,
  expiryInSeconds: number
): Promise<boolean> {
  return client.set(lockKey, lockValue, {
    NX: true,
    EX: expiryInSeconds
  }) as Promise<boolean>;
}

/**
 * Releases a lock in Redis, only if the lock value matches
 * 
 * @param client Redis client
 * @param lockKey Lock key
 * @param lockValue Expected lock value
 * @returns Whether the lock was released
 */
export async function releaseLock(
  client: RedisClientType,
  lockKey: string,
  lockValue: string
): Promise<boolean> {
  // Only release the lock if it's still the same value
  const currentLock = await client.get(lockKey);
  
  if (currentLock === lockValue) {
    await client.del(lockKey);
    return true;
  }
  
  return false;
}

/**
 * Checks if a lock exists
 * 
 * @param client Redis client
 * @param lockKey Lock key
 * @returns Whether the lock exists
 */
export async function lockExists(client: RedisClientType, lockKey: string): Promise<boolean> {
  return (await client.exists(lockKey)) > 0;
} 