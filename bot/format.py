"""Message formatting: serve JSON in, Telegram HTML out.

English, no emoji — with one exception fixed by the spec: a single diamond
before grades of VVS2 and better. Certificates travel as <pre> blocks so the
monospace columns survive Telegram.
"""

from __future__ import annotations

from html import escape
from typing import Any

VVS_PLUS = {"FL", "IF", "VVS1", "VVS2"}
EXPLORER = "https://robinhoodchain.blockscout.com/token/"


def grade_prefix(grade: str) -> str:
    return "\U0001f48e " if grade in VVS_PLUS else ""


def _held_line(held: dict[str, float]) -> str:
    order = ["5m", "15m", "1h", "6h", "24h", "7d"]
    parts = [f"{label} {round(held[label] * 100)}%" for label in order if label in held]
    return " · ".join(parts) if parts else "no checkpoints yet"


def format_check(report: dict[str, Any], site_base: str | None = None) -> str:
    """The certificate as Telegram HTML: grade bold up top, body in <pre>."""
    token = report["token"]
    if report.get("tooEarly"):
        head = f"<b>TOO EARLY</b> · ${escape(report['symbol'])}"
        body = f"this token is {round(report['ageSec'])}s old; the first checkpoint lands at 5m."
        return f"{head}\n<pre>{escape(body)}</pre>{_links(token, site_base)}"

    head = f"{grade_prefix(report['grade'])}<b>{escape(report['grade'])} {report['score']}/100</b> · ${escape(report['symbol'])}"
    cut, clarity, color, carat = report["cut"], report["clarity"], report["color"], report["carat"]
    dev = "dev has not sold" if color["devSells"] == 0 else (
        "dev sold once" if color["devSells"] == 1 else f"dev sold {color['devSells']} times")
    lines = [
        f"cohort   {cut['cohort']} wallets ({cut['human']} human)",
        f"holding  {_held_line(cut['held'])}",
        f"halflife {cut['halfLife']}",
        f"clarity  top 10 hold {clarity['top10Pct']:.1f}%",
        f"color    {dev} · {color['feeClaims24h']} fee claims in 24h",
        f"carat    {carat['holders']}{'+' if carat.get('holdersIsFloor') else ''} holders",
        f"phase    {report['phase']}",
    ]
    return f"{head}\n<pre>{escape(chr(10).join(lines))}</pre>{_links(token, site_base)}"


def _links(token: str, site_base: str | None) -> str:
    links = [f'<a href="{EXPLORER}{token}">blockscout</a>']
    if site_base:
        links.append(f'<a href="{site_base}/terminal?token={token}">terminal</a>')
    return "\n" + " · ".join(links)


def format_top(result: dict[str, Any]) -> str:
    rows = result.get("rows", [])
    if not rows:
        return "no hunt yet. run <code>gemhog hunt --follow</code> next to serve and ask again."
    lines = []
    for row in rows[:10]:
        lines.append(
            f"{row['rank']:>2} {grade_prefix(row['grade'])}{row['grade']:<5} {row['score']:>3}  "
            f"${row['symbol'][:10]:<10} {row['token'][:10]}…"
        )
    head = (
        f"top of the last hunt · window {result.get('window', '?')} · "
        f"{result.get('graded', 0)} graded of {result.get('launches', 0)} launches"
    )
    return f"{escape(head)}\n<pre>{escape(chr(10).join(lines))}</pre>"


def card_caption(report: dict[str, Any]) -> str:
    """One line under the share card: $TICKER · GRADE score/100."""
    return f"{grade_prefix(report['grade'])}${report['symbol']} · {report['grade']} {report['score']}/100"


def format_alert(alert: dict[str, Any]) -> str:
    return (
        f"{grade_prefix(alert['grade'])}<b>{escape(alert['grade'])} {alert['score']}/100</b> "
        f"· ${escape(alert['symbol'])}\n<code>{escape(alert['token'])}</code>"
    )


def format_watch_change(symbol: str, before: dict[str, Any], after: dict[str, Any]) -> str | None:
    changes = []
    if before["grade"] != after["grade"]:
        changes.append(f"grade {before['grade']} to {after['grade']}")
    if before["score"] != after["score"]:
        changes.append(f"score {before['score']} to {after['score']}")
    if before["color"]["devSells"] != after["color"]["devSells"]:
        changes.append("dev sold")
    if not changes:
        return None
    return f"${escape(symbol)}: {escape(' · '.join(changes))}"


HELP = (
    "gemhog bot · diamond-hands terminal for pons v2\n\n"
    "/check &lt;address&gt; - grade a token\n"
    "/top - top of the last hunt\n"
    "/watch &lt;address&gt; - re-grade every 15 minutes, message on change\n"
    "/unwatch - stop watching\n"
    "/alerts on|off - VS1+ findings from the hunt\n\n"
    "read only. no keys, no signing, not financial advice."
)
