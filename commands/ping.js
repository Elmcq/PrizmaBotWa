const { formatUptime } = require('../utils/time');

module.exports = {
  name: 'ping',
  description: 'Cek bot masih hidup.',
  async execute(message, { receivedAt }) {
    const latency = Date.now() - receivedAt;

    await message.reply(
      '🏓 Pong!\n' +
        'Bot Status : Online\n' +
        `Uptime : ${formatUptime(process.uptime())}\n` +
        `Latency : ${latency} ms`
    );
  }
};
