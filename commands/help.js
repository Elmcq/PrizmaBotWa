module.exports = {
  name: 'help',
  description: 'Tampilkan semua command yang tersedia.',
  async execute(message, { config, commands }) {
    const commandList = config.commandOrder
      .map((name) => commands.get(name))
      .filter(Boolean)
      .map((command) => `${command.prefix || config.prefix}${command.name} - ${command.description}`)
      .join('\n');

    await message.reply(
      `Halo, ini ${config.botName}.\n\n` +
        `Command yang tersedia:\n${commandList}`
    );
  }
};
