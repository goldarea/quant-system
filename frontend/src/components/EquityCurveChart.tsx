import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

import type { BacktestEquityPoint } from '../api/types';

export interface EquityCurveDataset {
  categories: string[];
  equity: number[];
}

interface EquityCurveChartProps {
  points: BacktestEquityPoint[];
}

export function buildEquityCurveDataset(points: BacktestEquityPoint[]): EquityCurveDataset {
  return {
    categories: points.map((point) => point.time),
    equity: points.map((point) => point.equity)
  };
}

function buildOption(dataset: EquityCurveDataset): EChartsOption {
  return {
    animation: false,
    tooltip: {
      trigger: 'axis'
    },
    grid: { left: 56, right: 24, top: 24, bottom: 48 },
    xAxis: {
      type: 'category',
      data: dataset.categories,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#86909c' } },
      min: 'dataMin',
      max: 'dataMax'
    },
    yAxis: {
      type: 'value',
      scale: true,
      splitArea: { show: true }
    },
    dataZoom: [
      { type: 'inside', start: 60, end: 100 },
      { show: true, type: 'slider', bottom: 8, start: 60, end: 100 }
    ],
    series: [{
      name: '权益曲线',
      type: 'line',
      data: dataset.equity,
      smooth: true,
      showSymbol: false,
      areaStyle: { opacity: 0.12 },
      lineStyle: { width: 2, color: '#165dff' }
    }]
  };
}

export default function EquityCurveChart({ points }: EquityCurveChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dataset = useMemo(() => buildEquityCurveDataset(points), [points]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const chart = echarts.init(containerRef.current);
    chart.setOption(buildOption(dataset), true);

    const resize = () => chart.resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      chart.dispose();
    };
  }, [dataset]);

  return <div className="equity-curve-surface" ref={containerRef} aria-label="Equity curve chart" />;
}
