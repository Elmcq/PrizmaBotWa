require('dotenv').config();

const appPackage = require('./package.json');
const { normalizeJid, parseJidList } = require('./utils/jids');

const REQUIRED_ENV = [
  'BOT_NAME',
  'DISPLAY_NAME',
  'PREFIX',
  'WA_AUTH_DIR',
  'OWNER_JIDS',
  'ALLOWED_GROUP_JIDS',
  'TRIGGER_MENTION_JIDS',
  'AUTO_RESTART_COOLDOWN_SECONDS',
  'RAILWAY_PROJECT',
  'RAILWAY_ENVIRONMENT',
  'RAILWAY_SERVICE',
  'COMMAND_TIMEOUT',
  'SERVER_NAME',
  'SERVER_IP',
  'SERVER_PORT',
  'ENABLE_MONITORING',
  'MONITOR_INTERVAL'
];

function loadConfig() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }

  const ownerJids = parseJidList(process.env.OWNER_JIDS);
  const allowedGroupJids = parseJidList(process.env.ALLOWED_GROUP_JIDS);
  const triggerMentionJids = parseJidList(process.env.TRIGGER_MENTION_JIDS);
  const serverPort = parsePositiveInt(process.env.SERVER_PORT, 'SERVER_PORT');
  const monitorInterval = parsePositiveInt(process.env.MONITOR_INTERVAL, 'MONITOR_INTERVAL');

  if (ownerJids.length === 0) {
    throw new Error('OWNER_JIDS must contain at least one JID.');
  }

  if (serverPort > 65535) {
    throw new Error('SERVER_PORT must be between 1 and 65535.');
  }

  if (monitorInterval < 10000) {
    throw new Error('MONITOR_INTERVAL must be at least 10000 ms.');
  }

  const config = {
    botName: process.env.BOT_NAME.trim(),
    displayName: process.env.DISPLAY_NAME.trim(),
    version: appPackage.version,
    logLevel: process.env.LOG_LEVEL?.trim() || 'error',
    prefix: process.env.PREFIX.trim(),
    waAuthDir: process.env.WA_AUTH_DIR.trim(),
    ownerJids,
    ownerJidSet: new Set(ownerJids.map(normalizeJid)),
    allowedGroupJids,
    allowedGroupJidSet: new Set(allowedGroupJids.map(normalizeJid)),
    triggerMentionJids,
    triggerMentionJidSet: new Set(triggerMentionJids.map(normalizeJid)),
    autoRestartCooldownSeconds: parsePositiveInt(
      process.env.AUTO_RESTART_COOLDOWN_SECONDS,
      'AUTO_RESTART_COOLDOWN_SECONDS'
    ),
    railway: {
      project: process.env.RAILWAY_PROJECT.trim(),
      environment: process.env.RAILWAY_ENVIRONMENT.trim(),
      service: process.env.RAILWAY_SERVICE.trim()
    },
    commandTimeout: parsePositiveInt(process.env.COMMAND_TIMEOUT, 'COMMAND_TIMEOUT'),
    server: {
      name: process.env.SERVER_NAME.trim(),
      ip: process.env.SERVER_IP.trim(),
      port: serverPort
    },
    monitoring: {
      enabled: parseBoolean(process.env.ENABLE_MONITORING, 'ENABLE_MONITORING'),
      interval: monitorInterval,
      notificationGroupJid: normalizeJid(process.env.NOTIFICATION_GROUP_JID || '')
    },
    commandOrder: [
      'help',
      'ip',
      'status',
      'player',
      'start',
      'stop',
      'restart',
      'list',
      'backup',
      'say',
      'ping',
      'cooldown',
      'unlockrestart',
      'jid',
      'groups',
      'about',
      'uptime',
      'changelog',
      'groupid'
    ]
  };

  config.enableMonitoring = config.monitoring.enabled;
  config.monitorInterval = config.monitoring.interval;
  config.notificationGroupId = config.monitoring.notificationGroupJid;
  config.allowedGroupJidsSet = config.allowedGroupJidSet;
  config.ownerNumbers = config.ownerJids;
  config.allowedCommandGroups = config.allowedGroupJids;

  return config;
}

function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function parseBoolean(value, name) {
  const normalized = String(value || '').trim().toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new Error(`${name} must be true or false.`);
}

module.exports = loadConfig();
module.exports.loadConfig = loadConfig;
