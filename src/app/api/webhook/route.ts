import { NextRequest, NextResponse } from 'next/server';
import { 
  sendMessage, 
  deleteMessage, 
  checkChannelMembership, 
  sendSubscriptionRequired,
  sendPaidPhoto,
  sendPaidAudio,
  sendPaidVideo,
  sendPhotoWithButton,
  sendErrorMessage,
  notifyAdminError,
  getUserLanguage,
  formatCaption,
  parseHtmlContent,
  isAdmin,
  getAdminUserId,
  answerPreCheckoutQuery,
} from '@/lib/telegram';
import { 
  saveUser, 
  incrementDailyStat, 
  getAllUserIds, 
  getUsersByLanguage,
  UserData,
  isConfigured as isRedisConfigured,
} from '@/lib/redis';

import photos from '@/data/photo.json';
import videos from '@/data/video.json';
import audioEn from '@/data/audioEn.json';
import audioEs from '@/data/audioEs.json';
import audioIt from '@/data/audioIt.json';
import captionEn from '@/data/captionEn.json';
import captionEs from '@/data/captionEs.json';
import captionIt from '@/data/captionIt.json';
import startMessages from '@/data/start.json';
import advData from '@/data/adv.json';
import prices from '@/data/prices.json';

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: { id: number; type: string };
  text?: string;
  successful_payment?: {
    currency: string;
    total_amount: number;
    invoice_payload: string;
  };
}

interface TelegramPreCheckoutQuery {
  id: string;
  from: TelegramUser;
  currency: string;
  total_amount: number;
  invoice_payload: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  pre_checkout_query?: TelegramPreCheckoutQuery;
}

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getCaption(lang: 'it' | 'es' | 'en'): string {
  switch (lang) {
    case 'it': return getRandomItem(captionIt);
    case 'es': return getRandomItem(captionEs);
    default: return getRandomItem(captionEn);
  }
}

function getAudio(lang: 'it' | 'es' | 'en'): string {
  switch (lang) {
    case 'it': return getRandomItem(audioIt);
    case 'es': return getRandomItem(audioEs);
    default: return getRandomItem(audioEn);
  }
}

const pendingDeletions = new Map<string, NodeJS.Timeout>();

