import { Table } from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';

import type { Bar } from '../api/types';

interface HistoryTableProps {
  bars: Bar[];
}

function fixed(value: number) {
  return value.toFixed(2);
}

function volume(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

export default function HistoryTable({ bars }: HistoryTableProps) {
  const columns: TableColumnProps<Bar>[] = [
    { title: '日期', dataIndex: 'time', width: 120, fixed: 'left' },
    { title: '开盘', dataIndex: 'open', align: 'right', render: fixed },
    { title: '最高', dataIndex: 'high', align: 'right', render: fixed },
    { title: '最低', dataIndex: 'low', align: 'right', render: fixed },
    { title: '收盘', dataIndex: 'close', align: 'right', render: fixed },
    { title: '成交量', dataIndex: 'volume', align: 'right', render: volume }
  ];

  return (
    <Table
      rowKey="time"
      size="small"
      columns={columns}
      data={bars}
      pagination={{ pageSize: 8, sizeCanChange: false }}
      scroll={{ x: 720 }}
    />
  );
}
