
async function telegramPreviewTest(env, fetchTelegram, log) {
  if (env.VERCEL_ENV !== "preview" || env.VERCEL_GIT_COMMIT_REF !== "codex/hermes-integration-recovery") {
    log("hermes_telegram_preview_skipped");
    return;
  }
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_PRICE_ALERT_CHAT_ID;
  if (!token || !/^\d+$/.test(chatId ?? "")) throw new Error("configuration");
  const request = async (method, body) => {
    const response = await fetchTelegram("https://api.telegram.org/bot" + token + "/" + method, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(method + "_" + response.status);
    return data.result;
  };
  const bot = await request("getMe", {});
  if (!bot.is_bot || bot.username?.toLowerCase() !== "danielgtpbot") throw new Error("wrong_bot");
  const chat = await request("getChat", { chat_id: chatId });
  if (chat.type !== "private" || String(chat.id) !== chatId) throw new Error("wrong_chat");
  log("hermes_telegram_destination_verified");
  log("hermes_telegram_single_send_started");
  const message = await request("sendMessage", {
    chat_id: chatId,
    text: "Prueba de conexión de Hermes · entorno de pruebas",
    disable_notification: true,
  });
  if (message.chat?.type !== "private" || String(message.chat.id) !== chatId || !Number.isSafeInteger(message.message_id)) {
    throw new Error("delivery_unverified");
  }
  log("hermes_telegram_delivery_verified");
}

if (Date.now() <= 1794439454887) {
  telegramPreviewTest(process.env, fetch, console.log).catch((error) => {
    const known = /^(configuration|wrong_bot|wrong_chat|delivery_unverified|(getMe|getChat|sendMessage)_\d{3})$/.test(error.message);
    console.error("hermes_telegram_verification_incomplete " + (known ? error.message : "network_or_response"));
    process.exitCode = 1;
  });
} else {
  console.log("hermes_telegram_preview_check_expired");
}
