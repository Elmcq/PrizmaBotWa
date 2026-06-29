module.exports = {
  name: 'groups',
  ownerOnly: true,
  allowAnyGroup: true,
  description: 'List all WhatsApp groups the bot participates in.',
  async execute({ sock, replyLong }) {
    const groups = await sock.groupFetchAllParticipating();
    const lines = Object.entries(groups)
      .map(([id, group]) => ({ ...group, id: group.id || id }))
      .sort((a, b) => String(a.subject || '').localeCompare(String(b.subject || '')))
      .flatMap((group) => [
        group.subject || 'Unnamed group',
        group.id
      ]);

    await replyLong(lines.length > 0 ? lines.join('\n') : 'No participating groups found.');
  }
};
