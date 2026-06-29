const { formatCommandOutput, runRailwayCommand } = require('../utils/railwaySsh');

module.exports = {
  name: 'stop',
  ownerOnly: true,
  description: 'Stop Minecraft server via Railway.',
  async execute({ reply }) {
    const result = await runRailwayCommand('stop');
    await reply(formatCommandOutput(result.stdout, result.stderr) || 'No output.');
  }
};
