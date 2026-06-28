const { getBedrockStatus } = require('../utils/minecraftStatus');
const { isServerConfigReady } = require('../utils/serverConfig');
const { formatClock } = require('../utils/time');

const STATUS = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE'
};

class ServerMonitor {
  constructor(client, config) {
    this.client = client;
    this.config = config;
    this.timer = null;
    this.lastStatus = null;
    this.isRunning = false;
    this.isChecking = false;
  }

  start() {
    if (!this.config.enableMonitoring) {
      console.log(`[${formatClock()}] Monitoring server nonaktif dari config.js`);
      return;
    }

    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    console.log(`[${formatClock()}] Monitoring server dimulai (${this.getInterval()} ms)`);

    this.check();
    this.timer = setInterval(() => this.check(), this.getInterval());
  }

  stop(reason = 'monitoring dihentikan') {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.isRunning) {
      console.log(`[${formatClock()}] Monitoring server berhenti: ${reason}`);
    }

    this.isRunning = false;
  }

  async check() {
    if (this.isChecking) {
      console.log(`[${formatClock()}] Monitoring dilewati, pengecekan sebelumnya belum selesai`);
      return;
    }

    if (!isServerConfigReady(this.config.server)) {
      console.log(`[${formatClock()}] Monitoring aktif, IP server belum diset di config.js`);
      return;
    }

    this.isChecking = true;

    try {
      const result = await this.getServerStatus();
      await this.handleStatusResult(result);
    } catch (error) {
      console.error(`[${formatClock()}] Monitoring error:`, error.message);
    } finally {
      this.isChecking = false;
    }
  }

  async getServerStatus() {
    try {
      const data = await getBedrockStatus(this.config, 'monitoring');

      return {
        status: STATUS.ONLINE,
        data
      };
    } catch (error) {
      return {
        status: STATUS.OFFLINE,
        data: null
      };
    }
  }

  async handleStatusResult(result) {
    const changed = this.lastStatus !== null && this.lastStatus !== result.status;
    const same = this.lastStatus === result.status;

    if (same) {
      console.log(`[${formatClock()}] Server ${result.status} (tidak berubah)`);
    } else {
      console.log(`[${formatClock()}] Server ${result.status}`);
    }

    if (changed) {
      await this.sendNotification(result);
    }

    this.lastStatus = result.status;
  }

  async sendNotification(result) {
    const groupId = this.config.notificationGroupId.trim();

    if (!groupId) {
      console.log(`[${formatClock()}] Status berubah, tapi notificationGroupId kosong`);
      return;
    }

    try {
      await this.client.sendMessage(groupId, this.buildNotificationMessage(result));
      console.log(`[${formatClock()}] Notifikasi server dikirim ke ${groupId}`);
    } catch (error) {
      console.error(`[${formatClock()}] Gagal mengirim notifikasi server:`, error.message);
    }
  }

  buildNotificationMessage(result) {
    if (result.status === STATUS.ONLINE) {
      const players = result.data.players || {};
      const version = result.data.version || {};

      return (
        `🟢 ${this.config.server.name} Server\n\n` +
        'Server kembali ONLINE!\n\n' +
        `IP: ${this.config.server.ip}:${this.config.server.port}\n\n` +
        `Player: ${players.online}/${players.max}\n\n` +
        `Version: ${version.name || '-'}\n\n` +
        'Jam:\n' +
        formatClock()
      );
    }

    return (
      `🔴 ${this.config.server.name} Server\n\n` +
      'Server OFFLINE atau tidak dapat dihubungi.\n\n' +
      'Jam:\n' +
      formatClock()
    );
  }

  getInterval() {
    const interval = Number(this.config.monitorInterval);

    if (!Number.isInteger(interval) || interval < 10000) {
      return 60000;
    }

    return interval;
  }
}

module.exports = {
  ServerMonitor,
  STATUS
};
