module.exports = {
  name: 'groupid',
  prefixes: ['/', '!'],
  ownerOnly: true,
  allowAnyGroup: true,
  description: 'Tampilkan Chat JID, Sender JID, dan mention.',
  async execute({ from, sender, isGroup, mentionedJids, reply }) {
    await reply(formatJidReply(from, sender, isGroup, mentionedJids));
  }
};

function formatJidReply(from, sender, isGroup, mentionedJids) {
  return [
    `Chat JID: ${from || '-'}`,
    `Sender JID: ${sender || '-'}`,
    `Is group: ${Boolean(isGroup)}`,
    'Mentioned:',
    mentionedJids.length > 0 ? mentionedJids.join('\n') : '-'
  ].join('\n');
}
