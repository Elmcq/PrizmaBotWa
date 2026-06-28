function formatUptime(totalSeconds) {
  const seconds = Math.floor(totalSeconds);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts = [];

  if (days > 0) {
    parts.push(`${days} hari`);
  }

  if (hours > 0) {
    parts.push(`${hours} jam`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} menit`);
  }

  parts.push(`${remainingSeconds} detik`);

  return parts.join(' ');
}

function formatCompactUptime(totalSeconds) {
  const seconds = Math.floor(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(remainingSeconds).padStart(2, '0')}s`;
}

function formatClock(date = new Date()) {
  return [
    date.getHours(),
    date.getMinutes(),
    date.getSeconds()
  ].map((value) => String(value).padStart(2, '0')).join(':');
}

function formatWibDateTime(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta'
  });

  return `${formatter.format(date).replace(',', '')} WIB`;
}

module.exports = {
  formatUptime,
  formatCompactUptime,
  formatClock,
  formatWibDateTime
};
