
const { VERCEL_ENV, VERCEL_GIT_COMMIT_REF, TELEGRAM_BOT_TOKEN, TELEGRAM_PRICE_ALERT_CHAT_ID } = process.env;

async function verifyTelegram() {
  if (VERCEL_ENV !== "preview" || VERCEL_GIT_COMMIT_REF !== "codex/hermes-integration-recovery") return;
  if (Date.now() > 1794441117757) return;
  if (!TELEGRAM_BOT_TOKEN || !/^\d+$/.test(TELEGRAM_PRICE_ALERT_CHAT_ID ?? "")) throw new Error("configuration");

  async function request(method, body) {
    const response = await fetch("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/" + method, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(method + "_" + response.status);
    const data = await response.json();
    if (!data.ok) throw new Error(method + "_rejected");
    return data.result;
  }

  const bot = await request("getMe", {});
  if (!bot.is_bot || bot.username?.toLowerCase() !== "danielgtpbot") throw new Error("wrong_bot");
  const chat = await request("getChat", { chat_id: TELEGRAM_PRICE_ALERT_CHAT_ID });
  if (chat.type !== "private" || String(chat.id) !== TELEGRAM_PRICE_ALERT_CHAT_ID) throw new Error("wrong_chat");
  console.log("hermes_telegram_destination_verified");
  console.log("hermes_telegram_single_send_started");
  const message = await request("sendMessage", {
    chat_id: TELEGRAM_PRICE_ALERT_CHAT_ID,
    text: "Prueba de conexión de Hermes · token renovado",
    disable_notification: true,
  });
  if (message.chat?.type !== "private" || String(message.chat.id) !== TELEGRAM_PRICE_ALERT_CHAT_ID || !Number.isSafeInteger(message.message_id)) throw new Error("delivery_unverified");
  console.log("hermes_telegram_delivery_verified");
}

try {
  await verifyTelegram();
} catch (error) {
  const known = /^(configuration|wrong_bot|wrong_chat|delivery_unverified|(getMe|getChat|sendMessage)_(\d{3}|rejected))$/.test(error.message);
  console.error("hermes_telegram_verification_incomplete " + (known ? error.message : "network_or_response"));
  process.exitCode = 1;
}
