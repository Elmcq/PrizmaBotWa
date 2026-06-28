async function getGroupChat(message) {
  const chat = await message.getChat();

  return chat.isGroup ? chat : null;
}

function isOwnerNumber(message, config = {}) {
  const senderId = message.author || message.from;
  const ownerNumbers = Array.isArray(config.ownerNumbers) ? config.ownerNumbers : [];

  return ownerNumbers.includes(senderId);
}

function isGroupAdmin(message, chat, config = {}) {
  if (isOwnerNumber(message, config)) {
    return true;
  }

  const senderId = message.author || message.from;
  const participant = chat.participants.find((member) => {
    return member.id && member.id._serialized === senderId;
  });

  return Boolean(participant && (participant.isAdmin || participant.isSuperAdmin));
}

module.exports = {
  getGroupChat,
  isGroupAdmin,
  isOwnerNumber
};
