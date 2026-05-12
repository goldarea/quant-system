import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
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

import { ApiError, clearExperimentRuns, deleteExperimentRun, getExperimentRuns, getHealth, getHistory, getIndicators, getPaperAccount, getParameterSweep, getPortfolioBacktest, getQuote, getStrategies, getStrategyBacktest, importHistoryCsv, resetPaperAccount, searchSymbols, submitPaperOrder, updatePaperRiskLimits } from './api/client';
import type {
  BacktestResponse,
  ExperimentRun,
  HealthResponse,
  HistoryInterval,
  HistoryRange,
  HistoryResponse,
  IndicatorsResponse,
  Instrument,
  PaperAccountResponse,
  ParameterSweepResponse,
  PortfolioBacktestResponse,
  Quote,
  StrategyDefinition
} from './api/types';
import EquityCurveChart from './components/EquityCurveChart';
import HistoryTable from './components/HistoryTable';
import KLineChart from './components/KLineChart';
import QuoteSummary from './components/QuoteSummary';
import SymbolSearch from './components/SymbolSearch';
import { experimentRunsToCsv, formatExperimentParameters } from './experiments';

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
  const [parameterSweep, setParameterSweep] = useState<ParameterSweepResponse | null>(null);
  const [experimentRuns, setExperimentRuns] = useState<ExperimentRun[]>([]);
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [strategyId, setStrategyId] = useState('ma_crossover');
  const [strategyParameters, setStrategyParameters] = useState<Record<string, number | string>>({});
  const [portfolioBacktest, setPortfolioBacktest] = useState<PortfolioBacktestResponse | null>(null);
  const [paperAccount, setPaperAccount] = useState<PaperAccountResponse | null>(null);
  const [range, setRange] = useState<HistoryRange>('1y');
  const [interval, setInterval] = useState<HistoryInterval>('1d');
  const [searchLoading, setSearchLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [sweepError, setSweepError] = useState<string | null>(null);
  const [experimentError, setExperimentError] = useState<string | null>(null);
  const [portfolioBacktestError, setPortfolioBacktestError] = useState<string | null>(null);
  const [paperError, setPaperError] = useState<string | null>(null);
  const [paperSide, setPaperSide] = useState<'buy' | 'sell'>('buy');
  const [paperQuantity, setPaperQuantity] = useState(1);
  const [paperMaxOrderPct, setPaperMaxOrderPct] = useState(25);
  const [paperMaxPositionPct, setPaperMaxPositionPct] = useState(50);
  const [importLoading, setImportLoading] = useState(false);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [sweepLoading, setSweepLoading] = useState(false);
  const [portfolioBacktestLoading, setPortfolioBacktestLoading] = useState(false);
  const [experimentLoading, setExperimentLoading] = useState(false);
  const [experimentFilter, setExperimentFilter] = useState('');
  const [experimentSortBy, setExperimentSortBy] = useState('time');
  const [experimentSortDir, setExperimentSortDir] = useState<'asc' | 'desc'>('desc');
  const [paperLoading, setPaperLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [visibleAverages, setVisibleAverages] = useState({ ma5: true, ma20: true, ma60: false });
  const [showMacd, setShowMacd] = useState(true);
  const [showRsi, setShowRsi] = useState(true);
  const [watchlist, setWatchlist] = useState<Instrument[]>(() => loadWatchlist());
  const [sweepFastMin, setSweepFastMin] = useState(3);
  const [sweepFastMax, setSweepFastMax] = useState(10);
  const [sweepSlowMin, setSweepSlowMin] = useState(15);
  const [sweepSlowMax, setSweepSlowMax] = useState(30);

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === strategyId),
    [strategies, strategyId]
  );

  const strategyParamSignature = useMemo(
    () => JSON.stringify(strategyParameters),
    [strategyParameters]
  );

  const selectedInWatchlist = selected ? watchlist.some((item) => item.symbol === selected.symbol) : false;

  const deleteExperiment = useCallback(async (id: string) => {
    setExperimentLoading(true);
    setExperimentError(null);
    try {
      setExperimentRuns(await deleteExperimentRun(id));
    } catch (deleteError) {
      setExperimentError(errorMessage(deleteError));
    } finally {
      setExperimentLoading(false);
    }
  }, []);

  const clearExperiments = useCallback(async () => {
    setExperimentLoading(true);
    setExperimentError(null);
    try {
      setExperimentRuns(await clearExperimentRuns());
    } catch (clearError) {
      setExperimentError(errorMessage(clearError));
    } finally {
      setExperimentLoading(false);
    }
  }, []);

  const exportExperiments = useCallback(() => {
    if (experimentRuns.length === 0) return;
    const blob = new Blob([experimentRunsToCsv(experimentRuns)], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `quant-experiments-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [experimentRuns]);

  const restoreExperiment = useCallback((run: ExperimentRun) => {
    setSelected((current) => (current?.symbol === run.symbol ? current : {
      symbol: run.symbol,
      name: run.symbol,
      market: '',
      currency: ''
    }));
    setQuery(run.symbol);
    setRange(run.range);
    setInterval(run.interval);
    setStrategyId(run.strategy);
    setStrategyParameters(run.parameters);
    setRefreshToken((current) => current + 1);
  }, []);

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

  const refreshExperimentRuns = useCallback(async () => {
    setExperimentLoading(true);
    setExperimentError(null);
    try {
      const normalizedFilter = experimentFilter.trim().toUpperCase();
      setExperimentRuns(await getExperimentRuns({
        strategy: strategies.some((strategy) => strategy.id === experimentFilter.trim()) ? experimentFilter.trim() : undefined,
        symbol: normalizedFilter || undefined,
        sortBy: experimentSortBy,
        sortDir: experimentSortDir
      }));
    } catch (runsError) {
      setExperimentError(errorMessage(runsError));
    } finally {
      setExperimentLoading(false);
    }
  }, [experimentFilter, experimentSortBy, experimentSortDir, strategies]);

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
    getPaperAccount()
      .then((account) => {
        setPaperAccount(account);
        setPaperMaxOrderPct(account.risk.limits.maxOrderValuePct);
        setPaperMaxPositionPct(account.risk.limits.maxPositionValuePct);
      })
      .catch((accountError) => setPaperError(errorMessage(accountError)));
    refreshExperimentRuns();
  }, [refreshExperimentRuns]);

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
        if (!cancelled) {
          setBacktest(nextBacktest);
          refreshExperimentRuns();
        }
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
  }, [selected, selectedStrategy, strategyId, range, interval, strategyParamSignature, refreshToken, refreshExperimentRuns]);

  const portfolioSymbols = useMemo(() => watchlist.map((item) => item.symbol), [watchlist]);

  const runSweep = useCallback(async () => {
    if (!selected) return;

    setSweepLoading(true);
    setSweepError(null);
    try {
      setParameterSweep(await getParameterSweep({
        symbol: selected.symbol,
        range,
        interval,
        fastMin: sweepFastMin,
        fastMax: sweepFastMax,
        slowMin: sweepSlowMin,
        slowMax: sweepSlowMax,
        initialCapital: Number(strategyParameters.initialCapital) || 100000,
        feeRatePct: Number(strategyParameters.feeRatePct) || 0,
        slippagePct: Number(strategyParameters.slippagePct) || 0
      }));
    } catch (dataError) {
      setParameterSweep(null);
      setSweepError(errorMessage(dataError));
    } finally {
      setSweepLoading(false);
    }
  }, [selected, range, interval, sweepFastMin, sweepFastMax, sweepSlowMin, sweepSlowMax, strategyParameters.initialCapital, strategyParameters.feeRatePct, strategyParameters.slippagePct]);

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

  const submitSelectedPaperOrder = useCallback(async () => {
    if (!selected) return;

    setPaperLoading(true);
    setPaperError(null);
    try {
      const nextAccount = await submitPaperOrder({
        symbol: selected.symbol,
        side: paperSide,
        quantity: paperQuantity,
        type: 'market'
      });
      setPaperAccount(nextAccount);
    } catch (orderError) {
      setPaperError(errorMessage(orderError));
    } finally {
      setPaperLoading(false);
    }
  }, [selected, paperSide, paperQuantity]);

  const updatePaperRisk = useCallback(async () => {
    setPaperLoading(true);
    setPaperError(null);
    try {
      const nextAccount = await updatePaperRiskLimits({
        maxOrderValuePct: paperMaxOrderPct,
        maxPositionValuePct: paperMaxPositionPct
      });
      setPaperAccount(nextAccount);
    } catch (riskError) {
      setPaperError(errorMessage(riskError));
    } finally {
      setPaperLoading(false);
    }
  }, [paperMaxOrderPct, paperMaxPositionPct]);

  const resetPaper = useCallback(async () => {
    setPaperLoading(true);
    setPaperError(null);
    try {
      setPaperAccount(await resetPaperAccount());
    } catch (resetError) {
      setPaperError(errorMessage(resetError));
    } finally {
      setPaperLoading(false);
    }
  }, []);

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
                <Text bold>实验记录</Text>
                <Tag>{experimentRuns.length} runs</Tag>
              </Space>
              <Space wrap>
                <Button size="small" loading={experimentLoading} onClick={() => void refreshExperimentRuns()}>
                  刷新
                </Button>
                <Button size="small" disabled={experimentRuns.length === 0} onClick={exportExperiments}>
                  导出 CSV
                </Button>
                <Button size="small" status="danger" disabled={experimentRuns.length === 0} onClick={() => void clearExperiments()}>
                  清空
                </Button>
              </Space>
            </div>
            <Spin loading={experimentLoading} block>
              <div className="backtest-controls">
                <Space wrap>
                  <Input
                    size="small"
                    placeholder="筛选 strategy id 或 symbol"
                    value={experimentFilter}
                    onChange={setExperimentFilter}
                    style={{ width: 220 }}
                  />
                  <Select
                    size="small"
                    value={experimentSortBy}
                    style={{ width: 160 }}
                    onChange={setExperimentSortBy}
                    options={[
                      { label: '时间', value: 'time' },
                      { label: '收益', value: 'totalReturnPct' },
                      { label: 'Sharpe', value: 'sharpeRatio' },
                      { label: '回撤', value: 'maxDrawdownPct' },
                      { label: '权益', value: 'finalEquity' },
                      { label: '交易数', value: 'tradeCount' },
                      { label: '胜率', value: 'winRatePct' }
                    ]}
                  />
                  <Radio.Group
                    type="button"
                    size="small"
                    value={experimentSortDir}
                    onChange={setExperimentSortDir}
                    options={[{ label: '降序', value: 'desc' }, { label: '升序', value: 'asc' }]}
                  />
                  <Button size="small" onClick={() => void refreshExperimentRuns()}>
                    应用
                  </Button>
                  <Tag>{experimentRuns.length} shown</Tag>
                </Space>
              </div>
              {experimentError && (
                <Alert
                  className="backtest-alert"
                  type="error"
                  title="实验记录加载失败"
                  content={experimentError}
                  showIcon
                />
              )}
              <List
                size="small"
                className="backtest-trades"
                dataSource={experimentRuns.slice(0, 8)}
                noDataElement={<Empty description="暂无实验记录，运行策略回测后自动保存摘要" />}
                render={(run) => (
                  <List.Item key={run.id}>
                    <Space wrap>
                      <Tag color="arcoblue">{run.strategy}</Tag>
                      <Text>{run.symbol}</Text>
                      <Text type="secondary">{run.range}/{run.interval}</Text>
                      <Text type="secondary">return {run.totalReturnPct}%</Text>
                      <Text type="secondary">equity {run.finalEquity}</Text>
                      <Text type="secondary">drawdown {run.maxDrawdownPct}%</Text>
                      <Text type="secondary">sharpe {run.sharpeRatio}</Text>
                      <Text type="secondary">trades {run.tradeCount}</Text>
                      <Text type="secondary">params {formatExperimentParameters(run.parameters)}</Text>
                      <Text type="secondary">{run.time}</Text>
                      <Button size="mini" onClick={() => restoreExperiment(run)}>
                        复用参数
                      </Button>
                      <Button size="mini" status="danger" onClick={() => void deleteExperiment(run.id)}>
                        删除
                      </Button>
                    </Space>
                  </List.Item>
                )}
              />
            </Spin>
          </Card>

          <Card bordered={false} className="panel backtest-panel">
            <div className="indicator-toolbar">
              <Space wrap>
                <Text bold>参数扫描</Text>
                <Tag>MA Crossover</Tag>
                <Tag>{parameterSweep ? `${parameterSweep.results.length} results` : 'batch'}</Tag>
              </Space>
              <Button size="small" type="primary" loading={sweepLoading} disabled={!selected} onClick={() => void runSweep()}>
                运行扫描
              </Button>
            </div>
            <Spin loading={sweepLoading} block>
              <div className="backtest-controls">
                <Space wrap>
                  <Text type="secondary">Fast</Text>
                  <InputNumber size="small" min={2} max={100} value={sweepFastMin} onChange={(value) => setSweepFastMin(Number(value) || 2)} />
                  <Text type="secondary">至</Text>
                  <InputNumber size="small" min={2} max={100} value={sweepFastMax} onChange={(value) => setSweepFastMax(Number(value) || 2)} />
                  <Text type="secondary">Slow</Text>
                  <InputNumber size="small" min={3} max={200} value={sweepSlowMin} onChange={(value) => setSweepSlowMin(Number(value) || 3)} />
                  <Text type="secondary">至</Text>
                  <InputNumber size="small" min={3} max={200} value={sweepSlowMax} onChange={(value) => setSweepSlowMax(Number(value) || 3)} />
                  <Text type="secondary">资金 {Number(strategyParameters.initialCapital) || 100000}</Text>
                </Space>
              </div>
              {sweepError && (
                <Alert
                  className="backtest-alert"
                  type="error"
                  title="参数扫描失败"
                  content={sweepError}
                  showIcon
                />
              )}
              {parameterSweep ? (
                <>
                  <div className="indicator-summary">
                    <Card size="small" bordered={false} className="indicator-card">
                      <Text type="secondary">最佳组合</Text>
                      <Title heading={6}>{parameterSweep.results[0] ? `${parameterSweep.results[0].fastWindow}/${parameterSweep.results[0].slowWindow}` : '-'}</Title>
                      <Text type="secondary">来源 {parameterSweep.source}</Text>
                    </Card>
                    <Card size="small" bordered={false} className="indicator-card">
                      <Text type="secondary">最佳收益</Text>
                      <Title heading={6}>{parameterSweep.results[0]?.totalReturnPct ?? '-'}%</Title>
                      <Text type="secondary">Sharpe {parameterSweep.results[0]?.sharpeRatio ?? '-'}</Text>
                    </Card>
                    <Card size="small" bordered={false} className="indicator-card">
                      <Text type="secondary">成本假设</Text>
                      <Title heading={6}>{parameterSweep.feeRatePct}%</Title>
                      <Text type="secondary">滑点 {parameterSweep.slippagePct}%</Text>
                    </Card>
                  </div>
                  <List
                    size="small"
                    className="backtest-trades"
                    dataSource={parameterSweep.results.slice(0, 10)}
                    noDataElement={<Empty description="暂无扫描结果" />}
                    render={(result) => (
                      <List.Item key={`${result.fastWindow}-${result.slowWindow}`}>
                        <Space wrap>
                          <Tag color={result.rank === 1 ? 'green' : 'arcoblue'}>#{result.rank}</Tag>
                          <Text>Fast {result.fastWindow} / Slow {result.slowWindow}</Text>
                          <Text type="secondary">return {result.totalReturnPct}%</Text>
                          <Text type="secondary">equity {result.finalEquity}</Text>
                          <Text type="secondary">drawdown {result.maxDrawdownPct}%</Text>
                          <Text type="secondary">sharpe {result.sharpeRatio}</Text>
                          <Text type="secondary">trades {result.tradeCount}</Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                </>
              ) : (
                <Empty description="运行参数扫描后显示排名前 10 的窗口组合" />
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

          <Card bordered={false} className="panel backtest-panel">
            <div className="indicator-toolbar">
              <Space wrap>
                <Text bold>Paper Trading</Text>
                <Tag>{selected?.symbol ?? 'symbol'}</Tag>
                <Tag>{paperAccount?.account.accountId ?? 'paper-default'}</Tag>
                {paperAccount && <Tag color="orange">Order ≤ {paperAccount.risk.limits.maxOrderValuePct}%</Tag>}
                {paperAccount && <Tag color="orange">Position ≤ {paperAccount.risk.limits.maxPositionValuePct}%</Tag>}
              </Space>
              <Button size="small" loading={paperLoading} onClick={() => void resetPaper()}>重置账户</Button>
            </div>
            <Spin loading={paperLoading} block>
              <div className="backtest-controls">
                <Space wrap>
                  <Radio.Group
                    type="button"
                    size="small"
                    value={paperSide}
                    onChange={setPaperSide}
                    options={[{ label: '买入', value: 'buy' }, { label: '卖出', value: 'sell' }]}
                  />
                  <Text type="secondary">数量</Text>
                  <InputNumber size="small" min={1} step={1} value={paperQuantity} onChange={(value) => setPaperQuantity(Number(value) || 1)} />
                  <Button type="primary" size="small" disabled={!selected} onClick={() => void submitSelectedPaperOrder()}>
                    提交市价单
                  </Button>
                  <Text type="secondary">单笔%</Text>
                  <InputNumber size="small" min={1} max={100} value={paperMaxOrderPct} onChange={(value) => setPaperMaxOrderPct(Number(value) || 1)} />
                  <Text type="secondary">持仓%</Text>
                  <InputNumber size="small" min={1} max={100} value={paperMaxPositionPct} onChange={(value) => setPaperMaxPositionPct(Number(value) || 1)} />
                  <Button size="small" onClick={() => void updatePaperRisk()}>
                    更新风控
                  </Button>
                </Space>
              </div>
              {paperError && (
                <Alert
                  className="backtest-alert"
                  type="error"
                  title="模拟交易失败"
                  content={paperError}
                  showIcon
                />
              )}
              {paperAccount ? (
                <>
                  <div className="indicator-summary">
                    <Card size="small" bordered={false} className="indicator-card">
                      <Text type="secondary">账户权益</Text>
                      <Title heading={6}>{paperAccount.account.equity}</Title>
                      <Text type="secondary">现金 {paperAccount.account.cash}</Text>
                    </Card>
                    <Card size="small" bordered={false} className="indicator-card">
                      <Text type="secondary">购买力</Text>
                      <Title heading={6}>{paperAccount.account.buyingPower}</Title>
                      <Text type="secondary">已实现 {paperAccount.account.realizedPnl}</Text>
                    </Card>
                    <Card size="small" bordered={false} className="indicator-card">
                      <Text type="secondary">浮动盈亏</Text>
                      <Title heading={6}>{paperAccount.account.unrealizedPnl}</Title>
                      <Text type="secondary">持仓 {paperAccount.positions.length}</Text>
                    </Card>
                    <Card size="small" bordered={false} className="indicator-card">
                      <Text type="secondary">风险暴露</Text>
                      <Title heading={6}>{paperAccount.risk.grossExposurePct}%</Title>
                      <Text type="secondary">市值 {paperAccount.risk.grossExposure}</Text>
                    </Card>
                    <Card size="small" bordered={false} className="indicator-card">
                      <Text type="secondary">下单风控</Text>
                      <Title heading={6}>{paperAccount.risk.maxOrderValue}</Title>
                      <Text type="secondary">单标的上限 {paperAccount.risk.maxPositionValue}</Text>
                    </Card>
                  </div>
                  <List
                    size="small"
                    className="backtest-trades"
                    dataSource={paperAccount.positions}
                    noDataElement={<Empty description="暂无模拟持仓" />}
                    render={(position) => (
                      <List.Item key={position.symbol}>
                        <Space wrap>
                          <Tag>{position.symbol}</Tag>
                          <Text type="secondary">qty {position.quantity}</Text>
                          <Text type="secondary">avg {position.averageCost}</Text>
                          <Text type="secondary">last {position.lastPrice}</Text>
                          <Text type="secondary">pnl {position.unrealizedPnl}</Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                  <List
                    size="small"
                    className="backtest-trades"
                    dataSource={paperAccount.orders.slice(0, 5)}
                    noDataElement={<Empty description="暂无模拟订单" />}
                    render={(order) => (
                      <List.Item key={order.id}>
                        <Space wrap>
                          <Tag color={order.status === 'filled' ? 'green' : order.status === 'rejected' ? 'red' : 'arcoblue'}>{order.status}</Tag>
                          <Text>{order.symbol}</Text>
                          <Text type="secondary">{order.side} {order.quantity}</Text>
                          <Text type="secondary">fill {order.fillPrice ?? '-'}</Text>
                          {order.message && <Text type="secondary">{order.message}</Text>}
                        </Space>
                      </List.Item>
                    )}
                  />
                  <List
                    size="small"
                    className="backtest-trades"
                    dataSource={paperAccount.audit.slice(0, 6)}
                    noDataElement={<Empty description="暂无审计事件" />}
                    render={(event) => (
                      <List.Item key={event.id}>
                        <Space wrap>
                          <Tag color={event.type.includes('rejected') ? 'red' : event.type.includes('filled') ? 'green' : 'arcoblue'}>{event.type}</Tag>
                          <Text>{event.symbol ?? '-'}</Text>
                          <Text type="secondary">{event.message}</Text>
                          <Text type="secondary">{event.time}</Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                </>
              ) : (
                <Empty description="暂无模拟账户数据" />
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
