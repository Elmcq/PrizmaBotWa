const { formatCommandOutput, runRailwayCommand } = require('../utils/railwaySsh');

module.exports = {
  name: 'start',
  ownerOnly: true,
  description: 'Start Minecraft server via Railway.',
  async execute({ reply }) {
    const result = await runRailwayCommand('start');
    await reply(formatCommandOutput(result.stdout, result.stderr) || 'No output.');
  }
};
