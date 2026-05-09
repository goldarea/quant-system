function hashSymbol(symbol) {
  return String(symbol).split('').reduce((hash, char) => hash + char.charCodeAt(0), 0);
}

function countForRange(range) {
  if (range === '1mo') return 24;
  if (range === '3mo') return 66;
  if (range === '6mo') return 126;
  if (range === '1y') return 252;
  if (range === '5y') return 520;
  return 720;
}

function previousTradingDays(count) {
  const days = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);

  while (days.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      days.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return days.reverse();
}

export function generateDemoBars(instrument, { range = '1mo' } = {}) {
  const seed = hashSymbol(instrument.symbol);
  const count = countForRange(range);
  const days = previousTradingDays(count);
  let close = instrument.market === 'CN' ? 20 + (seed % 180) : 80 + (seed % 220);

  return days.map((time, index) => {
    const wave = Math.sin((index + seed) / 7) * 0.018;
    const drift = (seed % 2 === 0 ? 0.0008 : -0.0002);
    const open = close;
    close = Math.max(1, close * (1 + wave + drift));
    const high = Math.max(open, close) * (1 + 0.008 + ((index + seed) % 5) * 0.001);
    const low = Math.min(open, close) * (1 - 0.008 - ((index + seed) % 4) * 0.001);
    const volume = 500000 + ((seed * 97 + index * 7919) % 3000000);

    return {
      time,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume
    };
  });
}
