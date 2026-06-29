const { formatUptime } = require('../utils/time');

module.exports = {
  name: 'ping',
  allowAnyGroup: true,
  description: 'Cek bot masih hidup.',
  async execute({ receivedAt, reply }) {
    const latency = Date.now() - receivedAt;

    await reply(
      'Pong!\n' +
        'Bot Status : Online\n' +
        `Uptime : ${formatUptime(process.uptime())}\n` +
        `Latency : ${latency} ms`
    );
  }
};
