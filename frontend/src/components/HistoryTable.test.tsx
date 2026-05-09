import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HistoryTable from './HistoryTable';
import type { Bar } from '../api/types';

const bars: Bar[] = [
  { time: '2026-05-05', open: 10, high: 12, low: 9, close: 11, volume: 1000 }
];

describe('HistoryTable', () => {
  it('shows historical OHLC rows', () => {
    render(<HistoryTable bars={bars} />);

    expect(screen.getByText('2026-05-05')).toBeInTheDocument();
    expect(screen.getByText('11.00')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });
});
