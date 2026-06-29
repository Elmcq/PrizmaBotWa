require('dotenv').config();

const { spawn } = require('child_process');
const process = require('process');
const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const BOT_NAME = 'Ideology Prizmarine Bot';
const BRAND = 'Ideology Prizmarine';
const MAX_REPLY_LENGTH = 3000;
const MAX_SAY_LENGTH = 120;
const MAX_PROCESS_OUTPUT_LENGTH = 1024 * 1024;
const LAG_KEYWORD_PATTERN = /\b(?:server\s+lag|ngelag|lag|patah|delay|lemot)\b/i;

const COMMANDS = Object.freeze({
  '/status': '/home/mc/scripts/status.sh',
  '/start': '/home/mc/scripts/start.sh',
  '/stop': '/home/mc/scripts/stop.sh',
  '/restart': '/home/mc/scripts/restart.sh',
  '/list': '/home/mc/scripts/list.sh',
  '/backup': '/home/mc/scripts/backup.sh'
});

const logger = pino({ level: process.env.LOG_LEVEL || 'error' });
let config;
let autoRestartLastTriggeredAt = 0;

try {
  config = loadConfig();
} catch (error) {
  console.error(`[${BOT_NAME}] Configuration error: ${error.message}`);
  process.exit(1);
}

startBot().catch((error) => {
  console.error(`[${BOT_NAME}] Fatal startup error: ${error.message}`);
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

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log(`[${BOT_NAME}] Scan this QR code with WhatsApp:`);
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log(`[${BOT_NAME}] WhatsApp connected.`);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.error(
        `[${BOT_NAME}] WhatsApp disconnected. Reason=${statusCode || 'unknown'} reconnect=${shouldReconnect}`
      );

      if (shouldReconnect) {
        setTimeout(() => {
          startBot().catch((error) => {
            console.error(`[${BOT_NAME}] Reconnect failed: ${error.message}`);
          });
        }, 3000);
      } else {
        console.error(`[${BOT_NAME}] Logged out. Delete ${config.waAuthDir} and scan a new QR code.`);
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
  const remoteJid = message.key?.remoteJid;
  const sender = message.key?.participant || remoteJid;
  const senderJid = normalizeJid(sender);
  const body = getMessageText(message).trim();
  const mentionedJids = [...getMentionedJids(message)];
  const isGroup = isGroupJid(remoteJid);

  logIncomingMessage({
    from: remoteJid,
    sender,
    isGroup,
    text: body,
    mentionedJids
  });

  if (
    !remoteJid ||
    remoteJid === 'status@broadcast' ||
    !senderJid ||
    message.key?.fromMe
  ) {
    return;
  }

  if (await maybeHandleLagReport(sock, message, remoteJid, body)) {
    return;
  }

  if (!body.startsWith('/')) {
    return;
  }

  if (!config.ownerJids.has(senderJid)) {
    console.warn(`[${BOT_NAME}] Ignored non-owner command from ${senderJid}`);
    return;
  }

  const parsed = parseCommand(body);

  if (!parsed.ok) {
    await sendReply(sock, remoteJid, failureReply(parsed.error), message);
    return;
  }

  if (parsed.command === '/cooldown') {
    await sendReply(sock, remoteJid, formatCooldownStatus(), message);
    return;
  }

  if (parsed.command === '/unlockrestart') {
    autoRestartLastTriggeredAt = 0;
    await sendReply(sock, remoteJid, '✅ Auto-restart cooldown cleared.', message);
    return;
  }

  if (parsed.command === '/jid') {
    await sendReply(sock, remoteJid, formatJidReply(remoteJid, sender, isGroup, mentionedJids), message);
    return;
  }

  if (parsed.command === '/groups') {
    try {
      await sendLongReply(sock, remoteJid, await formatGroupsReply(sock), message);
    } catch (error) {
      await sendReply(sock, remoteJid, failureReply(`Unable to fetch groups: ${shortError(error)}`), message);
    }
    return;
  }

  await sendReply(sock, remoteJid, `[RUNNING] ${BRAND}\nRunning ${parsed.command}...`, message);

  try {
    const result = await runWhitelistedCommand(parsed.command, parsed.args);
    const output = formatCommandOutput(result.stdout, result.stderr);

    await sendReply(sock, remoteJid, successReply(parsed.command, output), message);
  } catch (error) {
    await sendReply(sock, remoteJid, failureReply(formatRunError(error)), message);
  }
}

function loadConfig() {
  const required = ['OWNER_JIDS', 'RAILWAY_PROJECT', 'RAILWAY_ENVIRONMENT', 'RAILWAY_SERVICE'];
  const missing = required.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }

  const ownerJids = new Set(
    process.env.OWNER_JIDS.split(',')
      .map((jid) => normalizeJid(jid.trim()))
      .filter(Boolean)
  );

  if (ownerJids.size === 0) {
    throw new Error('OWNER_JIDS must contain at least one WhatsApp JID.');
  }

  return {
    waAuthDir: process.env.WA_AUTH_DIR || './auth',
    ownerJids,
    allowedGroupJids: parseJidSet(process.env.ALLOWED_GROUP_JIDS),
    triggerMentionJids: parseJidSet(process.env.TRIGGER_MENTION_JIDS),
    railwayProject: process.env.RAILWAY_PROJECT.trim(),
    railwayEnvironment: process.env.RAILWAY_ENVIRONMENT.trim(),
    railwayService: process.env.RAILWAY_SERVICE.trim(),
    commandTimeout: parsePositiveInt(process.env.COMMAND_TIMEOUT, 45, 'COMMAND_TIMEOUT'),
    autoRestartCooldownSeconds: parsePositiveInt(
      process.env.AUTO_RESTART_COOLDOWN_SECONDS,
      600,
      'AUTO_RESTART_COOLDOWN_SECONDS'
    )
  };
}

function parseJidSet(value) {
  return new Set(
    String(value || '')
      .split(',')
      .map((jid) => normalizeJid(jid.trim()))
      .filter(Boolean)
  );
}

function parsePositiveInt(value, fallback, name) {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function normalizeJid(jid) {
  return String(jid || '').replace(/:\d+@/, '@');
}

function isGroupJid(jid) {
  return String(jid || '').endsWith('@g.us');
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

async function maybeHandleLagReport(sock, message, remoteJid, body) {
  if (!isAllowedAutoRestartGroup(remoteJid) || !body || !LAG_KEYWORD_PATTERN.test(body)) {
    return false;
  }

  if (!messageMentionsTrigger(sock, message, body)) {
    return false;
  }

  const remainingSeconds = getAutoRestartCooldownRemainingSeconds();

  if (remainingSeconds > 0) {
    await sendReply(
      sock,
      remoteJid,
      `⏳ Restart already triggered recently. Cooldown: ${formatMinutesLeft(remainingSeconds)} minutes left.`,
      message
    );
    return true;
  }

  autoRestartLastTriggeredAt = Date.now();
  await sendReply(sock, remoteJid, '⚠️ Lag report detected. Restarting Minecraft server...', message);

  try {
    await runWhitelistedCommand('/restart', []);
    await sendReply(
      sock,
      remoteJid,
      '✅ Minecraft server restarted. Please wait 30–60 seconds before joining.',
      message
    );
  } catch (error) {
    await sendReply(sock, remoteJid, `❌ Restart failed: ${shortError(error)}`, message);
  }

  return true;
}

function isAllowedAutoRestartGroup(remoteJid) {
  return remoteJid.endsWith('@g.us') && config.allowedGroupJids.has(normalizeJid(remoteJid));
}

function messageMentionsTrigger(sock, message, body) {
  const triggerJids = new Set(config.triggerMentionJids);
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

  const mentionedJids = getMentionedJids(message);

  for (const jid of mentionedJids) {
    if (triggerJids.has(jid)) {
      return true;
    }
  }

  return textMentionsAnyTrigger(body, triggerJids);
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

function textMentionsAnyTrigger(body, triggerJids) {
  for (const jid of triggerJids) {
    const phone = jid.split('@')[0];

    if (phone && body.includes(`@${phone}`)) {
      return true;
    }
  }

  return false;
}

function getAutoRestartCooldownRemainingSeconds() {
  if (!autoRestartLastTriggeredAt) {
    return 0;
  }

  const elapsedSeconds = Math.floor((Date.now() - autoRestartLastTriggeredAt) / 1000);
  return Math.max(0, config.autoRestartCooldownSeconds - elapsedSeconds);
}

function formatMinutesLeft(seconds) {
  return Math.max(1, Math.ceil(seconds / 60));
}

function formatCooldownStatus() {
  const remainingSeconds = getAutoRestartCooldownRemainingSeconds();

  if (remainingSeconds <= 0) {
    return '✅ Auto-restart cooldown is clear.';
  }

  return `⏳ Auto-restart cooldown: ${formatMinutesLeft(remainingSeconds)} minutes left.`;
}

function shortError(error) {
  return limitText(formatRunError(error).replace(/\s+/g, ' ').trim(), 240);
}

function formatJidReply(from, sender, isGroup, mentionedJids) {
  return [
    `Chat JID: ${from || '-'}`,
    `Sender JID: ${sender || '-'}`,
    `Is group: ${Boolean(isGroup)}`,
    'Mentioned:',
    mentionedJids.length > 0 ? mentionedJids.join('\n') : '-'
  ].join('\n');
}

async function formatGroupsReply(sock) {
  const groups = await sock.groupFetchAllParticipating();
  const lines = Object.entries(groups)
    .map(([id, group]) => ({ ...group, id: group.id || id }))
    .sort((a, b) => String(a.subject || '').localeCompare(String(b.subject || '')))
    .flatMap((group) => [
      group.subject || 'Unnamed group',
      group.id
    ]);

  if (lines.length === 0) {
    return 'No participating groups found.';
  }

  return lines.join('\n');
}

function parseCommand(body) {
  const [rawCommand] = body.split(/\s+/, 1);
  const command = rawCommand.toLowerCase();

  if (COMMANDS[command]) {
    return { ok: true, command, args: [] };
  }

  if (command === '/cooldown' || command === '/unlockrestart' || command === '/jid' || command === '/groups') {
    return { ok: true, command, args: [] };
  }

  if (command === '/say') {
    const rawMessage = body.slice(rawCommand.length);
    const sanitized = sanitizeSayMessage(rawMessage);

    if (!sanitized) {
      return {
        ok: false,
        error: `/say message is empty after sanitizing. Use: /say hello from ${BRAND}`
      };
    }

    if (sanitized.length > MAX_SAY_LENGTH) {
      return {
        ok: false,
        error: `/say message is too long. Maximum is ${MAX_SAY_LENGTH} characters.`
      };
    }

    return { ok: true, command, args: [sanitized] };
  }

  return {
    ok: false,
    error: `Unknown command. Allowed commands: ${Object.keys(COMMANDS).join(', ')}, /say <message>, /cooldown, /unlockrestart, /jid, /groups`
  };
}

function sanitizeSayMessage(message) {
  return message
    .replace(/[\r\n`;&|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function runWhitelistedCommand(command, commandArgs) {
  const commandLine = buildRailwayCommandLine(command, commandArgs);

  if (!commandLine) {
    return Promise.reject(new Error('Command is not whitelisted.'));
  }

  const railwayArgs = [
    'ssh',
    `--project=${config.railwayProject}`,
    `--environment=${config.railwayEnvironment}`,
    `--service=${config.railwayService}`
  ];

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const child = spawn('railway', railwayArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    const timer = setTimeout(() => {
      const error = new Error(`Command timed out after ${config.commandTimeout} seconds.`);
      error.killed = true;
      error.stdout = stdout;
      error.stderr = stderr;
      settled = true;
      child.kill('SIGTERM');
      reject(error);
    }, config.commandTimeout * 1000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      stdout = limitProcessOutput(stdout);
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      stderr = limitProcessOutput(stderr);
    });

    child.stdin.on('error', (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });

    child.on('error', (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });

    child.on('close', (code, signal) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(`Railway SSH exited with code ${code ?? 'unknown'}${signal ? ` (${signal})` : ''}.`);
      error.code = code;
      error.signal = signal;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });

    child.stdin.write(`${commandLine}\nexit\n`);
    child.stdin.end();
  });
}

function buildRailwayCommandLine(command, commandArgs) {
  if (COMMANDS[command]) {
    return COMMANDS[command];
  }

  if (command === '/say' && commandArgs.length === 1) {
    return `/home/mc/scripts/say.sh ${posixShellQuote(commandArgs[0])}`;
  }

  return null;
}

function posixShellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

async function sendReply(sock, jid, text, quotedMessage) {
  await sock.sendMessage(
    jid,
    { text: limitText(text, MAX_REPLY_LENGTH) },
    { quoted: quotedMessage }
  );
}

async function sendLongReply(sock, jid, text, quotedMessage) {
  const chunks = chunkText(text, MAX_REPLY_LENGTH);

  for (const chunk of chunks) {
    await sock.sendMessage(
      jid,
      { text: chunk },
      { quoted: quotedMessage }
    );
  }
}

function successReply(command, output) {
  return `[OK] ${BRAND}\n${command} completed.\n\n${output || 'No output.'}`;
}

function failureReply(message) {
  return `[FAILED] ${BRAND}\n${message}`;
}

function formatCommandOutput(stdout, stderr) {
  const parts = [];
  const cleanStdout = String(stdout || '').trim();
  const cleanStderr = String(stderr || '').trim();

  if (cleanStdout) {
    parts.push(cleanStdout);
  }

  if (cleanStderr) {
    parts.push(`stderr:\n${cleanStderr}`);
  }

  return parts.join('\n\n');
}

function formatRunError(error) {
  const details = formatCommandOutput(error.stdout, error.stderr);

  if (error.killed || error.signal === 'SIGTERM') {
    return `Command timed out after ${config.commandTimeout} seconds.${details ? `\n\n${details}` : ''}`;
  }

  if (details) {
    return details;
  }

  return error.message || 'Command failed.';
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

function limitProcessOutput(text) {
  if (text.length <= MAX_PROCESS_OUTPUT_LENGTH) {
    return text;
  }

  return text.slice(text.length - MAX_PROCESS_OUTPUT_LENGTH);
}
