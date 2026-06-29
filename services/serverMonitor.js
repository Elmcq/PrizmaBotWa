const { getBedrockStatus } = require('../utils/minecraftStatus');
const { isServerConfigReady } = require('../utils/serverConfig');
const { formatClock } = require('../utils/time');

const STATUS = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE'
};

class ServerMonitor {
  constructor(sock, config) {
    this.sock = sock;
    this.config = config;
    this.timer = null;
    this.lastErrorLogAt = 0;
    this.lastStatus = null;
    this.isChecking = false;
    this.isRunning = false;
  }

  start() {
    if (!this.config.monitoring.enabled) {
      console.log(`[${formatClock()}] Monitoring disabled by ENABLE_MONITORING=false`);
      return;
    }

    if (!isServerConfigReady(this.config.server)) {
      console.warn(`[${formatClock()}] Monitoring enabled, but SERVER_IP/SERVER_PORT is not valid.`);
      return;
    }

    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    console.log(`[${formatClock()}] Monitoring started (${this.config.monitoring.interval} ms)`);

    this.check();
    this.timer = setInterval(() => this.check(), this.config.monitoring.interval);
  }

  stop(reason = 'monitoring stopped') {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.isRunning) {
      console.log(`[${formatClock()}] Monitoring stopped: ${reason}`);
    }

    this.isRunning = false;
  }

  async check() {
    if (this.isChecking) {
      return;
    }

    this.isChecking = true;

    try {
      const result = await this.getServerStatus();
      await this.handleStatusResult(result);
    } catch (error) {
      this.throttledWarn(`Monitoring check failed: ${error.message}`);
    } finally {
      this.isChecking = false;
    }
  }

  async getServerStatus() {
    try {
      const data = await getBedrockStatus(this.config, 'monitoring');
      return { status: STATUS.ONLINE, data };
    } catch (error) {
      this.throttledWarn(`Minecraft status unavailable: ${error.message}`);
      return { status: STATUS.OFFLINE, data: null };
    }
  }

  async handleStatusResult(result) {
    const changed = this.lastStatus !== null && this.lastStatus !== result.status;

    if (changed || this.lastStatus === null) {
      console.log(`[${formatClock()}] Server ${result.status}`);
    }

    if (changed) {
      await this.sendNotification(result);
    }

    this.lastStatus = result.status;
  }

  async sendNotification(result) {
    const groupJid = this.config.monitoring.notificationGroupJid;

    if (!groupJid) {
      return;
    }

    try {
      await this.sock.sendMessage(groupJid, { text: this.buildNotificationMessage(result) });
      console.log(`[${formatClock()}] Server status notification sent to ${groupJid}`);
    } catch (error) {
      this.throttledWarn(`Failed to send monitoring notification: ${error.message}`);
    }
  }

  buildNotificationMessage(result) {
    if (result.status === STATUS.ONLINE) {
      const players = result.data.players || {};
      const version = result.data.version || {};

      return (
        `${this.config.server.name} Server\n\n` +
        'Server kembali ONLINE!\n\n' +
        `IP: ${this.config.server.ip}:${this.config.server.port}\n\n` +
        `Player: ${players.online}/${players.max}\n\n` +
        `Version: ${version.name || '-'}\n\n` +
        `Jam: ${formatClock()}`
      );
    }

    return (
      `${this.config.server.name} Server\n\n` +
      'Server OFFLINE atau tidak dapat dihubungi.\n\n' +
      `Jam: ${formatClock()}`
    );
  }

  throttledWarn(message) {
    const now = Date.now();

    if (now - this.lastErrorLogAt < 5 * 60 * 1000) {
      return;
    }

    this.lastErrorLogAt = now;
    console.warn(`[${formatClock()}] ${message}`);
  }
}

module.exports = {
  ServerMonitor,
  STATUS
};
