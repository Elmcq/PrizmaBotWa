module.exports = {
  name: 'changelog',
  prefix: '!',
  description: 'Tampilkan changelog terbaru.',
  async execute(message, { config }) {
    await message.reply(
      `📜 Changelog v${config.version}\n\n` +
        '• Added uptime command\n' +
        '• Added about command\n' +
        '• Added changelog command\n' +
        '• Added groupid command'
    );
  }
};
