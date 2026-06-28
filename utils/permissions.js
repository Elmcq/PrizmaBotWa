async function getGroupChat(message) {
  const chat = await message.getChat();

  return chat.isGroup ? chat : null;
}

function isGroupAdmin(message, chat) {
  const senderId = message.author || message.from;
  const participant = chat.participants.find((member) => {
    return member.id && member.id._serialized === senderId;
  });

  return Boolean(participant && (participant.isAdmin || participant.isSuperAdmin));
}

module.exports = {
  getGroupChat,
  isGroupAdmin
};
