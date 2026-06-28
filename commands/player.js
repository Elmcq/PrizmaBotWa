const { getBedrockStatus } = require('../utils/minecraftStatus');
const { isServerConfigReady } = require('../utils/serverConfig');

module.exports = {
  name: 'player',
  description: 'Tampilkan jumlah player online.',
  async execute(message, { config }) {
    if (!isServerConfigReady(config.server)) {
      await message.reply('IP server belum diset di config.js');
      return;
    }

    try {
      const status = await getBedrockStatus(config, '/player');

      await message.reply(
        `Player online di ${config.server.name}: ` +
          `${status.players.online}/${status.players.max}`
      );
    } catch (error) {
      await message.reply(
        `Belum bisa cek player ${config.server.name}. Server offline atau tidak bisa dihubungi.`
      );
    }
  }
};
