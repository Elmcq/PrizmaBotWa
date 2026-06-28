module.exports = {
  name: 'about',
  description: 'Tampilkan informasi bot.',
  async execute(message, { config }) {
    await message.reply(
      `🤖 ${config.botName}\n` +
        `Version : ${config.version}\n` +
        `Developer : ${config.developer}\n` +
        'Platform : Node.js\n' +
        'Library : whatsapp-web.js'
    );
  }
};
