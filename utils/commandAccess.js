const { isGroupJid, normalizeJid } = require('./jids');

const COMMAND_GROUP_REJECTION_MESSAGE = 'This group is not allowed to use bot commands.';

function getMessageFrom(message) {
  return message?.key?.remoteJid || message?.from || '';
}

function getMessageSender(message) {
  return message?.key?.participant || message?.author || message?.key?.remoteJid || message?.from || '';
}

function isCommandGroupAllowed(message, config = {}, command = {}) {
  const from = normalizeJid(getMessageFrom(message));

  if (!isGroupJid(from) || command.allowAnyGroup) {
    return true;
  }

  const allowed = config.allowedGroupJidSet || new Set(config.allowedGroupJids || config.allowedCommandGroups || []);
  return allowed.has(from);
}

function isOwner(message, config = {}) {
  const sender = normalizeJid(getMessageSender(message));
  const owners = config.ownerJidSet || new Set(config.ownerJids || config.ownerNumbers || []);
  return owners.has(sender);
}

function isGroupMessage(message) {
  return isGroupJid(getMessageFrom(message));
}

module.exports = {
  COMMAND_GROUP_REJECTION_MESSAGE,
  getMessageFrom,
  getMessageSender,
  isCommandGroupAllowed,
  isGroupMessage,
  isOwner
};
