import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import QuoteSummary from './QuoteSummary';
import type { Quote } from '../api/types';

const quote: Quote = {
  instrument: {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    currency: 'USD'
  },
  symbol: 'AAPL',
  name: 'Apple Inc.',
  market: 'US',
  currency: 'USD',
  price: 188.42,
  time: '2026-05-05',
  volume: 1234567,
  source: 'demo'
};

describe('QuoteSummary', () => {
  it('renders quote metrics and demo source', () => {
    render(<QuoteSummary quote={quote} />);

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    expect(screen.getByText((_, element) => (
      element?.className === 'arco-statistic-value'
      && element.textContent === '188.42'
    ))).toBeInTheDocument();
    expect(screen.getByText('demo')).toBeInTheDocument();
  });
});
