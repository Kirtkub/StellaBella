import { Redis } from '@upstash/redis';

const isRedisConfigured = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

let redis: Redis | null = null;

if (isRedisConfigured) {
  redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}

export class RedisNotConfiguredError extends Error {
  constructor() {
    super('Redis is not configured. Please set KV_REST_API_URL and KV_REST_API_TOKEN environment variables.');
    this.name = 'RedisNotConfiguredError';
  }
}

function ensureRedis(): Redis {
  if (!redis) {
    throw new RedisNotConfiguredError();
  }
  return redis;
}

export interface UserData {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode: string;
  startedAt: string;
  lastActiveAt: string;
}

export interface DailyStats {
  date: string;
  newUsers: number;
  interactions: number;
  starsEarned: number;
}

export async function saveUser(user: UserData): Promise<void> {
  const r = ensureRedis();
  
  const key = `user:${user.id}`;
  const existingUser = await r.get<UserData>(key);
  
  if (!existingUser) {
    user.startedAt = new Date().toISOString();
    await r.sadd('users:all', user.id.toString());
    await r.sadd(`users:lang:${user.languageCode}`, user.id.toString());
    await incrementDailyStat('newUsers');
  }
  
  user.lastActiveAt = new Date().toISOString();
  await r.set(key, user);
}

export async function getUser(userId: number): Promise<UserData | null> {
  const r = ensureRedis();
  return r.get<UserData>(`user:${userId}`);
}

export async function getAllUsers(): Promise<UserData[]> {
  const r = ensureRedis();
  
  const userIds = await r.smembers('users:all');
  const users: UserData[] = [];
  
  for (const id of userIds) {
    const user = await r.get<UserData>(`user:${id}`);
    if (user) {
      users.push(user);
    }
  }
  
  return users;
}

export async function getUsersByLanguage(lang: string): Promise<number[]> {
  const r = ensureRedis();
  const userIds = await r.smembers(`users:lang:${lang}`);
  return userIds.map(id => parseInt(id, 10));
}

export async function getAllUserIds(): Promise<number[]> {
  const r = ensureRedis();
  const userIds = await r.smembers('users:all');
  return userIds.map(id => parseInt(id, 10));
}

function getMadridDate(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

export async function incrementDailyStat(field: 'newUsers' | 'interactions' | 'starsEarned', amount: number = 1): Promise<void> {
  const r = ensureRedis();
  const date = getMadridDate();
  const key = `stats:daily:${date}`;
  await r.hincrby(key, field, amount);
}

export async function getDailyStats(date: string): Promise<DailyStats> {
  const r = ensureRedis();
  
  const key = `stats:daily:${date}`;
  const stats = await r.hgetall<{ newUsers?: string; interactions?: string; starsEarned?: string }>(key);
  
  return {
    date,
    newUsers: parseInt(stats?.newUsers || '0', 10),
    interactions: parseInt(stats?.interactions || '0', 10),
    starsEarned: parseInt(stats?.starsEarned || '0', 10),
  };
}

export async function getStatsForPeriod(days: number): Promise<DailyStats[]> {
  const stats: DailyStats[] = [];
  const now = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dailyStats = await getDailyStats(dateStr);
    stats.push(dailyStats);
  }
  
  return stats.reverse();
}

export async function getTotalStats(): Promise<{ totalUsers: number; totalInteractions: number; totalStars: number }> {
  const r = ensureRedis();
  
  const userIds = await r.smembers('users:all');
  const totalUsers = userIds.length;
  
  let totalInteractions = 0;
  let totalStars = 0;
  
  const keys = await r.keys('stats:daily:*');
  for (const key of keys) {
    const stats = await r.hgetall<{ interactions?: string; starsEarned?: string }>(key);
    totalInteractions += parseInt(stats?.interactions || '0', 10);
    totalStars += parseInt(stats?.starsEarned || '0', 10);
  }
  
  return { totalUsers, totalInteractions, totalStars };
}

export function isConfigured(): boolean {
  return isRedisConfigured;
}

export default redis;
