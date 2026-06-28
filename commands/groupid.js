const { getGroupChat, isGroupAdmin } = require('../utils/permissions');

module.exports = {
  name: 'groupid',
  prefix: '!',
  description: 'Tampilkan informasi grup.',
  async execute(message) {
    const chat = await getGroupChat(message);

    if (!chat) {
      await message.reply('This command can only be used in a group.');
      return;
    }

    if (!isGroupAdmin(message, chat)) {
      await message.reply('You do not have permission to use this command.');
      return;
    }

    await message.reply(
      '📋 Group Information\n\n' +
        `Name: ${chat.name}\n` +
        `Group ID: ${chat.id._serialized}\n` +
        `Members: ${chat.participants.length}`
    );
  }
};
