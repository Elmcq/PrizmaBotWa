const { formatCompactUptime, formatWibDateTime } = require('../utils/time');

module.exports = {
  name: 'uptime',
  prefixes: ['/', '!'],
  allowAnyGroup: true,
  description: 'Tampilkan uptime bot.',
  async execute({ startedAt, reply }) {
    await reply(
      'Bot Uptime\n\n' +
        `Uptime: ${formatCompactUptime(process.uptime())}\n` +
        `Started: ${formatWibDateTime(startedAt)}\n` +
        `Current: ${formatWibDateTime()}`
    );
  }
};
