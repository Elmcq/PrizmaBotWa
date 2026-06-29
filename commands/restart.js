const { formatCommandOutput, runRailwayCommand } = require('../utils/railwaySsh');

module.exports = {
  name: 'restart',
  ownerOnly: true,
  description: 'Restart Minecraft server via Railway.',
  async execute({ reply }) {
    const result = await runRailwayCommand('restart');
    await reply(formatCommandOutput(result.stdout, result.stderr) || 'No output.');
  }
};
