import csv
from io import StringIO

from app.models import Bar, ValidationApiError


REQUIRED_COLUMNS = {"open", "high", "low", "close", "volume"}


def parse_history_csv(content: str) -> list[Bar]:
    if not content.strip():
        raise ValidationApiError("CSV content is empty")

    reader = csv.DictReader(StringIO(content))
    if reader.fieldnames is None:
        raise ValidationApiError("CSV header is required")

    columns = {field.strip().lower(): field for field in reader.fieldnames if field is not None}
    time_column = columns.get("time") or columns.get("date")
    if time_column is None:
        raise ValidationApiError("CSV must include a time or date column")

    missing = sorted(column for column in REQUIRED_COLUMNS if column not in columns)
    if missing:
        raise ValidationApiError(f"CSV missing required columns: {', '.join(missing)}")

    bars: list[Bar] = []
    for index, row in enumerate(reader, start=2):
        if not any((value or "").strip() for value in row.values() if value is not None):
            continue

        try:
            time_value = _required_text(row.get(time_column), index, time_column)
            volume = _parse_volume(row.get(columns["volume"]), index)
            bars.append(
                Bar(
                    time=time_value,
                    open=_parse_float(row.get(columns["open"]), index, "open"),
                    high=_parse_float(row.get(columns["high"]), index, "high"),
                    low=_parse_float(row.get(columns["low"]), index, "low"),
                    close=_parse_float(row.get(columns["close"]), index, "close"),
                    volume=volume,
                )
            )
        except ValueError as error:
            raise ValidationApiError(str(error)) from error

    if not bars:
        raise ValidationApiError("CSV does not contain any data rows")

    return sorted(bars, key=lambda bar: bar.time)


def _required_text(value: str | None, row_number: int, column: str) -> str:
    text = (value or "").strip()
    if not text:
        raise ValueError(f"CSV row {row_number} has empty {column}")
    return text


def _parse_float(value: str | None, row_number: int, column: str) -> float:
    text = _required_text(value, row_number, column)
    try:
        return float(text)
    except ValueError as error:
        raise ValueError(f"CSV row {row_number} has invalid {column}: {text}") from error


def _parse_volume(value: str | None, row_number: int) -> int:
    text = _required_text(value, row_number, "volume")
    try:
        parsed = float(text)
    except ValueError as error:
        raise ValueError(f"CSV row {row_number} has invalid volume: {text}") from error

    if parsed < 0 or not parsed.is_integer():
        raise ValueError(f"CSV row {row_number} has invalid volume: {text}")
    return int(parsed)
