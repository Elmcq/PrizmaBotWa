module.exports = {
  name: 'ip',
  description: 'Tampilkan IP server Minecraft.',
  async execute(message, { config }) {
    const { name, ip, port } = config.server;

    await message.reply(
      `Server: ${name}\n` +
        `IP: ${ip}\n` +
        `Port: ${port}\n\n` +
        'Masuk pakai Minecraft Bedrock ya.'
    );
  }
};
