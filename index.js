const fs = require('fs');
const path = require('path');
const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const config = require('./config');
const { ServerMonitor } = require('./services/serverMonitor');
const { COMMAND_GROUP_REJECTION_MESSAGE } = require('./utils/commandAccess');
const { isGroupJid, normalizeJid } = require('./utils/jids');
const { formatRunError, runRailwayCommand } = require('./utils/railwaySsh');

const MAX_REPLY_LENGTH = 3000;
const LAG_KEYWORD_PATTERN = /\b(?:server\s+lag|ngelag|lag|patah|delay|lemot)\b/i;

const logger = pino({ level: config.logLevel });
const startedAt = new Date();
const commands = loadCommands();
const cooldown = createAutoRestartCooldown();

startBot().catch((error) => {
  console.error(`[${config.botName}] Fatal startup error: ${error.message}`);
  process.exitCode = 1;
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(config.waAuthDir);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: false,
    version
  });
  const monitor = new ServerMonitor(sock, config);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log(`[${config.botName}] Scan this QR code with WhatsApp:`);
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log(`[${config.botName}] WhatsApp connected.`);
      monitor.start();
    }

    if (connection === 'close') {
      monitor.stop('WhatsApp disconnected');
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.error(
        `[${config.botName}] WhatsApp disconnected. Reason=${statusCode || 'unknown'} reconnect=${shouldReconnect}`
      );

      if (shouldReconnect) {
        setTimeout(() => {
          startBot().catch((error) => {
            console.error(`[${config.botName}] Reconnect failed: ${error.message}`);
          });
        }, 3000);
      } else {
        console.error(`[${config.botName}] Logged out. Delete ${config.waAuthDir} and scan a new QR code.`);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') {
      return;
    }

    for (const message of messages) {
      await handleMessage(sock, message);
    }
  });
}

async function handleMessage(sock, message) {
  const from = normalizeJid(message.key?.remoteJid);
  const sender = normalizeJid(message.key?.participant || message.key?.remoteJid);
  const text = getMessageText(message).trim();
  const mentionedJids = [...getMentionedJids(message)];
  const group = isGroupJid(from);

  logIncomingMessage({ from, sender, isGroup: group, text, mentionedJids });

  if (!from || from === 'status@broadcast' || !sender || message.key?.fromMe) {
    return;
  }

  if (await maybeHandleLagReport(sock, message, from, text, mentionedJids)) {
    return;
  }

  const parsed = parseCommand(text);

  if (!parsed) {
    return;
  }

  const command = commands.get(parsed.name);

  if (!command) {
    return;
  }

  const owner = config.ownerJidSet.has(sender);

  if (!owner && (!group || command.ownerOnly)) {
    console.warn(`[${config.botName}] Ignored non-owner command ${parsed.rawCommand} from ${sender}`);
    return;
  }

  if (group && !command.allowAnyGroup && !config.allowedGroupJidSet.has(from)) {
    if (owner) {
      await sendReply(sock, from, COMMAND_GROUP_REJECTION_MESSAGE, message);
    }
    return;
  }

  const context = {
    args: parsed.args,
    argsText: parsed.argsText,
    commandName: parsed.name,
    commands,
    config,
    cooldown,
    from,
    isGroup: group,
    mentionedJids,
    message,
    receivedAt: Date.now(),
    reply: (textToSend) => sendReply(sock, from, textToSend, message),
    replyLong: (textToSend) => sendLongReply(sock, from, textToSend, message),
    sender,
    sock,
    startedAt,
    text
  };

  try {
    await command.execute(context);
  } catch (error) {
    await sendReply(sock, from, `[FAILED] ${config.displayName}\n${formatRunError(error)}`, message);
  }
}

function loadCommands() {
  const loaded = new Map();
  const commandsPath = path.join(__dirname, 'commands');

  for (const file of fs.readdirSync(commandsPath).filter((name) => name.endsWith('.js'))) {
    const command = require(path.join(commandsPath, file));

    if (!command.name || typeof command.execute !== 'function') {
      console.warn(`Skipping invalid command file: ${file}`);
      continue;
    }

    loaded.set(command.name, command);

    for (const alias of command.aliases || []) {
      loaded.set(alias, command);
    }
  }

  return loaded;
}

function parseCommand(text) {
  if (!text) {
    return null;
  }

  const prefixes = getKnownPrefixes();
  const prefix = prefixes.find((candidate) => text.startsWith(candidate));

  if (!prefix) {
    return null;
  }

  const withoutPrefix = text.slice(prefix.length).trim();
  const [rawName = '', ...args] = withoutPrefix.split(/\s+/);
  const name = rawName.toLowerCase();

  if (!name) {
    return null;
  }

  return {
    args,
    argsText: withoutPrefix.slice(rawName.length).trim(),
    name,
    prefix,
    rawCommand: `${prefix}${name}`
  };
}

function getKnownPrefixes() {
  const prefixes = new Set([config.prefix]);

  for (const command of commands.values()) {
    for (const prefix of command.prefixes || [command.prefix || config.prefix]) {
      prefixes.add(prefix);
    }
  }

  return [...prefixes].sort((a, b) => b.length - a.length);
}

