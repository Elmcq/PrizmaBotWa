module.exports = {
  name: 'jid',
  ownerOnly: true,
  allowAnyGroup: true,
  description: 'Show current chat and sender JIDs.',
  async execute({ from, sender, isGroup, mentionedJids, reply }) {
    await reply(
      [
        `Chat JID: ${from || '-'}`,
        `Sender JID: ${sender || '-'}`,
        `Is group: ${Boolean(isGroup)}`,
        'Mentioned:',
        mentionedJids.length > 0 ? mentionedJids.join('\n') : '-'
      ].join('\n')
    );
  }
};
