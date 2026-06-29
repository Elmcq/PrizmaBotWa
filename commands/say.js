const { formatCommandOutput, runRailwayCommand, sanitizeSayMessage } = require('../utils/railwaySsh');

module.exports = {
  name: 'say',
  ownerOnly: true,
  description: 'Send a message to the Minecraft server.',
  async execute({ argsText, reply }) {
    let message;

    try {
      message = sanitizeSayMessage(argsText);
    } catch (error) {
      await reply(`Invalid /say message: ${error.message}`);
      return;
    }

    const result = await runRailwayCommand('say', [message]);
    await reply(formatCommandOutput(result.stdout, result.stderr) || 'No output.');
  }
};
