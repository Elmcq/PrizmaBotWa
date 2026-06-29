const appPackage = require('../package.json');
const baileysPackage = require('@whiskeysockets/baileys/package.json');

module.exports = {
  name: 'about',
  prefixes: ['/', '!'],
  description: 'Tampilkan informasi bot.',
  async execute({ config, reply }) {
    await reply(
      `${config.displayName || config.botName}\n\n` +
        `Version : v${appPackage.version}\n` +
        `Node.js : ${process.versions.node}\n` +
        `Baileys : ${baileysPackage.version}`
    );
  }
};
