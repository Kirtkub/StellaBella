const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHANNEL_ID = -1001898840240;
const CHANNEL_LINK = 'https://t.me/+onqHnd30AFA5ZDVk';

import prices from '@/data/prices.json';
import adminData from '@/data/adminUserId.json';
import captionEn from '@/data/captionEn.json';
import captionEs from '@/data/captionEs.json';
import captionIt from '@/data/captionIt.json';

export function getAdminUserId(): number {
  return process.env.ADMIN_USER_ID ? parseInt(process.env.ADMIN_USER_ID, 10) : adminData.adminUserId;
}

export function isAdmin(userId: number): boolean {
  return userId === getAdminUserId();
}

export function getUserLanguage(languageCode?: string): 'it' | 'es' | 'en' {
  if (languageCode === 'it') return 'it';
  if (languageCode === 'es') return 'es';
  return 'en';
}

export function formatCaption(caption: string, firstName?: string): string {
  if (firstName) {
    return `${firstName}, ${caption.charAt(0).toLowerCase()}${caption.slice(1)}`;
  }
  return caption.charAt(0).toUpperCase() + caption.slice(1);
}

export function parseHtmlContent(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\/n/g, '\n');
}

function getRandomCaption(lang: 'it' | 'es' | 'en'): string {
  const captions = lang === 'it' ? captionIt : lang === 'es' ? captionEs : captionEn;
  return captions[Math.floor(Math.random() * captions.length)];
}

