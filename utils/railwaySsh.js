const { spawn } = require('child_process');
const config = require('../config');

const MAX_SAY_LENGTH = 120;
const MAX_PROCESS_OUTPUT_LENGTH = 1024 * 1024;

const SCRIPT_COMMANDS = Object.freeze({
  status: '/home/mc/scripts/status.sh',
  start: '/home/mc/scripts/start.sh',
  stop: '/home/mc/scripts/stop.sh',
  restart: '/home/mc/scripts/restart.sh',
  list: '/home/mc/scripts/list.sh',
  backup: '/home/mc/scripts/backup.sh'
});

async function runRailwayCommand(commandName, args = []) {
  const commandLine = buildRailwayCommandLine(commandName, args);

  if (!commandLine) {
    throw new Error('Command is not whitelisted.');
  }

  const railwayArgs = [
    'ssh',
    `--project=${config.railway.project}`,
    `--environment=${config.railway.environment}`,
    `--service=${config.railway.service}`
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

function buildRailwayCommandLine(commandName, args) {
  const normalized = String(commandName || '').replace(/^\//, '');

  if (SCRIPT_COMMANDS[normalized]) {
    return SCRIPT_COMMANDS[normalized];
  }

  if (normalized === 'say' && args.length === 1) {
    return `/home/mc/scripts/say.sh ${posixShellQuote(args[0])}`;
  }

  return null;
}

function sanitizeSayMessage(message) {
  const sanitized = String(message || '')
    .replace(/[\r\n`;&|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitized) {
    throw new Error('Message is empty after sanitizing.');
  }

  if (sanitized.length > MAX_SAY_LENGTH) {
    throw new Error(`Message is too long. Maximum is ${MAX_SAY_LENGTH} characters.`);
  }

  return sanitized;
}

function formatCommandOutput(stdout, stderr) {
  const parts = [];
  const cleanStdout = cleanTerminalOutput(stdout);
  const cleanStderr = cleanTerminalOutput(stderr);

  if (cleanStdout) {
    parts.push(cleanStdout);
  }

  if (cleanStderr && !isHarmlessRailwayStderr(cleanStderr)) {
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

function cleanTerminalOutput(text) {
  return String(text || '')
    .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '')
    .replace(/\][0-9]+;[^\r\n\x07\x1b]*(?:\x07|\x1b\\)?/g, '')
    .replace(/\x1b\[\?2004[hl]/g, '')
    .replace(/\[\?2004[hl]/g, '')
    .replace(/\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][\s\S]*?(?:\x07|\x1b\\))/g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\r/g, '').replace(/\x08/g, '').trimEnd())
    .map(stripTerminalPromptPrefix)
    .filter((line) => !isTerminalNoiseLine(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripTerminalPromptPrefix(line) {
  return line.replace(/^(?:root|[\w.-]+)@[\w.-]+:[^#$]*[#$]\s+/, '');
}

function isTerminalNoiseLine(line) {
  const trimmed = line.trim();

  if (!trimmed) {
    return false;
  }

  if (trimmed === 'exit') {
    return true;
  }

  if (/^\[?\?2004[hl]$/.test(trimmed)) {
    return true;
  }

  if (/^\[K(?:exit)?$/.test(trimmed)) {
    return true;
  }

  if (/^(?:root|[\w.-]+)@[\w.-]+:[^#$]*[#$]\s*(?:exit)?$/.test(trimmed)) {
    return true;
  }

  if (/^(?:root|[\w.-]+)@[\w.-]+:[^#$]*[#$]\s*\/home\/mc\/scripts\/(?:status|start|stop|restart|list|backup|say)\.sh(?:\s+.*)?$/.test(trimmed)) {
    return true;
  }

  if (/^\/home\/mc\/scripts\/(?:status|start|stop|restart|list|backup|say)\.sh(?:\s+.*)?$/.test(trimmed)) {
    return true;
  }

  return false;
}

function isHarmlessRailwayStderr(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length > 0 && lines.every((line) => /^Using SSH key from file\b/i.test(line));
}

function posixShellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function limitProcessOutput(text) {
  if (text.length <= MAX_PROCESS_OUTPUT_LENGTH) {
    return text;
  }

  return text.slice(text.length - MAX_PROCESS_OUTPUT_LENGTH);
}

module.exports = {
  SCRIPT_COMMANDS,
  cleanTerminalOutput,
  formatCommandOutput,
  formatRunError,
  runRailwayCommand,
  sanitizeSayMessage
};
