module.exports = {
  name: 'ip',
  allowAnyGroup: true,
  description: 'Tampilkan IP server Minecraft.',
  async execute({ config, reply }) {
    const { name, ip, port } = config.server;

    await reply(
      `Server: ${name}\n` +
        `IP: ${ip}\n` +
        `Port: ${port}\n\n` +
        'Masuk pakai Minecraft Bedrock ya.'
    );
  }
};
