const { formatCompactUptime, formatWibDateTime } = require('../utils/time');

module.exports = {
  name: 'uptime',
  prefix: '!',
  description: 'Tampilkan uptime bot.',
  async execute(message, { startedAt }) {
    await message.reply(
      '🕒 Bot Uptime\n\n' +
        `Uptime: ${formatCompactUptime(process.uptime())}\n` +
        `Started: ${formatWibDateTime(startedAt)}\n` +
        `Current: ${formatWibDateTime()}`
    );
  }
};
