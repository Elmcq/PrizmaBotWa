const { getBedrockStatus } = require('../utils/minecraftStatus');
const { isServerConfigReady } = require('../utils/serverConfig');

module.exports = {
  name: 'player',
  allowAnyGroup: true,
  description: 'Tampilkan jumlah player online.',
  async execute({ config, reply }) {
    if (!isServerConfigReady(config.server)) {
      await reply('SERVER_IP atau SERVER_PORT belum valid di .env.');
      return;
    }

    try {
      const status = await getBedrockStatus(config, '/player');
      await reply(`Player online di ${config.server.name}: ${status.players.online}/${status.players.max}`);
    } catch (error) {
      await reply(`Belum bisa cek player ${config.server.name}. Server offline atau tidak bisa dihubungi.`);
    }
  }
};
