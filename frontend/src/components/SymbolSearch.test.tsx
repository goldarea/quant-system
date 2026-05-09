import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import SymbolSearch from './SymbolSearch';
import type { Instrument } from '../api/types';

const instruments: Instrument[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', exchange: 'NASDAQ', currency: 'USD' }
];

describe('SymbolSearch', () => {
  it('renders instruments and emits selection', async () => {
    const onSelect = vi.fn();
    render(
      <SymbolSearch
        query="apple"
        results={instruments}
        loading={false}
        selectedSymbol="AAPL"
        onQueryChange={() => undefined}
        onSearch={() => undefined}
        onSelect={onSelect}
      />
    );

    await userEvent.click(screen.getByText('AAPL'));

    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledWith(instruments[0]);
  });
});
