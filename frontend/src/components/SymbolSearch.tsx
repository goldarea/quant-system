import { Empty, Input, List, Space, Tag, Typography } from '@arco-design/web-react';
import { IconSearch } from '@arco-design/web-react/icon';

import type { Instrument } from '../api/types';

const { Text } = Typography;

interface SymbolSearchProps {
  query: string;
  results: Instrument[];
  loading: boolean;
  selectedSymbol?: string;
  onQueryChange: (query: string) => void;
  onSearch: (query: string) => void;
  onSelect: (instrument: Instrument) => void;
}

export default function SymbolSearch({
  query,
  results,
  loading,
  selectedSymbol,
  onQueryChange,
  onSearch,
  onSelect
}: SymbolSearchProps) {
  return (
    <div className="symbol-search">
      <Input.Search
        value={query}
        searchButton={<IconSearch aria-label="搜索" />}
        placeholder="代码、名称、市场"
        loading={loading}
        onChange={onQueryChange}
        onSearch={onSearch}
      />

      <List
        className="symbol-list"
        size="small"
        loading={loading}
        dataSource={results}
        noDataElement={<Empty description="没有匹配标的" />}
        render={(instrument) => (
          <List.Item
            key={instrument.symbol}
            className={instrument.symbol === selectedSymbol ? 'symbol-item active' : 'symbol-item'}
            onClick={() => onSelect(instrument)}
          >
            <div className="symbol-row">
              <div>
                <Space size={6}>
                  <Text className="symbol-code">{instrument.symbol}</Text>
                  <Tag size="small">{instrument.market}</Tag>
                </Space>
                <Text type="secondary" className="symbol-name">{instrument.name}</Text>
              </div>
              <Text type="secondary">{instrument.exchange}</Text>
            </div>
          </List.Item>
        )}
      />
    </div>
  );
}
