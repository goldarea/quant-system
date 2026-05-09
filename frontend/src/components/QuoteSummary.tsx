import { Card, Grid, Space, Statistic, Tag, Typography } from '@arco-design/web-react';

import type { Quote } from '../api/types';

const { Row, Col } = Grid;
const { Text, Title } = Typography;

interface QuoteSummaryProps {
  quote: Quote | null;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

export default function QuoteSummary({ quote }: QuoteSummaryProps) {
  if (!quote) {
    return (
      <Card className="panel" bordered={false}>
        <Text type="secondary">选择标的后显示行情摘要。</Text>
      </Card>
    );
  }

  return (
    <Card className="panel quote-panel" bordered={false}>
      <div className="quote-heading">
        <div>
          <Space align="center">
            <Title heading={5}>{quote.symbol}</Title>
            <Tag color={quote.source === 'demo' ? 'orange' : 'green'}>{quote.source}</Tag>
            <Tag>{quote.market}</Tag>
          </Space>
          <Text type="secondary">{quote.name}</Text>
        </div>
        <Text type="secondary">{quote.time}</Text>
      </div>
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={8} lg={6}>
          <Statistic
            title={`最新价 ${quote.currency}`}
            value={quote.price}
            precision={2}
            renderFormat={(_, formattedValue) => <span>{formattedValue}</span>}
          />
        </Col>
        <Col xs={12} sm={8} lg={6}>
          <Statistic title="成交量" value={formatNumber(quote.volume)} />
        </Col>
        <Col xs={12} sm={8} lg={6}>
          <Statistic title="交易所" value={quote.instrument.exchange || '-'} />
        </Col>
        <Col xs={12} sm={8} lg={6}>
          <Statistic title="市场" value={quote.market} />
        </Col>
      </Row>
    </Card>
  );
}
