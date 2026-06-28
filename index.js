const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const config = require('./config');
const { ServerMonitor } = require('./services/serverMonitor');
const { formatClock } = require('./utils/time');

const commands = new Map();
const commandsPath = path.join(__dirname, 'commands');

for (const file of fs.readdirSync(commandsPath).filter((name) => name.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));

  if (!command.name || typeof command.execute !== 'function') {
    console.warn(`Command ${file} dilewati karena formatnya tidak valid.`);
    continue;
  }

  commands.set(command.name, command);
}
const commandPrefixes = new Set([
  config.prefix,
  ...[...commands.values()].map((command) => command.prefix).filter(Boolean)
]);

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});
const serverMonitor = new ServerMonitor(client, config);

client.on('qr', (qr) => {
  console.log('Scan QR ini pakai WhatsApp di HP kamu:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(` ${config.botName}`);
  console.log(` Version : ${config.version}`);
  console.log(' Status  : Online');
  console.log(` Prefix  : ${config.prefix}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  serverMonitor.start();
});

client.on('auth_failure', (message) => {
  console.error('Auth failure: login WhatsApp gagal.', message);
  serverMonitor.stop('auth failure');
});

client.on('disconnected', (reason) => {
  console.error('WhatsApp disconnected:', reason);
  serverMonitor.stop(`WhatsApp disconnected (${reason})`);
});

client.on('change_state', (state) => {
  console.log(`WhatsApp state berubah: ${state}`);
});

client.on('message', async (message) => {
  const receivedAt = Date.now();
  const text = message.body.trim();
  const prefix = getMatchedPrefix(text);

  if (!prefix) {
    return;
  }

  const [rawCommand] = text.slice(prefix.length).split(/\s+/);
  const commandName = rawCommand.toLowerCase();
  const command = commands.get(commandName);

  if (!command || getCommandPrefix(command, config) !== prefix) {
    await message.reply('Command tidak ditemukan. Ketik /help');
    return;
  }

  try {
    logCommand(prefix, commandName, message.author || message.from);
    await command.execute(message, { config, commands, receivedAt });
  } catch (error) {
    console.error(`Gagal menjalankan command /${commandName}:`, error);
    await message.reply('Maaf, command lagi bermasalah. Coba lagi nanti ya.');
  }
});

client.initialize();

function getMatchedPrefix(text) {
  return [...commandPrefixes]
    .sort((a, b) => b.length - a.length)
    .find((prefix) => text.startsWith(prefix));
}

function getCommandPrefix(command, appConfig) {
  return command.prefix || appConfig.prefix;
}

function logCommand(prefix, commandName, sender) {
  console.log(`[${formatClock()}] ${prefix}${commandName} - ${sender}`);
}
