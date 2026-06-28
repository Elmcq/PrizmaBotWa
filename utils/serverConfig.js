const PLACEHOLDER_IPS = new Set([
  'ISI_IP_SERVER_DI_SINI',
  'IP_SERVER',
  'YOUR_SERVER_IP',
  'example.com'
]);

function isServerConfigReady(server) {
  const ip = typeof server.ip === 'string' ? server.ip.trim() : '';
  const port = Number(server.port);

  return Boolean(ip) && !PLACEHOLDER_IPS.has(ip) && Number.isInteger(port) && port > 0 && port <= 65535;
}

module.exports = {
  isServerConfigReady
};
