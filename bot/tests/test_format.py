"""Formatting tests: serve JSON in, Telegram HTML out. No network anywhere."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import format as fmt  # noqa: E402

REPORT = {
    "token": "0xaC79255f6F404EBA14F316e8669D76573A2D7b1E",
    "symbol": "COPY",
    "grade": "VVS1",
    "score": 87,
    "tooEarly": False,
    "ageSec": 11520,
    "cut": {"cohort": 142, "human": 117, "held": {"5m": 0.96, "1h": 0.84}, "halfLife": "not reached"},
    "clarity": {"top10Pct": 14.2},
    "color": {"devSells": 0, "feeClaims24h": 0},
    "carat": {"holders": 611, "holdersIsFloor": False},
    "phase": "curve 74% → pool",
}


def test_check_has_diamond_only_for_vvs2_plus():
    assert fmt.format_check(REPORT).startswith("\U0001f48e ")
    modest = {**REPORT, "grade": "SI1", "score": 55}
    assert not fmt.format_check(modest).startswith("\U0001f48e")


def test_check_renders_pre_block_and_links():
    text = fmt.format_check(REPORT, site_base="https://gemhog.example")
    assert "<pre>" in text
    assert "142 wallets (117 human)" in text
    assert "blockscout" in text
    assert "terminal?token=" in text


def test_too_early_is_its_own_message():
    early = {**REPORT, "tooEarly": True, "ageSec": 44}
    text = fmt.format_check(early)
    assert "TOO EARLY" in text
    assert "44s old" in text


def test_top_formats_ten_rows_and_empty_state():
    result = {
        "window": "6h",
        "launches": 6363,
        "graded": 25,
        "rows": [
            {"rank": i, "grade": "VS2" if i == 1 else "SI1", "score": 70 - i, "symbol": f"TOK{i}", "token": "0x" + "ab" * 20}
            for i in range(1, 13)
        ],
    }
    text = fmt.format_top(result)
    assert text.count("TOK") == 10  # capped at ten rows
    assert "6363 launches" not in text or "graded" in text
    assert "no hunt yet" in fmt.format_top({"rows": []})


def test_watch_change_reports_only_differences():
    before = {"grade": "VS2", "score": 62, "color": {"devSells": 0}}
    same = {"grade": "VS2", "score": 62, "color": {"devSells": 0}}
    worse = {"grade": "SI1", "score": 55, "color": {"devSells": 1}}
    assert fmt.format_watch_change("911", before, same) is None
    changed = fmt.format_watch_change("911", before, worse)
    assert "grade VS2 to SI1" in changed
    assert "dev sold" in changed


def test_alert_carries_grade_and_address():
    text = fmt.format_alert({"grade": "VS1", "score": 74, "symbol": "NOVA", "token": "0x" + "cd" * 20})
    assert "VS1 74/100" in text
    assert "0x" + "cd" * 20 in text
