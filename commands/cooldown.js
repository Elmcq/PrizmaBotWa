module.exports = {
  name: 'cooldown',
  ownerOnly: true,
  allowAnyGroup: true,
  description: 'Check auto-restart cooldown.',
  async execute({ cooldown, reply }) {
    const remainingSeconds = cooldown.getRemainingSeconds();

    if (remainingSeconds <= 0) {
      await reply('Auto-restart cooldown is clear.');
      return;
    }

    await reply(`Auto-restart cooldown: ${Math.max(1, Math.ceil(remainingSeconds / 60))} minutes left.`);
  }
};
