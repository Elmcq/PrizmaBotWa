const { statusBedrock } = require('minecraft-server-util');
const { formatClock } = require('./time');

const MINECRAFT_TIMEOUT_MS = 5000;
const HTTP_STATUS_TIMEOUT_MS = 5000;
const MCSTATUS_BEDROCK_URL = 'https://api.mcstatus.io/v2/status/bedrock';

function isTimeoutError(error) {
  const message = String(error?.message || '').toLowerCase();

  return error?.code === 'MINECRAFT_TIMEOUT'
    || error?.code === 'ETIMEDOUT'
    || error?.name === 'AbortError'
    || message.includes('timed out')
    || message.includes('timeout')
    || message.includes('offline or unreachable');
}

async function getBedrockStatus(config, source = 'minecraft') {
  try {
    const response = await getBedrockStatusFromUdp(config, source);
    response.statusSource = 'udp';
    return response;
  } catch (udpError) {
    console.warn(`[${formatClock()}] ${source} UDP status failed, trying mcstatus.io: ${udpError.message}`);

    try {
      const response = await getBedrockStatusFromMcstatus(config, source);
      response.statusSource = 'mcstatus.io';
      response.udpError = udpError;
      console.log(`[${formatClock()}] ${source} Minecraft status OK via mcstatus.io fallback`);
      return response;
    } catch (httpError) {
      httpError.cause = udpError;
      console.error(`[${formatClock()}] ${source} mcstatus.io status failed: ${httpError.message}`);
      throw httpError;
    }
  }
}

async function getBedrockStatusFromUdp(config, source = 'minecraft') {
  const { ip, port } = config.server;
  let timeoutId;

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error('Minecraft server did not respond.');
      error.code = 'MINECRAFT_TIMEOUT';
      reject(error);
    }, MINECRAFT_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      statusBedrock(ip, port, {
        timeout: MINECRAFT_TIMEOUT_MS,
        enableSRV: false
      }),
      timeout
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getBedrockStatusFromMcstatus(config, source = 'minecraft') {
  const { ip, port } = config.server;
  const address = encodeURIComponent(`${ip}:${port}`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HTTP_STATUS_TIMEOUT_MS);

  try {
    const response = await fetch(`${MCSTATUS_BEDROCK_URL}/${address}?timeout=5`, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': `PrizmaBotWa/${config.version || 'unknown'}`
      }
    });

    if (!response.ok) {
      const error = new Error(`mcstatus.io returned HTTP ${response.status}`);
      error.code = 'MCSTATUS_HTTP_ERROR';
      throw error;
    }

    return normalizeMcstatusResponse(await response.json());
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeMcstatusResponse(response) {
  if (!response?.online) {
    const error = new Error('Minecraft server is offline according to mcstatus.io.');
    error.code = 'MINECRAFT_OFFLINE';
    throw error;
  }

  return {
    edition: response.edition,
    motd: {
      raw: response.motd?.raw || response.motd?.clean || 'Unavailable',
      clean: response.motd?.clean || response.motd?.raw || 'Unavailable',
      html: response.motd?.html || ''
    },
    version: {
      name: response.version?.name || 'Unavailable',
      protocol: response.version?.protocol ?? null
    },
    players: {
      online: response.players?.online ?? 0,
      max: response.players?.max ?? 0,
      list: Array.isArray(response.players?.list) ? response.players.list : []
    },
    serverID: response.server_id || null,
    gameMode: response.gamemode || null,
    gameModeID: null,
    portIPv4: response.port || null,
    portIPv6: null
  };
}

module.exports = {
  HTTP_STATUS_TIMEOUT_MS,
  MCSTATUS_BEDROCK_URL,
  MINECRAFT_TIMEOUT_MS,
  getBedrockStatus,
  getBedrockStatusFromMcstatus,
  getBedrockStatusFromUdp,
  isTimeoutError,
  normalizeMcstatusResponse
};
