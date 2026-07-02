#!/usr/bin/env python3
"""Draw static PNG charts from oha p0/p1 result directories."""

from __future__ import annotations

import argparse
import math
import os
import tempfile
from collections import defaultdict
from pathlib import Path
from typing import Any

os.environ.setdefault("MPLCONFIGDIR", str(Path(tempfile.gettempdir()) / "oha-report-matplotlib"))

import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.ticker import FuncFormatter

from build_report import build_summary, collect_results


PALETTE = [
    "#2563a8",
    "#1f7a4d",
    "#b85c00",
    "#5f6b7a",
    "#0f766e",
    "#b42318",
    "#6b7280",
    "#8a4b0f",
]


def configure_fonts() -> None:
    candidates = [
        "Microsoft YaHei",
        "SimHei",
        "Noto Sans CJK SC",
        "Noto Sans CJK JP",
        "Source Han Sans SC",
        "WenQuanYi Micro Hei",
        "PingFang SC",
        "Heiti SC",
        "Arial Unicode MS",
    ]
    installed = {font.name for font in font_manager.fontManager.ttflist}
    for name in candidates:
        if name in installed:
            plt.rcParams["font.sans-serif"] = [name, "DejaVu Sans"]
            break
    else:
        plt.rcParams["font.sans-serif"] = ["DejaVu Sans"]
        print("WARN: 未找到常见中文字体，图片中的中文可能显示为方框。")
    plt.rcParams["axes.unicode_minus"] = False


def finite(value: Any) -> bool:
    return isinstance(value, (int, float)) and math.isfinite(value)


def group_series(rows: list[dict[str, Any]], metric: str) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        if finite(row.get("concurrency")) and finite(row.get(metric)):
            grouped[f"{row.get('suite')} / {row.get('endpoint')}"].append(row)
    for items in grouped.values():
        items.sort(key=lambda item: (item.get("concurrency") or 0, item.get("iteration") or 0))
    return dict(sorted(grouped.items()))


def apply_common_style(ax: Any) -> None:
    ax.set_facecolor("#ffffff")
    ax.grid(True, axis="y", linestyle="--", linewidth=0.8, color="#d8dee5")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#cfd6dd")
    ax.spines["bottom"].set_color("#cfd6dd")
    ax.tick_params(colors="#39424e")


def save_line_chart(rows: list[dict[str, Any]], metric: str, title: str, ylabel: str, out: Path) -> None:
    fig, ax = plt.subplots(figsize=(12, 7), dpi=150)
    apply_common_style(ax)
    grouped = group_series(rows, metric)
    if not grouped:
        ax.text(0.5, 0.5, "没有可绘制的数据", ha="center", va="center", transform=ax.transAxes)
    for index, (name, items) in enumerate(grouped.items()):
        xs = [item["concurrency"] for item in items]
        ys = [item[metric] for item in items]
        ax.plot(xs, ys, marker="o", linewidth=2, markersize=4, label=name, color=PALETTE[index % len(PALETTE)])
    ax.set_title(title, fontsize=15, pad=14)
    ax.set_xlabel("并发数")
    ax.set_ylabel(ylabel)
    ax.xaxis.set_major_formatter(FuncFormatter(lambda value, _: f"{value:g}"))
    if grouped:
        ax.legend(loc="upper left", bbox_to_anchor=(1.01, 1), frameon=False, fontsize=8)
    fig.tight_layout()
    fig.savefig(out, bbox_inches="tight", facecolor="#ffffff")
    plt.close(fig)


def save_status_chart(rows: list[dict[str, Any]], out: Path) -> None:
    grouped: dict[str, dict[str, int]] = defaultdict(lambda: {"2xx": 0, "非 2xx": 0, "客户端错误": 0})
    for row in rows:
        key = f"{row.get('suite')} / {row.get('endpoint')}"
        status_counts = row.get("status_counts") if isinstance(row.get("status_counts"), dict) else {}
        grouped[key]["2xx"] += sum(int(v) for k, v in status_counts.items() if str(k).startswith("2"))
        grouped[key]["非 2xx"] += int(row.get("non_2xx") or 0)
        grouped[key]["客户端错误"] += int(row.get("client_errors") or 0)

    items = [
        (name, counts)
        for name, counts in grouped.items()
        if sum(counts.values()) > 0
    ]
    items.sort(key=lambda item: sum(item[1].values()), reverse=True)
    items = items[:16]

    fig_height = max(5, 0.42 * len(items) + 2)
    fig, ax = plt.subplots(figsize=(12, fig_height), dpi=150)
    apply_common_style(ax)
    if not items:
        ax.text(0.5, 0.5, "没有状态码数据", ha="center", va="center", transform=ax.transAxes)
    else:
        labels = [name[:38] for name, _ in items]
        left = [0] * len(items)
        colors = {"2xx": "#1f7a4d", "非 2xx": "#b85c00", "客户端错误": "#b42318"}
        for segment in ["2xx", "非 2xx", "客户端错误"]:
            values = [counts[segment] for _, counts in items]
            ax.barh(labels, values, left=left, label=segment, color=colors[segment])
            left = [a + b for a, b in zip(left, values)]
        ax.invert_yaxis()
        ax.legend(frameon=False, loc="lower right")
    ax.set_title("状态码分布（按接口聚合）", fontsize=15, pad=14)
    ax.set_xlabel("请求数")
    fig.tight_layout()
    fig.savefig(out, bbox_inches="tight", facecolor="#ffffff")
    plt.close(fig)


