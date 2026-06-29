const { formatCommandOutput, runRailwayCommand } = require('../utils/railwaySsh');

module.exports = {
  name: 'list',
  ownerOnly: true,
  description: 'Request Minecraft player list via Railway.',
  async execute({ reply }) {
    const result = await runRailwayCommand('list');
    await reply(formatCommandOutput(result.stdout, result.stderr) || 'No output.');
  }
};
