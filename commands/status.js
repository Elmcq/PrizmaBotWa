const { statusBedrock } = require('minecraft-server-util');
const { isServerConfigReady } = require('../utils/serverConfig');

module.exports = {
  name: 'status',
  description: 'Cek status server Minecraft.',
  async execute(message, { config }) {
    if (!isServerConfigReady(config.server)) {
      await message.reply('IP server belum diset di config.js');
      return;
    }

    try {
      const status = await statusBedrock(config.server.ip, config.server.port);

      await message.reply(
        `Status ${config.server.name}: Online\n` +
          `Versi: ${status.version.name}\n` +
          `Player: ${status.players.online}/${status.players.max}`
      );
    } catch (error) {
      await message.reply(
        `Status ${config.server.name}: Offline atau tidak bisa dihubungi.`
      );
    }
  }
};