def save_summary_card(summary: dict[str, Any], out: Path) -> None:
    fig, ax = plt.subplots(figsize=(10, 4.5), dpi=150)
    ax.axis("off")
    cards = [
        ("用例数", summary.get("case_count")),
        ("接口数", summary.get("endpoint_count")),
        ("总请求数", summary.get("total_requests")),
        ("最高 RPS", summary.get("best_rps")),
        ("P95 中位数", summary.get("median_p95_ms")),
        ("最低成功率", summary.get("min_success_pct")),
    ]
    for index, (label, value) in enumerate(cards):
        row, col = divmod(index, 3)
        x = 0.04 + col * 0.32
        y = 0.58 - row * 0.38
        rect = plt.Rectangle((x, y), 0.28, 0.26, transform=ax.transAxes, facecolor="#ffffff", edgecolor="#d8dee5", linewidth=1)
        ax.add_patch(rect)
        ax.text(x + 0.025, y + 0.17, label, transform=ax.transAxes, color="#64707d", fontsize=10)
        if isinstance(value, float):
            text = f"{value:,.2f}"
        elif isinstance(value, int):
            text = f"{value:,}"
        else:
            text = "n/a"
        ax.text(x + 0.025, y + 0.07, text, transform=ax.transAxes, color="#111827", fontsize=18, fontweight="bold")
    ax.text(0.04, 0.92, "oha API 性能测试摘要", transform=ax.transAxes, fontsize=16, fontweight="bold", color="#111827")
    ax.text(0.04, 0.86, f"生成时间：{summary.get('generated_at', '')}", transform=ax.transAxes, fontsize=9, color="#64707d")
    fig.savefig(out, bbox_inches="tight", facecolor="#f6f7f8")
    plt.close(fig)


def main() -> int:
    parser = argparse.ArgumentParser(description="Draw PNG charts from oha p0/p1 result directories.")
    parser.add_argument("--results", default="oha-results", help="结果根目录，默认 oha-results")
    parser.add_argument("--out-dir", default="oha-results/charts", help="图片输出目录，默认 oha-results/charts")
    parser.add_argument("--suite", default="", help="只绘制指定分组，例如 p0 或 p1")
    parser.add_argument("--phase", default="", help="只绘制指定阶段，例如 performance 或 stress")
    args = parser.parse_args()

    results_root = Path(args.results)
    if not results_root.is_dir():
        raise SystemExit(f"结果目录不存在: {results_root}")

    rows, runs = collect_results(results_root)
    if args.suite:
        rows = [row for row in rows if row.get("suite") == args.suite]
    if args.phase:
        rows = [row for row in rows if row.get("phase") == args.phase]
    rows.sort(key=lambda row: (row["run_tag"], row["phase"], row["endpoint"], row.get("concurrency") or 0, row.get("iteration") or 0))

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    summary = build_summary(rows, runs)

    configure_fonts()
    save_summary_card(summary, out_dir / "summary.png")
    save_line_chart(rows, "rps", "吞吐量随并发变化", "每秒请求数（RPS）", out_dir / "rps_by_concurrency.png")
    save_line_chart(rows, "p95_ms", "P95 延迟随并发变化", "P95 延迟（ms）", out_dir / "p95_by_concurrency.png")
    save_line_chart(rows, "success_pct", "成功率随并发变化", "成功率（%）", out_dir / "success_by_concurrency.png")
    save_status_chart(rows, out_dir / "status_distribution.png")

    print(f"charts: {out_dir}")
    print(f"cases: {len(rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
