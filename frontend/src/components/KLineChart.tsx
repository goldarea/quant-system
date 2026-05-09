import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

import type { BacktestTrade, Bar, IndicatorPoint } from '../api/types';

export interface TradeMarker {
  name: string;
  value: [number, number];
  itemStyle: { color: string };
}

export interface KLineDataset {
  categories: string[];
  candles: Array<[number, number, number, number]>;
  volumes: Array<[number, number, 1 | -1]>;
  ma5: Array<number | '-'>;
  ma20: Array<number | '-'>;
  ma60: Array<number | '-'>;
  tradeMarkers: TradeMarker[];
}

interface KLineChartProps {
  bars: Bar[];
  visibleAverages?: {
    ma5: boolean;
    ma20: boolean;
    ma60: boolean;
  };
  averages?: {
    ma5?: IndicatorPoint[];
    ma20?: IndicatorPoint[];
    ma60?: IndicatorPoint[];
  };
  trades?: BacktestTrade[];
}

function round(value: number) {
  return Number(value.toFixed(2));
}

export function calculateMovingAverage(bars: Bar[], windowSize: number): Array<number | '-'> {
  return bars.map((_, index) => {
    if (index < windowSize - 1) return '-';
    const windowBars = bars.slice(index - windowSize + 1, index + 1);
    const average = windowBars.reduce((sum, bar) => sum + bar.close, 0) / windowSize;
    return round(average);
  });
}

function calculateAdaptiveAverage(bars: Bar[], windowSize: number) {
  return bars.map((_, index) => {
    const from = Math.max(0, index - windowSize + 1);
    const windowBars = bars.slice(from, index + 1);
    const average = windowBars.reduce((sum, bar) => sum + bar.close, 0) / windowBars.length;
    return round(average);
  });
}

function indicatorValues(points: IndicatorPoint[] | undefined, fallback: Array<number | '-'>) {
  if (!points?.length) return fallback;
  return points.map((point) => point.value ?? '-');
}

function buildTradeMarkers(bars: Bar[], trades: BacktestTrade[] | undefined): TradeMarker[] {
  if (!trades?.length) return [];
  const indexByTime = new Map(bars.map((bar, index) => [bar.time, index]));
  return trades.flatMap((trade) => {
    const index = indexByTime.get(trade.time);
    if (index === undefined) return [];
    return [{
      name: trade.side,
      value: [index, trade.price] as [number, number],
      itemStyle: { color: trade.side === 'buy' ? '#f53f3f' : '#00b42a' }
    }];
  });
}

export function buildKLineDataset(bars: Bar[], averages?: KLineChartProps['averages'], trades?: BacktestTrade[]): KLineDataset {
  const ma5 = calculateAdaptiveAverage(bars, 5);
  const ma20 = calculateAdaptiveAverage(bars, 20);
  const ma60 = calculateAdaptiveAverage(bars, 60);
  return {
    categories: bars.map((bar) => bar.time),
    candles: bars.map((bar) => [bar.open, bar.close, bar.low, bar.high]),
    volumes: bars.map((bar, index) => [index, bar.volume, bar.close >= bar.open ? 1 : -1]),
    ma5: indicatorValues(averages?.ma5, ma5),
    ma20: indicatorValues(averages?.ma20, ma20),
    ma60: indicatorValues(averages?.ma60, ma60),
    tradeMarkers: buildTradeMarkers(bars, trades)
  };
}

function buildOption(
  dataset: KLineDataset,
  visibleAverages: NonNullable<KLineChartProps['visibleAverages']> = { ma5: true, ma20: true, ma60: false }
): EChartsOption {
  const legendData = ['K线', '成交量'];
  if (visibleAverages.ma5) legendData.splice(1, 0, 'MA5');
  if (visibleAverages.ma20) legendData.splice(2, 0, 'MA20');
  if (visibleAverages.ma60) legendData.splice(3, 0, 'MA60');
  return {
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      top: 0,
      left: 0,
      data: legendData
    },
    axisPointer: {
      link: [{ xAxisIndex: 'all' }]
    },
    grid: [
      { left: 56, right: 24, top: 36, height: '58%' },
      { left: 56, right: 24, top: '74%', height: '16%' }
    ],
    xAxis: [
      {
        type: 'category',
        data: dataset.categories,
        boundaryGap: true,
        axisLine: { lineStyle: { color: '#86909c' } },
        axisLabel: { show: false },
        min: 'dataMin',
        max: 'dataMax'
      },
      {
        type: 'category',
        gridIndex: 1,
        data: dataset.categories,
        boundaryGap: true,
        axisLine: { lineStyle: { color: '#86909c' } },
        min: 'dataMin',
        max: 'dataMax'
      }
    ],
    yAxis: [
      {
        scale: true,
        splitArea: { show: true }
      },
      {
        scale: true,
        gridIndex: 1,
        splitNumber: 2,
        axisLabel: {
          formatter: (value: number) => `${Math.round(value / 1000)}K`
        }
      }
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], start: 60, end: 100 },
      { show: true, xAxisIndex: [0, 1], type: 'slider', bottom: 8, start: 60, end: 100 }
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: dataset.candles,
        itemStyle: {
          color: '#f53f3f',
          color0: '#00b42a',
          borderColor: '#f53f3f',
          borderColor0: '#00b42a'
        }
      },
      ...(visibleAverages.ma5 ? [{
        name: 'MA5',
        type: 'line' as const,
        data: dataset.ma5,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.2, color: '#165dff' }
      }] : []),
      ...(visibleAverages.ma20 ? [{
        name: 'MA20',
        type: 'line' as const,
        data: dataset.ma20,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.2, color: '#722ed1' }
      }] : []),
      ...(visibleAverages.ma60 ? [{
        name: 'MA60',
        type: 'line' as const,
        data: dataset.ma60,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.2, color: '#f7ba1e' }
      }] : []),
      {
        name: '交易信号',
        type: 'scatter',
        data: dataset.tradeMarkers,
        symbolSize: 12,
        z: 10
      },
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: dataset.volumes,
        itemStyle: {
          color: (params) => {
            const direction = (params.data as [number, number, 1 | -1])[2];
            return direction > 0 ? '#f53f3f' : '#00b42a';
          }
        }
      }
    ]
  };
}

export default function KLineChart({ bars, visibleAverages = { ma5: true, ma20: true, ma60: false }, averages, trades }: KLineChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dataset = useMemo(() => buildKLineDataset(bars, averages, trades), [bars, averages, trades]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const chart = echarts.init(containerRef.current);
    chart.setOption(buildOption(dataset, visibleAverages), true);

    const resize = () => chart.resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      chart.dispose();
    };
  }, [dataset, visibleAverages]);

  return <div className="chart-surface" ref={containerRef} aria-label="K line and volume chart" />;
}
