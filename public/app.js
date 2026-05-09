const state = {
  selected: null,
  range: '1mo'
};

const elements = {
  healthStatus: document.querySelector('#healthStatus'),
  searchInput: document.querySelector('#searchInput'),
  searchButton: document.querySelector('#searchButton'),
  symbolList: document.querySelector('#symbolList'),
  instrumentTitle: document.querySelector('#instrumentTitle'),
  lastPrice: document.querySelector('#lastPrice'),
  lastTime: document.querySelector('#lastTime'),
  lastVolume: document.querySelector('#lastVolume'),
  dataSource: document.querySelector('#dataSource'),
  chart: document.querySelector('#chart'),
  message: document.querySelector('#message'),
  barsTable: document.querySelector('#barsTable')
};

async function api(path) {
  const response = await fetch(path);
  const payload = await response.json();
  if (!payload.ok) {
    const message = payload.error?.message || '请求失败';
    throw new Error(message);
  }
  return payload.data;
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

function formatVolume(value) {
  if (!Number.isFinite(Number(value))) return '-';
  const number = Number(value);
  if (number >= 100000000) return `${formatNumber(number / 100000000, 2)}亿`;
  if (number >= 10000) return `${formatNumber(number / 10000, 2)}万`;
  return Math.round(number).toLocaleString('zh-CN');
}

function setMessage(text, hidden = false) {
  elements.message.textContent = text;
  elements.message.classList.toggle('hidden', hidden);
}

function clearChart() {
  elements.chart.replaceChildren();
  elements.barsTable.replaceChildren();
}

function renderSymbols(symbols) {
  elements.symbolList.replaceChildren();

  symbols.forEach((instrument) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'symbol-item';
    if (state.selected?.symbol === instrument.symbol) {
      button.classList.add('active');
    }

    const code = document.createElement('span');
    code.className = 'symbol-code';
    code.textContent = `${instrument.symbol} · ${instrument.market}`;

    const name = document.createElement('span');
    name.className = 'symbol-name';
    name.textContent = instrument.localName
      ? `${instrument.localName} / ${instrument.name}`
      : instrument.name;

    button.append(code, name);
    button.addEventListener('click', () => selectInstrument(instrument));
    elements.symbolList.append(button);
  });
}

async function search() {
  const query = elements.searchInput.value.trim();
  setMessage('正在搜索...');
  const symbols = await api(`/api/search?q=${encodeURIComponent(query)}`);
  renderSymbols(symbols);
  if (symbols.length > 0 && !state.selected) {
    await selectInstrument(symbols[0]);
  } else if (symbols.length === 0) {
    setMessage('没有找到匹配标的。');
  } else {
    setMessage('请选择一个搜索结果。');
  }
}

function renderQuoteFromBars(history) {
  const last = history.bars.at(-1);
  if (!last) {
    elements.lastPrice.textContent = '-';
    elements.lastTime.textContent = '-';
    elements.lastVolume.textContent = '-';
    elements.dataSource.textContent = history.source || '-';
    return;
  }

  elements.lastPrice.textContent = formatNumber(last.close);
  elements.lastTime.textContent = last.time;
  elements.lastVolume.textContent = formatVolume(last.volume);
  const sourceLabels = {
    cache: '缓存',
    live: '实时请求',
    demo: '演示数据'
  };
  elements.dataSource.textContent = sourceLabels[history.source] || history.source || '-';
}

function chartScales(bars) {
  const width = 960;
  const height = 420;
  const padding = { top: 24, right: 58, bottom: 36, left: 58 };
  const values = bars.flatMap((bar) => [bar.high, bar.low]).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  return {
    width,
    height,
    padding,
    x: (index) => {
      const usable = width - padding.left - padding.right;
      return padding.left + (bars.length === 1 ? usable / 2 : index * usable / (bars.length - 1));
    },
    y: (value) => {
      const usable = height - padding.top - padding.bottom;
      return padding.top + (max - value) * usable / span;
    },
    min,
    max
  };
}

