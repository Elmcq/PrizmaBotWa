const { getMessageSender, isOwner } = require('./commandAccess');
const { normalizeJid } = require('./jids');

async function getGroupChat() {
  return null;
}

function isOwnerNumber(message, config = {}) {
  return isOwner(message, config);
}

function isGroupAdmin(message, chat, config = {}) {
  if (isOwner(message, config)) {
    return true;
  }

  const sender = normalizeJid(getMessageSender(message));
  const participants = Array.isArray(chat?.participants) ? chat.participants : [];

  return participants.some((member) => {
    const id = normalizeJid(member.id?._serialized || member.id || member.jid);
    return id === sender && (member.isAdmin || member.isSuperAdmin || member.admin);
  });
}

module.exports = {
  getGroupChat,
  isGroupAdmin,
  isOwnerNumber
};
