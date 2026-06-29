module.exports = {
  name: 'unlockrestart',
  ownerOnly: true,
  allowAnyGroup: true,
  description: 'Clear auto-restart cooldown.',
  async execute({ cooldown, reply }) {
    cooldown.clear();
    await reply('Auto-restart cooldown cleared.');
  }
};
