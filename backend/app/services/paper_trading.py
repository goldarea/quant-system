from datetime import UTC, datetime
from uuid import uuid4

from app.models import (
    Instrument,
    PaperAccountResponse,
    PaperAccountSummary,
    PaperFill,
    PaperOrder,
    PaperOrderRequest,
    PaperPosition,
    Quote,
    ValidationApiError,
)


def _round(value: float) -> float:
    return round(value, 4)


class PaperTradingService:
    def __init__(self, initial_cash: float = 100000) -> None:
        self.initial_cash = float(initial_cash)
        self.cash = float(initial_cash)
        self.realized_pnl = 0.0
        self.positions: dict[str, PaperPosition] = {}
        self.orders: list[PaperOrder] = []
        self.fills: list[PaperFill] = []

    def reset(self) -> PaperAccountResponse:
        self.cash = self.initial_cash
        self.realized_pnl = 0.0
        self.positions = {}
        self.orders = []
        self.fills = []
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
        self._fill_order(order, quote.price, now)
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

        if order.side == "buy":
            if value > self.cash:
                order.status = "rejected"
                order.message = "Insufficient buying power"
                return
            previous_quantity = existing.quantity if existing else 0.0
            previous_cost = existing.averageCost if existing else 0.0
            next_quantity = previous_quantity + order.quantity
            next_average_cost = ((previous_quantity * previous_cost) + value) / next_quantity
            self.cash -= value
            self.positions[order.symbol] = self._position(order.symbol, next_quantity, next_average_cost, price)
        else:
            if existing is None or existing.quantity < order.quantity:
                order.status = "rejected"
                order.message = "Insufficient position quantity"
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