async function telegramRequest(method: string, body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`${TELEGRAM_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  const result = await response.json();
  if (!result.ok) {
    console.error(`Telegram API error (${method}):`, result);
  }
  return result;
}

export async function sendMessage(chatId: number, text: string, options: Record<string, unknown> = {}): Promise<unknown> {
  return telegramRequest('sendMessage', {
    chat_id: chatId,
    text: parseHtmlContent(text),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...options,
  });
}

export async function deleteMessage(chatId: number, messageId: number): Promise<unknown> {
  return telegramRequest('deleteMessage', {
    chat_id: chatId,
    message_id: messageId,
  });
}

export async function answerPreCheckoutQuery(preCheckoutQueryId: string, ok: boolean, errorMessage?: string): Promise<unknown> {
  return telegramRequest('answerPreCheckoutQuery', {
    pre_checkout_query_id: preCheckoutQueryId,
    ok,
    error_message: errorMessage,
  });
}

export async function checkChannelMembership(userId: number): Promise<boolean> {
  try {
    const result = await telegramRequest('getChatMember', {
      chat_id: CHANNEL_ID,
      user_id: userId,
    }) as { ok: boolean; result?: { status: string } };
    
    if (result.ok && result.result) {
      const status = result.result.status;
      return ['member', 'administrator', 'creator'].includes(status);
    }
    return false;
  } catch {
    return false;
  }
}

export async function sendSubscriptionRequired(chatId: number, lang: 'it' | 'es' | 'en'): Promise<unknown> {
  const messages = {
    it: `⚠💋 Per giocare con me, devi essere iscritto al canale ufficiale di Cleo e Leo:
✨ Iscriviti subito cliccando il bottone qui sotto👇🏻

⚠🔞 Attenzione, cliccando il bottone per iscriverti al canale dichiari di essere maggiorenne. I contenuti del canale di Cleo e Leo, e quelli che ti verranno inviati attraverso questo bot sono contenuti erotici, esclusivamente per un pubblico adulto.`,
    es: `⚠💋 Para jugar conmigo, debes estar suscrito al canal oficial de Cleo y Leo:
✨ ¡Suscríbete ahora haciendo clic en el botón de abajo👇🏻

⚠🔞 Atención, al hacer clic en el botón para suscribirte al canal declaras ser mayor de edad. Los contenidos del canal de Cleo y Leo, y los que te serán enviados a través de este bot son contenidos eróticos, exclusivamente para un público adulto.`,
    en: `⚠💋 To play with me, you must be subscribed to the official Cleo and Leo channel:
✨ Subscribe now by clicking the button below👇🏻

⚠🔞 Warning, by clicking the button to subscribe to the channel you declare that you are of legal age. The contents of the Cleo and Leo channel, and those that will be sent to you through this bot are erotic content, exclusively for an adult audience.`,
  };

  return sendMessage(chatId, messages[lang], {
    reply_markup: {
      inline_keyboard: [[
        { text: '✨ Accedi al Canale 🔞', url: CHANNEL_LINK }
      ]]
    }
  });
}

export async function sendPaidPhoto(
  chatId: number, 
  fileId: string, 
  caption: string, 
  userIsAdmin: boolean
): Promise<{ ok: boolean; result?: { message_id: number } }> {

  if (userIsAdmin) {
    return telegramRequest('sendPhoto', {
      chat_id: chatId,
      photo: fileId,
      caption: parseHtmlContent(caption),
      parse_mode: 'HTML',
      protect_content: true
    }) as Promise<{ ok: boolean; result?: { message_id: number } }>;
  }
  
  return telegramRequest('sendPaidMedia', {
    chat_id: chatId,
    star_count: prices.photo,
    media: [{
      type: 'photo',
      media: fileId,
    }],
    caption: parseHtmlContent(caption),
    parse_mode: 'HTML',
    payload: `photo_${chatId}_${Date.now()}`,
    protect_content: true
  }) as Promise<{ ok: boolean; result?: { message_id: number } }>;
}

export async function sendPaidAudio(
  chatId: number, 
  fileId: string, 
  userIsAdmin: boolean,
  lang: 'it' | 'es' | 'en' = 'en'
): Promise<{ ok: boolean; result?: { message_id: number } }> {

  const caption = getRandomCaption(lang);
  
  if (userIsAdmin) {
    return telegramRequest('sendAudio', {
      chat_id: chatId,
      audio: fileId,
      caption: parseHtmlContent(caption),
      parse_mode: 'HTML',
      protect_content: true
    }) as Promise<{ ok: boolean; result?: { message_id: number } }>;
  }
  
  return telegramRequest('sendPaidMedia', {
    chat_id: chatId,
    star_count: prices.audio,
    media: [{
      type: 'audio',
      media: fileId,
    }],
    caption: parseHtmlContent(caption),
    parse_mode: 'HTML',
    payload: `audio_${chatId}_${Date.now()}`,
    protect_content: true
  }) as Promise<{ ok: boolean; result?: { message_id: number } }>;
}

export async function sendPaidVideo(
  chatId: number, 
  fileId: string, 
  caption: string, 
  userIsAdmin: boolean
): Promise<{ ok: boolean; result?: { message_id: number } }> {

  if (userIsAdmin) {
    return telegramRequest('sendVideo', {
      chat_id: chatId,
      video: fileId,
      caption: parseHtmlContent(caption),
      parse_mode: 'HTML',
      protect_content: true
    }) as Promise<{ ok: boolean; result?: { message_id: number } }>;
  }
  
  return telegramRequest('sendPaidMedia', {
    chat_id: chatId,
    star_count: prices.video,
    media: [{
      type: 'video',
      media: fileId,
    }],
    caption: parseHtmlContent(caption),
    parse_mode: 'HTML',
    payload: `video_${chatId}_${Date.now()}`,
    protect_content: true
  }) as Promise<{ ok: boolean; result?: { message_id: number } }>;
}

export async function sendPhotoWithButton(
  chatId: number,
  fileId: string,
  caption: string,
  buttonText: string,
  buttonUrl: string
): Promise<unknown> {
  return telegramRequest('sendPhoto', {
    chat_id: chatId,
    photo: fileId,
    caption: parseHtmlContent(caption),
    parse_mode: 'HTML',
    protect_content: true,
    reply_markup: {
      inline_keyboard: [[
        { text: buttonText, url: buttonUrl }
      ]]
    }
  });
}

export async function sendErrorMessage(chatId: number, lang: 'it' | 'es' | 'en'): Promise<unknown> {
  const messages = {
    it: "Mi dispiace, c'è stato un errore. Prova più tardi o contatta Cleo e Leo:",
    es: "Lo siento, hubo un error. Inténtalo más tarde o contacta a Cleo y Leo:",
    en: "I'm sorry, there was an error. Try again later or contact Cleo and Leo:",
  };

  return sendMessage(chatId, messages[lang], {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔗 OnlyFans', url: 'https://onlyfans.com/cleoyleo' }],
        [{ text: '📱 Telegram', url: CHANNEL_LINK }]
      ]
    }
  });
}

export async function notifyAdminError(error: string, context: Record<string, unknown>): Promise<void> {
  const adminId = getAdminUserId();
  const message = `🚨 <b>Error Report</b>\n\n<b>Error:</b> ${error}\n\n<b>Context:</b>\n<code>${JSON.stringify(context, null, 2)}</code>`;
  
  try {
    await sendMessage(adminId, message);
  } catch (e) {
    console.error('Failed to notify admin:', e);
  }
}

export { CHANNEL_LINK };
