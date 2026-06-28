const appPackage = require('../package.json');
const whatsappPackage = require('whatsapp-web.js/package.json');

module.exports = {
  name: 'about',
  prefixes: ['/', '!'],
  description: 'Tampilkan informasi bot.',
  async execute(message, { config }) {
    const repository = config.repository ? `Repository : ${config.repository}\n` : '';

    await message.reply(
      `🤖 ${config.displayName || config.botName}\n\n` +
        `Version : v${appPackage.version}\n` +
        `Author  : ${config.author || config.developer}\n` +
        repository +
        `Node.js : ${process.versions.node}\n` +
        `WA-WebJS: ${whatsappPackage.version}`
    );
  }
};