async function maybeHandleLagReport(sock, message, from, text, mentionedJids) {
  if (!isGroupJid(from) || !config.allowedGroupJidSet.has(from)) {
    return false;
  }

  if (!text || !LAG_KEYWORD_PATTERN.test(text)) {
    return false;
  }

  if (!messageMentionsTrigger(sock, text, mentionedJids)) {
    return false;
  }

  const remainingSeconds = cooldown.getRemainingSeconds();

  if (remainingSeconds > 0) {
    await sendReply(
      sock,
      from,
      `Restart already triggered recently. Cooldown: ${Math.max(1, Math.ceil(remainingSeconds / 60))} minutes left.`,
      message
    );
    return true;
  }

  cooldown.markTriggered();
  await sendReply(sock, from, 'Lag report detected. Restarting Minecraft server...', message);

  try {
    await runRailwayCommand('restart');
    await sendReply(sock, from, 'Minecraft server restarted. Please wait 30-60 seconds before joining.', message);
  } catch (error) {
    await sendReply(sock, from, `Restart failed: ${shortError(error)}`, message);
  }

  return true;
}

function messageMentionsTrigger(sock, text, mentionedJids) {
  const triggerJids = new Set(config.triggerMentionJids.map(normalizeJid));
  const botJid = normalizeJid(sock.user?.id);
  const botLid = normalizeJid(sock.user?.lid);

  if (botJid) {
    triggerJids.add(botJid);
  }

  if (botLid) {
    triggerJids.add(botLid);
  }

  if (triggerJids.size === 0) {
    return false;
  }

  for (const jid of mentionedJids) {
    if (triggerJids.has(normalizeJid(jid))) {
      return true;
    }
  }

  for (const jid of triggerJids) {
    const phone = jid.split('@')[0];

    if (phone && text.includes(`@${phone}`)) {
      return true;
    }
  }

  return false;
}

function createAutoRestartCooldown() {
  let lastTriggeredAt = 0;

  return {
    clear() {
      lastTriggeredAt = 0;
    },
    getRemainingSeconds() {
      if (!lastTriggeredAt) {
        return 0;
      }

      const elapsedSeconds = Math.floor((Date.now() - lastTriggeredAt) / 1000);
      return Math.max(0, config.autoRestartCooldownSeconds - elapsedSeconds);
    },
    markTriggered() {
      lastTriggeredAt = Date.now();
    }
  };
}

function getMessageText(message) {
  const content = message.message;

  if (!content) {
    return '';
  }

  if (content.conversation) {
    return content.conversation;
  }

  if (content.extendedTextMessage?.text) {
    return content.extendedTextMessage.text;
  }

  if (content.imageMessage?.caption) {
    return content.imageMessage.caption;
  }

  if (content.videoMessage?.caption) {
    return content.videoMessage.caption;
  }

  if (content.documentMessage?.caption) {
    return content.documentMessage.caption;
  }

  if (content.buttonsResponseMessage?.selectedButtonId) {
    return content.buttonsResponseMessage.selectedButtonId;
  }

  if (content.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return content.listResponseMessage.singleSelectReply.selectedRowId;
  }

  return '';
}

function getMentionedJids(message) {
  const content = message.message || {};
  const contextInfos = [
    content.extendedTextMessage?.contextInfo,
    content.imageMessage?.contextInfo,
    content.videoMessage?.contextInfo,
    content.documentMessage?.contextInfo,
    content.buttonsResponseMessage?.contextInfo,
    content.templateButtonReplyMessage?.contextInfo
  ];
  const mentioned = new Set();

  for (const contextInfo of contextInfos) {
    for (const jid of contextInfo?.mentionedJid || []) {
      mentioned.add(normalizeJid(jid));
    }
  }

  return mentioned;
}

function logIncomingMessage({ from, sender, isGroup, text, mentionedJids }) {
  console.log('=== MESSAGE ===');
  console.log(`FROM: ${from || '-'}`);
  console.log(`SENDER: ${sender || '-'}`);
  console.log(`IS_GROUP: ${Boolean(isGroup)}`);
  console.log(`TEXT: ${text || '-'}`);
  console.log(`MENTIONED: ${mentionedJids.length > 0 ? mentionedJids.join(', ') : '-'}`);
  console.log('===============');
}

async function sendReply(sock, jid, text, quotedMessage) {
  await sock.sendMessage(
    jid,
    { text: limitText(String(text || ''), MAX_REPLY_LENGTH) },
    { quoted: quotedMessage }
  );
}

async function sendLongReply(sock, jid, text, quotedMessage) {
  for (const chunk of chunkText(String(text || ''), MAX_REPLY_LENGTH)) {
    await sock.sendMessage(
      jid,
      { text: chunk },
      { quoted: quotedMessage }
    );
  }
}

function shortError(error) {
  return limitText(formatRunError(error).replace(/\s+/g, ' ').trim(), 240);
}

function limitText(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 20)}\n...[truncated]`;
}

function chunkText(text, maxLength) {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf('\n', maxLength);

    if (splitAt <= 0) {
      splitAt = maxLength;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).replace(/^\n/, '');
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}
