function normalizeJid(jid) {
  return String(jid || '')
    .trim()
    .replace(/:\d+@/, '@')
    .replace(/@c\.us$/i, '@s.whatsapp.net');
}

function parseJidList(value) {
  return String(value || '')
    .split(',')
    .map(normalizeJid)
    .filter(Boolean);
}

function isGroupJid(jid) {
  return normalizeJid(jid).endsWith('@g.us');
}

function isPersonalJid(jid) {
  const normalized = normalizeJid(jid);
  return normalized.endsWith('@s.whatsapp.net') || normalized.endsWith('@lid');
}

module.exports = {
  isGroupJid,
  isPersonalJid,
  normalizeJid,
  parseJidList
};
