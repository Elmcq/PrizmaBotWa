module.exports = {
  name: 'help',
  prefixes: ['/', '!'],
  description: 'Tampilkan semua command yang tersedia.',
  async execute(message, { config, commands }) {
    const commandList = config.commandOrder
      .map((name) => commands.get(name))
      .filter(Boolean)
      .map((command) => {
        const prefixes = command.prefixes || [command.prefix || config.prefix];
        const labels = prefixes.map((prefix) => `${prefix}${command.name}`).join(', ');

        return `${labels} - ${command.description}`;
      })
      .join('\n');

    await message.reply(
      `Halo, ini ${config.botName}.\n\n` +
        `Command yang tersedia:\n${commandList}`
    );
  }
};
