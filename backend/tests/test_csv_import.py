import pytest

from app.models import ValidationApiError
from app.services.csv_import import parse_history_csv


def test_parse_history_csv_returns_sorted_bars():
    bars = parse_history_csv("time,open,high,low,close,volume\n2024-05-02,2,3,1,2.5,200\n2024-05-01,1,2,0.5,1.5,100\n")

    assert [bar.time for bar in bars] == ["2024-05-01", "2024-05-02"]
    assert bars[0].close == 1.5
    assert bars[1].volume == 200


def test_parse_history_csv_accepts_date_header_alias():
    bars = parse_history_csv("date,open,high,low,close,volume\n2024-05-01,1,2,0.5,1.5,100\n")

    assert bars[0].time == "2024-05-01"


def test_parse_history_csv_rejects_missing_required_columns():
    with pytest.raises(ValidationApiError, match="missing required columns"):
        parse_history_csv("time,open,high,low,volume\n2024-05-01,1,2,0.5,100\n")


def test_parse_history_csv_rejects_invalid_numeric_value():
    with pytest.raises(ValidationApiError, match="invalid close"):
        parse_history_csv("time,open,high,low,close,volume\n2024-05-01,1,2,0.5,nope,100\n")


def test_parse_history_csv_rejects_negative_volume():
    with pytest.raises(ValidationApiError, match="invalid volume"):
        parse_history_csv("time,open,high,low,close,volume\n2024-05-01,1,2,0.5,1.5,-1\n")


def test_parse_history_csv_rejects_empty_content():
    with pytest.raises(ValidationApiError, match="empty"):
        parse_history_csv("")