function svgElement(name, attrs = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function renderChart(bars) {
  elements.chart.replaceChildren();
  if (!bars.length) {
    setMessage('没有可显示的数据。');
    return;
  }

  setMessage('', true);
  const scales = chartScales(bars);
  const grid = svgElement('g', { class: 'grid' });
  const chart = svgElement('g');

  for (let i = 0; i <= 4; i += 1) {
    const y = scales.padding.top + i * (scales.height - scales.padding.top - scales.padding.bottom) / 4;
    const value = scales.max - i * (scales.max - scales.min) / 4;
    grid.append(svgElement('line', {
      x1: scales.padding.left,
      x2: scales.width - scales.padding.right,
      y1: y,
      y2: y,
      stroke: '#e7ebf0',
      'stroke-width': '1'
    }));
    const label = svgElement('text', {
      x: scales.width - scales.padding.right + 8,
      y: y + 4,
      fill: '#607086',
      'font-size': '12'
    });
    label.textContent = formatNumber(value);
    grid.append(label);
  }

  const candleWidth = Math.max(3, Math.min(14, 620 / bars.length));
  bars.forEach((bar, index) => {
    const x = scales.x(index);
    const color = bar.close >= bar.open ? '#ba2f2f' : '#18875a';
    const highY = scales.y(bar.high);
    const lowY = scales.y(bar.low);
    const openY = scales.y(bar.open);
    const closeY = scales.y(bar.close);
    const bodyY = Math.min(openY, closeY);
    const bodyHeight = Math.max(1, Math.abs(closeY - openY));

    chart.append(svgElement('line', {
      x1: x,
      x2: x,
      y1: highY,
      y2: lowY,
      stroke: color,
      'stroke-width': '1.5'
    }));

    chart.append(svgElement('rect', {
      x: x - candleWidth / 2,
      y: bodyY,
      width: candleWidth,
      height: bodyHeight,
      fill: color,
      opacity: '0.82'
    }));
  });

  const closes = bars.map((bar, index) => `${scales.x(index)},${scales.y(bar.close)}`).join(' ');
  chart.append(svgElement('polyline', {
    points: closes,
    fill: 'none',
    stroke: '#1264a3',
    'stroke-width': '2',
    opacity: '0.72'
  }));

  const firstLabel = svgElement('text', {
    x: scales.padding.left,
    y: scales.height - 12,
    fill: '#607086',
    'font-size': '12'
  });
  firstLabel.textContent = bars[0].time;

  const lastLabel = svgElement('text', {
    x: scales.width - scales.padding.right,
    y: scales.height - 12,
    fill: '#607086',
    'font-size': '12',
    'text-anchor': 'end'
  });
  lastLabel.textContent = bars.at(-1).time;

  elements.chart.append(grid, chart, firstLabel, lastLabel);
}

function renderTable(bars) {
  elements.barsTable.replaceChildren();
  bars.slice(-80).reverse().forEach((bar) => {
    const tr = document.createElement('tr');
    const direction = bar.close >= bar.open ? 'up' : 'down';
    tr.innerHTML = `
      <td>${bar.time}</td>
      <td>${formatNumber(bar.open)}</td>
      <td>${formatNumber(bar.high)}</td>
      <td>${formatNumber(bar.low)}</td>
      <td class="${direction}">${formatNumber(bar.close)}</td>
      <td>${formatVolume(bar.volume)}</td>
    `;
    elements.barsTable.append(tr);
  });
}

async function loadHistory() {
  if (!state.selected) return;

  clearChart();
  setMessage('正在获取行情数据...');
  elements.instrumentTitle.textContent = `${state.selected.symbol} · ${state.selected.localName || state.selected.name}`;

  try {
    const params = new URLSearchParams({
      symbol: state.selected.symbol,
      range: state.range,
      interval: '1d'
    });
    const history = await api(`/api/history?${params}`);
    renderQuoteFromBars(history);
    renderChart(history.bars);
    renderTable(history.bars);
    if (history.warning) {
      setMessage(history.warning.message);
    }
  } catch (error) {
    setMessage(error.message);
    elements.lastPrice.textContent = '-';
    elements.lastTime.textContent = '-';
    elements.lastVolume.textContent = '-';
    elements.dataSource.textContent = '-';
  }
}

async function selectInstrument(instrument) {
  state.selected = instrument;
  renderSymbols([...elements.symbolList.querySelectorAll('.symbol-item')].length ? await api(`/api/search?q=${encodeURIComponent(elements.searchInput.value.trim())}`) : [instrument]);
  await loadHistory();
}

async function checkHealth() {
  try {
    await api('/api/health');
    elements.healthStatus.textContent = '已连接';
  } catch {
    elements.healthStatus.textContent = '未连接';
  }
}

elements.searchButton.addEventListener('click', () => {
  search().catch((error) => setMessage(error.message));
});

elements.searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    search().catch((error) => setMessage(error.message));
  }
});

document.querySelectorAll('.range').forEach((button) => {
  button.addEventListener('click', () => {
    state.range = button.dataset.range;
    document.querySelectorAll('.range').forEach((item) => item.classList.toggle('active', item === button));
    loadHistory().catch((error) => setMessage(error.message));
  });
});

checkHealth();
search().catch((error) => setMessage(error.message));
