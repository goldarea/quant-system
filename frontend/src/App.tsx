import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Empty,
  InputNumber,
  Layout,
  List,
  Radio,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
  Alert
} from '@arco-design/web-react';
import { IconDashboard, IconDelete, IconPlus, IconStar, IconSync } from '@arco-design/web-react/icon';

import { ApiError, getHealth, getHistory, getIndicators, getPortfolioBacktest, getQuote, getStrategies, getStrategyBacktest, importHistoryCsv, searchSymbols } from './api/client';
import type {
  BacktestResponse,
  HealthResponse,
  HistoryInterval,
  HistoryRange,
  HistoryResponse,
  IndicatorsResponse,
  Instrument,
  PortfolioBacktestResponse,
  Quote,
  StrategyDefinition
} from './api/types';
import EquityCurveChart from './components/EquityCurveChart';
import HistoryTable from './components/HistoryTable';
import KLineChart from './components/KLineChart';
import QuoteSummary from './components/QuoteSummary';
import SymbolSearch from './components/SymbolSearch';

const { Header, Content, Sider } = Layout;
const { Text, Title } = Typography;

const ranges: Array<{ label: string; value: HistoryRange }> = [
  { label: '1月', value: '1mo' },
  { label: '3月', value: '3mo' },
  { label: '6月', value: '6mo' },
  { label: '1年', value: '1y' },
  { label: '5年', value: '5y' }
];

const intervals: Array<{ label: string; value: HistoryInterval }> = [
  { label: '日线', value: '1d' },
  { label: '周线', value: '1wk' },
  { label: '月线', value: '1mo' }
];

const watchlistStorageKey = 'quant-system.watchlist';

