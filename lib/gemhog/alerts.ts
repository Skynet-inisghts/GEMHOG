/**
 * Telegram alerts for hunt --follow. One plain POST, no libraries, and the
 * only external write this repository makes anywhere — sent exclusively when
 * the user has put their own bot token and chat id in .env. Both empty means
 * alerts are off and nothing is ever posted.
 * Pattern adapted from novamp (MIT) — https://github.com/bored2boar/novamp
 */

export const alertsConfigured = (): boolean =>
  Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim());

export async function sendAlert(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
