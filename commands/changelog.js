module.exports = {
  name: 'changelog',
  prefixes: ['/', '!'],
  description: 'Tampilkan changelog terbaru.',
  async execute({ config, reply }) {
    await reply(
      `Changelog v${config.version}\n\n` +
        '- Migrated runtime to Baileys.\n' +
        '- Added Railway SSH Minecraft control commands.\n' +
        '- Added owner/group JID helpers.\n' +
        '- Added mention-gated auto lag restart cooldown.'
    );
  }
};
