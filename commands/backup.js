const { formatCommandOutput, runRailwayCommand } = require('../utils/railwaySsh');

module.exports = {
  name: 'backup',
  ownerOnly: true,
  description: 'Run Minecraft backup via Railway.',
  async execute({ reply }) {
    const result = await runRailwayCommand('backup');
    await reply(formatCommandOutput(result.stdout, result.stderr) || 'No output.');
  }
};
