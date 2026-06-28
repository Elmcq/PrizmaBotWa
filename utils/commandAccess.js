const COMMAND_GROUP_REJECTION_MESSAGE = '❌ This group is not allowed to use bot commands.\n\n' +
  'Please use the official "Ideology Prizmarine Bot Commands" group.';

function isCommandGroupAllowed(message, config = {}) {
  if (!isGroupMessage(message)) {
    return true;
  }

  const allowedCommandGroups = Array.isArray(config.allowedCommandGroups)
    ? config.allowedCommandGroups
    : [];

  return allowedCommandGroups.includes(message.from);
}

function isGroupMessage(message) {
  return typeof message.from === 'string' && message.from.endsWith('@g.us');
}

module.exports = {
  COMMAND_GROUP_REJECTION_MESSAGE,
  isCommandGroupAllowed,
  isGroupMessage
};