function loadWatchlist(): Instrument[] {
  try {
    const raw = localStorage.getItem(watchlistStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWatchlist(items: Instrument[]) {
  localStorage.setItem(watchlistStorageKey, JSON.stringify(items));
}

function latestWhere<T>(items: T[] | undefined, predicate: (item: T) => boolean) {
  if (!items) return undefined;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) return items[index];
  }
  return undefined;
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return `${error.code}: ${error.message}`;
  if (error instanceof Error) return error.message;
  return '未知错误';
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [query, setQuery] = useState('AAPL');
  const [results, setResults] = useState<Instrument[]>([]);
  const [selected, setSelected] = useState<Instrument | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [indicators, setIndicators] = useState<IndicatorsResponse | null>(null);
  const [backtest, setBacktest] = useState<BacktestResponse | null>(null);
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [strategyId, setStrategyId] = useState('ma_crossover');
  const [strategyParameters, setStrategyParameters] = useState<Record<string, number | string>>({});
  const [portfolioBacktest, setPortfolioBacktest] = useState<PortfolioBacktestResponse | null>(null);
  const [range, setRange] = useState<HistoryRange>('1y');
  const [interval, setInterval] = useState<HistoryInterval>('1d');
  const [searchLoading, setSearchLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [portfolioBacktestError, setPortfolioBacktestError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [portfolioBacktestLoading, setPortfolioBacktestLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [visibleAverages, setVisibleAverages] = useState({ ma5: true, ma20: true, ma60: false });
  const [showMacd, setShowMacd] = useState(true);
  const [showRsi, setShowRsi] = useState(true);
  const [watchlist, setWatchlist] = useState<Instrument[]>(() => loadWatchlist());

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === strategyId),
    [strategies, strategyId]
  );

  const strategyParamSignature = useMemo(
    () => JSON.stringify(strategyParameters),
    [strategyParameters]
  );

  const selectedInWatchlist = selected ? watchlist.some((item) => item.symbol === selected.symbol) : false;

  const updateWatchlist = useCallback((nextItems: Instrument[]) => {
    setWatchlist(nextItems);
    saveWatchlist(nextItems);
  }, []);

  const addSelectedToWatchlist = useCallback(() => {
    if (!selected || selectedInWatchlist) return;
    updateWatchlist([...watchlist, selected]);
  }, [selected, selectedInWatchlist, updateWatchlist, watchlist]);

  const removeFromWatchlist = useCallback((symbol: string) => {
    updateWatchlist(watchlist.filter((item) => item.symbol !== symbol));
  }, [updateWatchlist, watchlist]);

  const runSearch = useCallback(async (nextQuery: string) => {
    setSearchLoading(true);
    setError(null);
    try {
      const instruments = await searchSymbols(nextQuery);
      setResults(instruments);
      if (!selected && instruments[0]) {
        setSelected(instruments[0]);
      }
    } catch (searchError) {
      setError(errorMessage(searchError));
    } finally {
      setSearchLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((healthError) => setError(errorMessage(healthError)));
    getStrategies()
      .then((nextStrategies) => {
        setStrategies(nextStrategies);
        const defaultStrategy = nextStrategies.find((strategy) => strategy.id === strategyId) ?? nextStrategies[0];
        if (defaultStrategy) {
          setStrategyId(defaultStrategy.id);
          setStrategyParameters(Object.fromEntries(defaultStrategy.parameters.map((parameter) => [parameter.id, parameter.default])));
        }
      })
      .catch((strategyError) => setError(errorMessage(strategyError)));
  }, []);

  useEffect(() => {
    runSearch('AAPL');
  }, [runSearch]);

  useEffect(() => {
    if (!selected) return;

    let cancelled = false;
    setDataLoading(true);
    setError(null);

    Promise.all([
      getQuote(selected.symbol),
      getHistory({ symbol: selected.symbol, range, interval }),
      getIndicators({ symbol: selected.symbol, range, interval })
    ])
      .then(([nextQuote, nextHistory, nextIndicators]) => {
        if (cancelled) return;
        setQuote(nextQuote);
        setHistory(nextHistory);
        setIndicators(nextIndicators);
      })
      .catch((dataError) => {
        if (!cancelled) setError(errorMessage(dataError));
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected, range, interval, refreshToken]);

  useEffect(() => {
    const nextStrategy = strategies.find((strategy) => strategy.id === strategyId);
    if (!nextStrategy) return;
    setStrategyParameters((current) => Object.fromEntries(
      nextStrategy.parameters.map((parameter) => [parameter.id, current[parameter.id] ?? parameter.default])
    ));
  }, [strategies, strategyId]);

  useEffect(() => {
    if (!selected || !selectedStrategy) return;

    let cancelled = false;
    setBacktestLoading(true);
    setBacktestError(null);

    getStrategyBacktest({
      strategy: strategyId,
      symbol: selected.symbol,
      range,
      interval,
      parameters: strategyParameters
    })
      .then((nextBacktest) => {
        if (!cancelled) setBacktest(nextBacktest);
      })
      .catch((dataError) => {
        if (!cancelled) {
          setBacktest(null);
          setBacktestError(errorMessage(dataError));
        }
      })
      .finally(() => {
        if (!cancelled) setBacktestLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected, selectedStrategy, strategyId, range, interval, strategyParamSignature, refreshToken]);

  const portfolioSymbols = useMemo(() => watchlist.map((item) => item.symbol), [watchlist]);

  useEffect(() => {
    if (portfolioSymbols.length < 2) {
      setPortfolioBacktest(null);
      setPortfolioBacktestError(null);
      return;
    }

    let cancelled = false;
    setPortfolioBacktestLoading(true);
    setPortfolioBacktestError(null);

    getPortfolioBacktest({
      symbols: portfolioSymbols,
      range,
      interval,
      initialCapital: Number(strategyParameters.initialCapital) || 100000
    })
      .then((nextBacktest) => {
        if (!cancelled) setPortfolioBacktest(nextBacktest);
      })
      .catch((dataError) => {
        if (!cancelled) {
          setPortfolioBacktest(null);
          setPortfolioBacktestError(errorMessage(dataError));
        }
      })
      .finally(() => {
        if (!cancelled) setPortfolioBacktestLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [portfolioSymbols, range, interval, strategyParameters.initialCapital, refreshToken]);

  const handleCsvImport = useCallback(async (file: File | undefined) => {
    if (!file || !selected) return;

    setImportLoading(true);
    setError(null);
    setImportMessage(null);
    try {
      const result = await importHistoryCsv(
        { symbol: selected.symbol, range, interval },
        await file.text()
      );
      setImportMessage(`已导入 ${result.imported} 条历史行情`);
      setRefreshToken((current) => current + 1);
    } catch (importError) {
      setError(errorMessage(importError));
    } finally {
      setImportLoading(false);
    }
  }, [selected, range, interval]);

  const source = history?.source || quote?.source;
  const bars = useMemo(() => history?.bars ?? [], [history]);
  const latestMacd = useMemo(() => latestWhere(indicators?.macd, (point) => point.histogram !== null), [indicators]);
  const latestRsi = useMemo(() => latestWhere(indicators?.rsi14, (point) => point.value !== null), [indicators]);

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <div>
          <Space size={8} align="center">
            <IconDashboard className="brand-icon" />
            <Title heading={4}>Quant System</Title>
          </Space>
          <Text type="secondary">Vite React + Arco Design + ECharts</Text>
        </div>
        <Space wrap>
          <Tag color={health?.status === 'ok' ? 'green' : 'gray'}>
            API {health?.status ?? 'unknown'}
          </Tag>
          {source && <Tag color={source === 'demo' ? 'orange' : 'arcoblue'}>{source}</Tag>}
          <Tag icon={<IconSync />}>proxy :8000</Tag>
        </Space>
      </Header>

      <Layout className="workspace">
        <Sider className="sidebar" width={312}>
          <Card
            title="自选股"
            bordered={false}
            className="panel watchlist-panel"
            extra={(
              <Button
                size="mini"
                type="primary"
                icon={<IconPlus />}
                disabled={!selected || selectedInWatchlist}
                onClick={addSelectedToWatchlist}
              >
                加入
              </Button>
            )}
          >
            <List
              size="small"
              dataSource={watchlist}
              noDataElement={<Empty description="暂无自选股" />}
              render={(instrument) => (
                <List.Item
                  key={instrument.symbol}
                  className={instrument.symbol === selected?.symbol ? 'symbol-item active' : 'symbol-item'}
                  onClick={() => setSelected(instrument)}
                  actions={[
                    <Button
                      key="remove"
                      size="mini"
                      type="text"
                      icon={<IconDelete />}
                      onClick={(event) => {
                        event.stopPropagation();
                        removeFromWatchlist(instrument.symbol);
                      }}
                    />
                  ]}
                >
                  <div className="symbol-row">
                    <div>
                      <Space size={6}>
                        <IconStar className="watchlist-star" />
                        <Text className="symbol-code">{instrument.symbol}</Text>
                        <Tag size="small">{instrument.market}</Tag>
                      </Space>
                      <Text type="secondary" className="symbol-name">{instrument.localName || instrument.name}</Text>
                    </div>
                    <Text type="secondary">{instrument.exchange}</Text>
                  </div>
                </List.Item>
              )}
            />
          </Card>

          <Card title="标的搜索" bordered={false} className="panel">
            <SymbolSearch
              query={query}
              results={results}
              loading={searchLoading}
              selectedSymbol={selected?.symbol}
              onQueryChange={setQuery}
              onSearch={runSearch}
              onSelect={setSelected}
            />
          </Card>
        </Sider>

        <Content className="main-content">
          {error && (
            <Alert
              className="top-alert"
              type="error"
              title="请求失败"
              content={error}
              showIcon
            />
          )}

          {history?.warning && (
            <Alert
              className="top-alert"
              type="warning"
              title="正在使用演示数据"
              content={history.warning.message}
              showIcon
            />
          )}

          {importMessage && (
            <Alert
              className="top-alert"
              type="success"
              title="导入完成"
              content={importMessage}
              showIcon
            />
          )}

          <QuoteSummary quote={quote} />

          <Card bordered={false} className="panel chart-panel">
            <div className="chart-toolbar">
              <Space>
                <Radio.Group
                  type="button"
                  size="small"
                  value={range}
                  onChange={setRange}
                  options={ranges}
                />
                <Radio.Group
                  type="button"
                  size="small"
                  value={interval}
                  onChange={setInterval}
                  options={intervals}
                />
              </Space>
              <Space wrap>
                <Button
                  size="small"
                  loading={importLoading}
                  disabled={!selected}
                  onClick={() => document.getElementById('history-csv-input')?.click()}
                >
                  导入CSV
                </Button>
                <input
                  id="history-csv-input"
                  className="hidden-file-input"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    void handleCsvImport(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
                <Checkbox
                  checked={visibleAverages.ma5}
                  onChange={(checked) => setVisibleAverages((current) => ({ ...current, ma5: checked }))}
                >
                  MA5
                </Checkbox>
                <Checkbox
                  checked={visibleAverages.ma20}
                  onChange={(checked) => setVisibleAverages((current) => ({ ...current, ma20: checked }))}
                >
                  MA20
                </Checkbox>
                <Checkbox
                  checked={visibleAverages.ma60}
                  onChange={(checked) => setVisibleAverages((current) => ({ ...current, ma60: checked }))}
                >
                  MA60
                </Checkbox>
                <Text type="secondary">{bars.length} bars</Text>
                {history?.quality && (
                  <Tag color={history.quality.invalidBars || history.quality.duplicateBars ? 'red' : history.quality.missingBars || history.quality.stale ? 'orange' : 'green'}>
                    Quality {history.quality.issues.length ? `${history.quality.issues.length} issues` : 'ok'}
                  </Tag>
                )}
              </Space>
            </div>

            <Spin loading={dataLoading} block>
              {bars.length ? (
                <KLineChart
                  bars={bars}
                  visibleAverages={visibleAverages}
                  averages={{ ma5: indicators?.ma5, ma20: indicators?.ma20, ma60: indicators?.ma60 }}
                  trades={backtest?.trades}
                />
              ) : (
                <div className="empty-chart">
                  <Text type="secondary">暂无历史行情。</Text>
                </div>
              )}
            </Spin>
          </Card>

          {history?.quality && (
            <Card bordered={false} className="panel indicator-panel">
              <div className="indicator-toolbar">
                <Space wrap>
                  <Text bold>数据质量</Text>
                  <Tag>{history.quality.market}</Tag>
                  <Tag>{history.quality.expectedInterval}</Tag>
                </Space>
                <Tag color={history.quality.invalidBars || history.quality.duplicateBars ? 'red' : history.quality.missingBars || history.quality.stale ? 'orange' : 'green'}>
                  {history.quality.issues.length ? `${history.quality.issues.length} issues` : 'clean'}
                </Tag>
              </div>
              <div className="indicator-summary">
                <Card size="small" bordered={false} className="indicator-card">
                  <Text type="secondary">总 bars</Text>
                  <Title heading={6}>{history.quality.totalBars}</Title>
                  <Text type="secondary">当前来源 {history.source}</Text>
                </Card>
                <Card size="small" bordered={false} className="indicator-card">
                  <Text type="secondary">缺失</Text>
                  <Title heading={6}>{history.quality.missingBars}</Title>
                  <Text type="secondary">按交易日历估算</Text>
                </Card>
                <Card size="small" bordered={false} className="indicator-card">
                  <Text type="secondary">异常</Text>
                  <Title heading={6}>{history.quality.invalidBars}</Title>
                  <Text type="secondary">重复 {history.quality.duplicateBars}</Text>
                </Card>
                <Card size="small" bordered={false} className="indicator-card">
                  <Text type="secondary">时效</Text>
                  <Title heading={6}>{history.quality.stale ? 'Stale' : 'OK'}</Title>
                  <Text type="secondary">最近 {bars[bars.length - 1]?.time ?? '-'}</Text>
                </Card>
              </div>
              {history.quality.issues.length > 0 && (
                <List
                  size="small"
                  className="backtest-trades"
                  dataSource={history.quality.issues.slice(0, 6)}
                  render={(issue) => (
                    <List.Item key={`${issue.code}-${issue.time ?? issue.message}`}>
                      <Space wrap>
                        <Tag color={issue.severity === 'error' ? 'red' : 'orange'}>{issue.code}</Tag>
                        <Text>{issue.time ?? '-'}</Text>
                        <Text type="secondary">{issue.message}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          )}

          <Card bordered={false} className="panel indicator-panel">
            <div className="indicator-toolbar">
              <Space wrap>
                <Checkbox checked={showMacd} onChange={setShowMacd}>MACD</Checkbox>
                <Checkbox checked={showRsi} onChange={setShowRsi}>RSI14</Checkbox>
              </Space>
              <Tag color={indicators?.source === 'demo' ? 'orange' : 'arcoblue'}>{indicators?.source ?? 'indicator'}</Tag>
            </div>
            <div className="indicator-summary">
              {showMacd && (
                <Card size="small" bordered={false} className="indicator-card">
                  <Text type="secondary">MACD</Text>
                  <Title heading={6}>{latestMacd?.histogram ?? '-'}</Title>
                  <Text type="secondary">DIF {latestMacd?.dif ?? '-'} / DEA {latestMacd?.dea ?? '-'}</Text>
                </Card>
              )}
              {showRsi && (
                <Card size="small" bordered={false} className="indicator-card">
                  <Text type="secondary">RSI14</Text>
                  <Title heading={6}>{latestRsi?.value ?? '-'}</Title>
                  <Text type="secondary">{latestRsi?.time ?? '暂无数据'}</Text>
                </Card>
              )}
            </div>
          </Card>

          <Card bordered={false} className="panel backtest-panel">
            <div className="indicator-toolbar">
              <Space wrap>
                <Text bold>策略回测</Text>
                <Select
                  size="small"
                  value={strategyId}
                  style={{ width: 180 }}
                  onChange={(value) => setStrategyId(value)}
                  options={strategies.map((strategy) => ({ label: strategy.name, value: strategy.id }))}
                />
                <Tag>{selectedStrategy?.name ?? 'strategy'}</Tag>
              </Space>
              <Tag color={backtest?.source === 'demo' ? 'orange' : 'arcoblue'}>{backtest?.source ?? 'backtest'}</Tag>
            </div>
            <Spin loading={backtestLoading} block>
              <div className="backtest-controls">
                <Space wrap>
                  {selectedStrategy?.parameters.map((parameter) => (
                    <Space key={parameter.id} size={6}>
                      <Text type="secondary">{parameter.label}</Text>
                      <InputNumber
                        size="small"
                        min={parameter.min}
                        max={parameter.max}
                        step={parameter.step}
                        value={Number(strategyParameters[parameter.id] ?? parameter.default)}
                        onChange={(value) => {
                          const nextValue = Number(value);
                          setStrategyParameters((current) => ({
                            ...current,
                            [parameter.id]: Number.isFinite(nextValue) ? nextValue : parameter.default
                          }));
                        }}
                      />
                    </Space>
                  ))}
                </Space>
              </div>
              {backtestError && (
                <Alert
                  className="backtest-alert"
                  type="error"
                  title="回测失败"
                  content={backtestError}
                  showIcon
                />
              )}
              {backtest ? (
              <>
                <div className="indicator-summary">
                  <Card size="small" bordered={false} className="indicator-card">
                    <Text type="secondary">最终权益</Text>
                    <Title heading={6}>{backtest.summary.finalEquity}</Title>
                    <Text type="secondary">初始 {backtest.summary.initialCapital}</Text>
                  </Card>
                  <Card size="small" bordered={false} className="indicator-card">
                    <Text type="secondary">总收益</Text>
                    <Title heading={6}>{backtest.summary.totalReturnPct}%</Title>
                    <Text type="secondary">最大回撤 {backtest.summary.maxDrawdownPct}%</Text>
                  </Card>
                  <Card size="small" bordered={false} className="indicator-card">
                    <Text type="secondary">交易</Text>
                    <Title heading={6}>{backtest.summary.tradeCount}</Title>
                    <Text type="secondary">胜率 {backtest.summary.winRatePct}%</Text>
                    <Text type="secondary">费用 {backtest.summary.totalFees}</Text>
                  </Card>
                </div>
                <div className="backtest-report-grid">
                  <Card size="small" bordered={false} className="indicator-card">
                    <Text type="secondary">收益风险</Text>
                    <Title heading={6}>{backtest.summary.annualizedReturnPct}%</Title>
                    <Text type="secondary">年化波动 {backtest.summary.annualizedVolatilityPct}%</Text>
                    <Text type="secondary">Sharpe {backtest.summary.sharpeRatio} / Calmar {backtest.summary.calmarRatio}</Text>
                  </Card>
                  <Card size="small" bordered={false} className="indicator-card">
                    <Text type="secondary">回撤区间</Text>
                    <Title heading={6}>{backtest.drawdown.maxDrawdownPct}%</Title>
                    <Text type="secondary">{backtest.drawdown.start || '-'} → {backtest.drawdown.end || '-'}</Text>
                    <Text type="secondary">持续 {backtest.drawdown.durationBars} bars</Text>
                  </Card>
                  <Card size="small" bordered={false} className="indicator-card">
                    <Text type="secondary">交易质量</Text>
                    <Title heading={6}>{backtest.tradeMetrics.profitFactor}</Title>
                    <Text type="secondary">盈亏比 {backtest.tradeMetrics.payoffRatio}</Text>
                    <Text type="secondary">平均持仓 {backtest.tradeMetrics.averageHoldingBars} bars</Text>
                  </Card>
                  <Card size="small" bordered={false} className="indicator-card">
                    <Text type="secondary">买入持有基准</Text>
                    <Title heading={6}>{backtest.benchmark.totalReturnPct}%</Title>
                    <Text type="secondary">最终权益 {backtest.benchmark.finalEquity}</Text>
                    <Text type="secondary">超额收益 {backtest.benchmark.excessReturnPct}%</Text>
                  </Card>
                </div>
                {backtest.equityCurve.length > 0 && <EquityCurveChart points={backtest.equityCurve} />}
                <List
                  size="small"
                  className="backtest-trades"
                  dataSource={backtest.trades.slice(-5).reverse()}
                  noDataElement={<Empty description="暂无交易信号" />}
                  render={(trade) => (
                    <List.Item key={`${trade.time}-${trade.side}`}>
                      <Space wrap>
                        <Tag color={trade.side === 'buy' ? 'red' : 'green'}>{trade.side}</Tag>
                        <Text>{trade.time}</Text>
                        <Text type="secondary">price {trade.price}</Text>
                        <Text type="secondary">qty {trade.quantity}</Text>
                        <Text type="secondary">fee {trade.fee}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </>
            ) : (
              <Empty description="暂无回测结果" />
            )}
            </Spin>
          </Card>

          <Card bordered={false} className="panel backtest-panel">
            <div className="indicator-toolbar">
              <Space wrap>
                <Text bold>组合回测</Text>
                <Tag>等权</Tag>
                <Tag>{portfolioSymbols.length} symbols</Tag>
              </Space>
              <Tag color={portfolioBacktest ? 'arcoblue' : 'gray'}>{portfolioBacktest?.allocation ?? 'portfolio'}</Tag>
            </div>
            <Spin loading={portfolioBacktestLoading} block>
              {portfolioBacktestError && (
                <Alert
                  className="backtest-alert"
                  type="error"
                  title="组合回测失败"
                  content={portfolioBacktestError}
                  showIcon
                />
              )}
              {portfolioBacktest ? (
                <>
                  <div className="indicator-summary">
                    <Card size="small" bordered={false} className="indicator-card">
                      <Text type="secondary">组合权益</Text>
                      <Title heading={6}>{portfolioBacktest.summary.finalEquity}</Title>
                      <Text type="secondary">初始 {portfolioBacktest.summary.initialCapital}</Text>
                    </Card>
                    <Card size="small" bordered={false} className="indicator-card">
                      <Text type="secondary">组合收益</Text>
                      <Title heading={6}>{portfolioBacktest.summary.totalReturnPct}%</Title>
                      <Text type="secondary">标的数 {portfolioBacktest.summary.symbolCount}</Text>
                    </Card>
                    <Card size="small" bordered={false} className="indicator-card">
                      <Text type="secondary">贡献</Text>
                      <Title heading={6}>{portfolioBacktest.summary.bestSymbol}</Title>
                      <Text type="secondary">最弱 {portfolioBacktest.summary.worstSymbol}</Text>
                    </Card>
                  </div>
                  {portfolioBacktest.equityCurve.length > 0 && <EquityCurveChart points={portfolioBacktest.equityCurve} />}
                  <List
                    size="small"
                    className="backtest-trades"
                    dataSource={portfolioBacktest.positions}
                    noDataElement={<Empty description="暂无组合持仓" />}
                    render={(position) => (
                      <List.Item key={position.symbol}>
                        <Space wrap>
                          <Tag>{position.symbol}</Tag>
                          <Text>{position.name}</Text>
                          <Text type="secondary">weight {position.weightPct}%</Text>
                          <Text type="secondary">return {position.returnPct}%</Text>
                          <Text type="secondary">value {position.marketValue}</Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                </>
              ) : (
                <Empty description="自选股至少需要 2 个标的才能运行组合回测" />
              )}
            </Spin>
          </Card>

          <Card bordered={false} className="panel table-panel">
            <Tabs defaultActiveTab="history" size="small">
              <Tabs.TabPane key="history" title="历史行情">
                <HistoryTable bars={bars} />
              </Tabs.TabPane>
            </Tabs>
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
}
