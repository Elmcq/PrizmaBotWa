module.exports = {
  name: 'help',
  prefixes: ['/', '!'],
  allowAnyGroup: true,
  description: 'Tampilkan semua command yang tersedia.',
  async execute({ config, commands, reply }) {
    const commandList = config.commandOrder
      .map((name) => commands.get(name))
      .filter(Boolean)
      .filter((command) => !command.hidden)
      .map((command) => {
        const prefixes = command.prefixes || [command.prefix || config.prefix];
        const labels = prefixes.map((prefix) => `${prefix}${command.name}`).join(', ');
        return `${labels} - ${command.description}`;
      })
      .join('\n');

    await reply(`${config.botName}\n\nCommand yang tersedia:\n${commandList}`);
  }
};