function scheduleMessageDeletion(chatId: number, messageId: number, delayMinutes: number = 60): void {
  const key = `${chatId}:${messageId}`;
  
  if (pendingDeletions.has(key)) {
    clearTimeout(pendingDeletions.get(key));
  }
  
  const timeout = setTimeout(async () => {
    try {
      await deleteMessage(chatId, messageId);
      pendingDeletions.delete(key);
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  }, delayMinutes * 60 * 1000);
  
  pendingDeletions.set(key, timeout);
}

async function handleStartCommand(chatId: number, lang: 'it' | 'es' | 'en', userIsAdmin: boolean): Promise<void> {
  const startMessage = startMessages[lang] || startMessages.en;
  await sendMessage(chatId, startMessage);
  
  if (userIsAdmin) {
    const adminInfo = `
<b>👑 Admin Commands:</b>

<b>Broadcast Messages:</b>
• <code>!toEveryone!</code> - Send to all users
• <code>!toEveryIt!</code> - Send to Italian users
• <code>!toEveryEs!</code> - Send to Spanish users
• <code>!toEveryEn!</code> - Send to other users

<b>Advertisement:</b>
• <code>/sendadv</code> - Send ad to all users
• <code>/testadv</code> - Test ad (send only to you)

<b>Example:</b>
<code>!toEveryone! Hello everyone!</code>

<b>Prices:</b>
• Photo: ${prices.photo} ⭐
• Audio: ${prices.audio} ⭐
• Video: ${prices.video} ⭐

<b>Database Status:</b> ${isRedisConfigured() ? '✅ Connected' : '❌ Not configured'}
`;
    await sendMessage(chatId, adminInfo);
  }
}

async function handleBroadcast(
  adminChatId: number, 
  messageText: string, 
  targetType: 'all' | 'it' | 'es' | 'en'
): Promise<void> {
  if (!isRedisConfigured()) {
    await sendMessage(adminChatId, '❌ Database not configured. Cannot send broadcast.\n\nPlease configure KV_REST_API_URL and KV_REST_API_TOKEN environment variables.');
    return;
  }

  let userIds: number[] = [];
  let targetLabel = '';
  
  switch (targetType) {
    case 'all':
      userIds = await getAllUserIds();
      targetLabel = 'all chats';
      break;
    case 'it':
      userIds = await getUsersByLanguage('it');
      targetLabel = 'Italian chats';
      break;
    case 'es':
      userIds = await getUsersByLanguage('es');
      targetLabel = 'Spanish chats';
      break;
    case 'en':
      const allIds = await getAllUserIds();
      const itIds = await getUsersByLanguage('it');
      const esIds = await getUsersByLanguage('es');
      const excludeSet = new Set([...itIds, ...esIds]);
      userIds = allIds.filter(id => !excludeSet.has(id));
      targetLabel = 'English/other chats';
      break;
  }
  
  let successCount = 0;
  let failCount = 0;
  
  for (const userId of userIds) {
    if (userId === adminChatId) continue;
    
    try {
      await sendMessage(userId, messageText);
      successCount++;
    } catch {
      failCount++;
    }
  }
  
  const report = `Message sent to ${targetLabel}:
✔️ Successfully sent to ${successCount} chats
❌ Failed for ${failCount} chats`;
  
  await sendMessage(adminChatId, report);
}

async function handleSendAdv(adminChatId: number, testOnly: boolean = false): Promise<void> {
  if (!testOnly && !isRedisConfigured()) {
    await sendMessage(adminChatId, '❌ Database not configured. Cannot send advertisement to all users.\n\nPlease configure KV_REST_API_URL and KV_REST_API_TOKEN environment variables.');
    return;
  }

  const userIds = testOnly ? [adminChatId] : await getAllUserIds();
  let successCount = 0;
  let failCount = 0;
  
  for (const userId of userIds) {
    try {
      const lang = 'en';
      const advLang = advData.languages[lang as keyof typeof advData.languages] || advData.languages.en;
      
      await sendPhotoWithButton(
        userId,
        advLang.file_id,
        parseHtmlContent(advLang.caption),
        advLang.cta,
        advData.url
      );
      successCount++;
    } catch {
      failCount++;
    }
  }
  
  if (!testOnly) {
    const report = `Advertisement sent:
✔️ Successfully sent to ${successCount} chats
❌ Failed for ${failCount} chats`;
    await sendMessage(adminChatId, report);
  }
}

async function handleContentRequest(
  chatId: number, 
  messageText: string, 
  lang: 'it' | 'es' | 'en',
  firstName: string | undefined,
  userIsAdmin: boolean
): Promise<void> {
  const lowerText = messageText.toLowerCase();
  
  try {
    if (lowerText.includes('audio')) {
      const audioFileId = getAudio(lang);
      const result = await sendPaidAudio(chatId, audioFileId, userIsAdmin, lang);
      
      if (result.ok && result.result && !userIsAdmin) {
        scheduleMessageDeletion(chatId, result.result.message_id);
      }
    } else if (lowerText.includes('video')) {
      const videoFileId = getRandomItem(videos);
      const caption = formatCaption(getCaption(lang), firstName);
      const result = await sendPaidVideo(chatId, videoFileId, caption, userIsAdmin);
      
      if (result.ok && result.result && !userIsAdmin) {
        scheduleMessageDeletion(chatId, result.result.message_id);
      }
    } else {
      const photoFileId = getRandomItem(photos);
      const caption = formatCaption(getCaption(lang), firstName);
      const result = await sendPaidPhoto(chatId, photoFileId, caption, userIsAdmin);
      
      if (result.ok && result.result && !userIsAdmin) {
        scheduleMessageDeletion(chatId, result.result.message_id);
      }
    }
  } catch (error) {
    console.error('Error sending content:', error);
    await sendErrorMessage(chatId, lang);
    await notifyAdminError('Failed to send content', { chatId, messageText, error: String(error) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();
    
    if (update.pre_checkout_query) {
      await answerPreCheckoutQuery(update.pre_checkout_query.id, true);
      return NextResponse.json({ ok: true });
    }
    
    if (!update.message) {
      return NextResponse.json({ ok: true });
    }
    
    const message = update.message;
    const chatId = message.chat.id;
    const userId = message.from.id;
    const messageText = message.text || '';
    const lang = getUserLanguage(message.from.language_code);
    const firstName = message.from.first_name;
    const userIsAdmin = isAdmin(userId);
    
    if (message.successful_payment) {
      const amount = message.successful_payment.total_amount;
      console.log(`Payment received: ${amount} stars from user ${userId}`);
      if (isRedisConfigured()) {
        try {
          await incrementDailyStat('starsEarned', amount);
        } catch (error) {
          console.error('Failed to record payment in stats:', error);
        }
      }
      return NextResponse.json({ ok: true });
    }
    
    if (isRedisConfigured()) {
      try {
        await incrementDailyStat('interactions');
        
        const userData: UserData = {
          id: userId,
          username: message.from.username,
          firstName: message.from.first_name,
          lastName: message.from.last_name,
          languageCode: lang,
          startedAt: '',
          lastActiveAt: '',
        };
        await saveUser(userData);
      } catch (error) {
        console.error('Failed to save user/interaction:', error);
      }
    }
    
    const waitingMsg = await sendMessage(chatId, '💬') as { ok: boolean; result?: { message_id: number } };
    
    try {
      const isStartOrInfo = messageText.startsWith('/start') || messageText.startsWith('/info');
      const isAdminCommand = userIsAdmin && (
        messageText.startsWith('!toEveryone!') ||
        messageText.startsWith('!toEveryIt!') ||
        messageText.startsWith('!toEveryEs!') ||
        messageText.startsWith('!toEveryEn!') ||
        messageText === '/sendadv' ||
        messageText === '/testadv'
      );
      
      if (!userIsAdmin && !isStartOrInfo) {
        const isMember = await checkChannelMembership(userId);
        if (!isMember) {
          await sendSubscriptionRequired(chatId, lang);
          if (waitingMsg.ok && waitingMsg.result) {
            await deleteMessage(chatId, waitingMsg.result.message_id);
          }
          return NextResponse.json({ ok: true });
        }
      }
      
      if (isStartOrInfo) {
        await handleStartCommand(chatId, lang, userIsAdmin);
      } else if (userIsAdmin && messageText.startsWith('!toEveryone!')) {
        const broadcastText = messageText.replace('!toEveryone!', '').trim();
        await handleBroadcast(chatId, broadcastText, 'all');
      } else if (userIsAdmin && messageText.startsWith('!toEveryIt!')) {
        const broadcastText = messageText.replace('!toEveryIt!', '').trim();
        await handleBroadcast(chatId, broadcastText, 'it');
      } else if (userIsAdmin && messageText.startsWith('!toEveryEs!')) {
        const broadcastText = messageText.replace('!toEveryEs!', '').trim();
        await handleBroadcast(chatId, broadcastText, 'es');
      } else if (userIsAdmin && messageText.startsWith('!toEveryEn!')) {
        const broadcastText = messageText.replace('!toEveryEn!', '').trim();
        await handleBroadcast(chatId, broadcastText, 'en');
      } else if (userIsAdmin && messageText === '/sendadv') {
        await handleSendAdv(chatId, false);
      } else if (userIsAdmin && messageText === '/testadv') {
        await handleSendAdv(chatId, true);
      } else if (!isAdminCommand) {
        await handleContentRequest(chatId, messageText, lang, firstName, userIsAdmin);
      }
    } finally {
      if (waitingMsg.ok && waitingMsg.result) {
        try {
          await deleteMessage(chatId, waitingMsg.result.message_id);
        } catch {
        }
      }
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'Bot webhook is active',
    database: isRedisConfigured() ? 'connected' : 'not configured',
  });
}
