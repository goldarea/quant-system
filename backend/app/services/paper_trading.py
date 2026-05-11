from datetime import UTC, datetime
from uuid import uuid4

from app.models import (
    Instrument,
    PaperAccountSummary,
    PaperAccountResponse,
    PaperAuditEvent,
    PaperFill,
    PaperOrder,
    PaperOrderRequest,
    PaperPosition,
    PaperRiskLimits,
    PaperRiskStatus,
    Quote,
    ValidationApiError,
)


def _round(value: float) -> float:
    return round(value, 4)


class PaperTradingService:
    def __init__(self, initial_cash: float = 100000, max_order_value_pct: float = 25, max_position_value_pct: float = 50) -> None:
        self.initial_cash = float(initial_cash)
        self.max_order_value_pct = float(max_order_value_pct)
        self.max_position_value_pct = float(max_position_value_pct)
        self.cash = float(initial_cash)
        self.realized_pnl = 0.0
        self.positions: dict[str, PaperPosition] = {}
        self.orders: list[PaperOrder] = []
        self.fills: list[PaperFill] = []
        self.audit: list[PaperAuditEvent] = []

    def reset(self) -> PaperAccountResponse:
        self.cash = self.initial_cash
        self.realized_pnl = 0.0
        self.positions = {}
        self.orders = []
        self.fills = []
        self.audit = []
        self._audit("account_reset", "Paper account reset")
        return self.snapshot()

    def snapshot(self) -> PaperAccountResponse:
        positions = list(self.positions.values())
        unrealized_pnl = sum(position.unrealizedPnl for position in positions)
        market_value = sum(position.marketValue for position in positions)
        equity = self.cash + market_value
        return PaperAccountResponse(
            account=PaperAccountSummary(
                accountId="paper-default",
                cash=_round(self.cash),
                equity=_round(equity),
                buyingPower=_round(self.cash),
                realizedPnl=_round(self.realized_pnl),
                unrealizedPnl=_round(unrealized_pnl),
            ),
            positions=positions,
            orders=self.orders[-20:][::-1],
            fills=self.fills[-20:][::-1],
            audit=self.audit[-20:][::-1],
            risk=PaperRiskStatus(
                grossExposure=_round(market_value),
                grossExposurePct=_round((market_value / equity) * 100) if equity > 0 else 0,
                maxOrderValue=_round(equity * self.max_order_value_pct / 100),
                maxPositionValue=_round(equity * self.max_position_value_pct / 100),
                limits=PaperRiskLimits(
                    maxOrderValuePct=_round(self.max_order_value_pct),
                    maxPositionValuePct=_round(self.max_position_value_pct),
                ),
            ),
        )

    def submit_order(self, request: PaperOrderRequest, instrument: Instrument, quote: Quote) -> PaperAccountResponse:
        symbol = request.symbol.strip().upper()
        side = request.side.strip().lower()
        order_type = request.type.strip().lower()
        quantity = float(request.quantity)
        if symbol != instrument.symbol:
            raise ValidationApiError("Order symbol does not match resolved instrument")
        if side not in {"buy", "sell"}:
            raise ValidationApiError("side must be buy or sell")
        if order_type != "market":
            raise ValidationApiError("Only market paper orders are supported")
        if quantity <= 0:
            raise ValidationApiError("quantity must be greater than 0")

        now = datetime.now(UTC).isoformat()
        order = PaperOrder(
            id=str(uuid4()),
            symbol=symbol,
            side=side,
            quantity=_round(quantity),
            type=order_type,
            status="submitted",
            submittedAt=now,
        )
        self.orders.append(order)
        self._audit("order_submitted", f"Submitted {side} order for {order.quantity} {symbol}", symbol, order.id)
        self._fill_order(order, quote.price, now)
        return self.snapshot()

    def update_risk_limits(self, max_order_value_pct: float, max_position_value_pct: float) -> PaperAccountResponse:
        if max_order_value_pct <= 0 or max_order_value_pct > 100:
            raise ValidationApiError("maxOrderValuePct must be between 0 and 100")
        if max_position_value_pct <= 0 or max_position_value_pct > 100:
            raise ValidationApiError("maxPositionValuePct must be between 0 and 100")
        if max_order_value_pct > max_position_value_pct:
            raise ValidationApiError("maxOrderValuePct must be less than or equal to maxPositionValuePct")
        self.max_order_value_pct = float(max_order_value_pct)
        self.max_position_value_pct = float(max_position_value_pct)
        self._audit("risk_updated", f"Updated risk limits to order {max_order_value_pct}% and position {max_position_value_pct}%")
        return self.snapshot()

    def mark_to_market(self, quote: Quote) -> PaperAccountResponse:
        position = self.positions.get(quote.symbol)
        if position is not None:
            self.positions[quote.symbol] = self._position(
                quote.symbol,
                position.quantity,
                position.averageCost,
                quote.price,
            )
        return self.snapshot()

    def _fill_order(self, order: PaperOrder, price: float, time: str) -> None:
        value = order.quantity * price
        existing = self.positions.get(order.symbol)
        equity = self.cash + sum(position.marketValue for position in self.positions.values())

        if order.side == "buy":
            if value > self.cash:
                self._reject_order(order, "Insufficient buying power")
                return
            if value > equity * self.max_order_value_pct / 100:
                self._reject_order(order, "Order value exceeds risk limit")
                return
            existing_market_value = existing.marketValue if existing else 0.0
            if existing_market_value + value > equity * self.max_position_value_pct / 100:
                self._reject_order(order, "Position value exceeds risk limit")
                return
            previous_quantity = existing.quantity if existing else 0.0
            previous_cost = existing.averageCost if existing else 0.0
            next_quantity = previous_quantity + order.quantity
            next_average_cost = ((previous_quantity * previous_cost) + value) / next_quantity
            self.cash -= value
            self.positions[order.symbol] = self._position(order.symbol, next_quantity, next_average_cost, price)
        else:
            if existing is None or existing.quantity < order.quantity:
                self._reject_order(order, "Insufficient position quantity")
                return
            self.cash += value
            self.realized_pnl += (price - existing.averageCost) * order.quantity
            next_quantity = existing.quantity - order.quantity
            if next_quantity == 0:
                del self.positions[order.symbol]
            else:
                self.positions[order.symbol] = self._position(order.symbol, next_quantity, existing.averageCost, price)

        order.status = "filled"
        order.filledAt = time
        order.fillPrice = _round(price)
        self.fills.append(PaperFill(
            id=str(uuid4()),
            orderId=order.id,
            symbol=order.symbol,
            side=order.side,
            quantity=order.quantity,
            price=_round(price),
            value=_round(value),
            time=time,
        ))
        self._audit("order_filled", f"Filled {order.side} order for {order.quantity} {order.symbol} at {_round(price)}", order.symbol, order.id)

    def _reject_order(self, order: PaperOrder, message: str) -> None:
        order.status = "rejected"
        order.message = message
        self._audit("order_rejected", message, order.symbol, order.id)

    def _audit(self, event_type: str, message: str, symbol: str | None = None, order_id: str | None = None) -> None:
        self.audit.append(PaperAuditEvent(
            id=str(uuid4()),
            type=event_type,
            message=message,
            time=datetime.now(UTC).isoformat(),
            symbol=symbol,
            orderId=order_id,
        ))

    def _position(self, symbol: str, quantity: float, average_cost: float, last_price: float) -> PaperPosition:
        market_value = quantity * last_price
        unrealized_pnl = (last_price - average_cost) * quantity
        return PaperPosition(
            symbol=symbol,
            quantity=_round(quantity),
            averageCost=_round(average_cost),
            lastPrice=_round(last_price),
            marketValue=_round(market_value),
            unrealizedPnl=_round(unrealized_pnl),
        )
