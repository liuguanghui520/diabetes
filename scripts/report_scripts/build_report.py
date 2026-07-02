#!/usr/bin/env python3
"""Build an interactive oha report from p0/p1 result directories."""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import html
import json
import math
import statistics
from pathlib import Path
from typing import Any


def load_json(path: Path) -> Any | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def parse_timestamp(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def seconds_to_ms(value: Any) -> float | None:
    if isinstance(value, (int, float)) and math.isfinite(value):
        return float(value) * 1000.0
    return None


def as_float(value: Any) -> float | None:
    if isinstance(value, (int, float)) and math.isfinite(value):
        return float(value)
    return None


def as_int(value: Any) -> int | None:
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return None


def read_cases(run_dir: Path) -> list[dict[str, Any]]:
    all_results = run_dir / "all_results.json"
    data = load_json(all_results)
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]

    cases_dir = run_dir / "cases"
    cases: list[dict[str, Any]] = []
    if cases_dir.is_dir():
        for case_file in sorted(cases_dir.glob("*.json")):
            item = load_json(case_file)
            if isinstance(item, dict):
                cases.append(item)
    return cases


def flatten_case(case: dict[str, Any], run_dir: Path) -> dict[str, Any]:
    meta = case.get("metadata") if isinstance(case.get("metadata"), dict) else {}
    oha = case.get("oha") if isinstance(case.get("oha"), dict) else {}
    summary = oha.get("summary") if isinstance(oha.get("summary"), dict) else {}
    latency = oha.get("latencyPercentiles") if isinstance(oha.get("latencyPercentiles"), dict) else {}
    first_byte = oha.get("firstBytePercentiles") if isinstance(oha.get("firstBytePercentiles"), dict) else {}
    status = oha.get("statusCodeDistribution") if isinstance(oha.get("statusCodeDistribution"), dict) else {}
    errors = oha.get("errorDistribution") if isinstance(oha.get("errorDistribution"), dict) else {}

    status_counts = {str(k): int(v) for k, v in status.items() if isinstance(v, (int, float))}
    error_counts = {str(k): int(v) for k, v in errors.items() if isinstance(v, (int, float))}
    total_status = sum(status_counts.values())
    non_2xx = sum(v for k, v in status_counts.items() if not k.startswith("2"))
    total_errors = sum(error_counts.values())
    total_requests = total_status + total_errors
    if total_requests == 0:
        total_requests = as_int(summary.get("totalRequests")) or total_status

    success_rate = as_float(summary.get("successRate"))
    if success_rate is not None:
        success_pct = success_rate * 100.0
    elif total_requests:
        success_pct = 100.0 * max(total_requests - non_2xx - total_errors, 0) / total_requests
    else:
        success_pct = None

    started = parse_timestamp(meta.get("started_at"))
    ended = parse_timestamp(meta.get("ended_at"))
    observed_seconds = None
    if started and ended:
        observed_seconds = max((ended - started).total_seconds(), 0.0)
    if observed_seconds is None:
        observed_seconds = as_float(summary.get("total"))

    run_tag = str(meta.get("run_tag") or run_dir.name)
    suite = run_tag.split("-", 1)[0] if "-" in run_tag else run_tag

    row = {
        "suite": suite,
        "run_tag": run_tag,
        "phase": meta.get("phase") or "unknown",
        "endpoint": meta.get("endpoint_name") or "unknown",
        "method": meta.get("method") or "",
        "path": meta.get("path") or "",
        "url": meta.get("url") or "",
        "duration": meta.get("duration") or "",
        "concurrency": as_int(meta.get("concurrency")),
        "iteration": as_int(meta.get("iteration")),
        "exit_code": as_int(meta.get("exit_code")),
        "started_at": meta.get("started_at") or "",
        "ended_at": meta.get("ended_at") or "",
        "observed_seconds": observed_seconds,
        "rps": as_float(summary.get("requestsPerSec")),
        "avg_ms": seconds_to_ms(summary.get("average")),
        "fastest_ms": seconds_to_ms(summary.get("fastest")),
        "slowest_ms": seconds_to_ms(summary.get("slowest")),
        "p50_ms": seconds_to_ms(latency.get("p50")),
        "p90_ms": seconds_to_ms(latency.get("p90")),
        "p95_ms": seconds_to_ms(latency.get("p95")),
        "p99_ms": seconds_to_ms(latency.get("p99")),
        "first_byte_avg_ms": seconds_to_ms((oha.get("details") or {}).get("firstByte", {}).get("average")),
        "first_byte_p95_ms": seconds_to_ms(first_byte.get("p95")),
        "success_pct": success_pct,
        "total_requests": total_requests,
        "non_2xx": non_2xx,
        "client_errors": total_errors,
        "status_counts": status_counts,
        "error_counts": error_counts,
        "raw_file": meta.get("raw_file") or "",
        "console_file": meta.get("console_file") or "",
        "case_file": meta.get("case_file") or "",
        "has_oha": bool(oha),
        "source_run_dir": str(run_dir),
    }
    return row


def collect_results(root: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    rows: list[dict[str, Any]] = []
    runs: list[dict[str, Any]] = []
    for run_dir in sorted(path for path in root.iterdir() if path.is_dir()):
        cases = read_cases(run_dir)
        manifest = run_dir / "manifest.jsonl"
        run_rows = [flatten_case(case, run_dir) for case in cases]
        rows.extend(run_rows)
        latest_started = sorted((r["started_at"] for r in run_rows if r["started_at"]), reverse=True)
        runs.append(
            {
                "run_tag": run_dir.name,
                "suite": run_dir.name.split("-", 1)[0] if "-" in run_dir.name else run_dir.name,
                "case_count": len(run_rows),
                "has_all_results": (run_dir / "all_results.json").exists(),
                "has_manifest": manifest.exists(),
                "latest_started_at": latest_started[0] if latest_started else "",
                "path": str(run_dir),
            }
        )
    return rows, runs


def finite_values(rows: list[dict[str, Any]], key: str) -> list[float]:
    values: list[float] = []
    for row in rows:
        value = row.get(key)
        if isinstance(value, (int, float)) and math.isfinite(value):
            values.append(float(value))
    return values


def percentile(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    values = sorted(values)
    index = (len(values) - 1) * pct
    low = math.floor(index)
    high = math.ceil(index)
    if low == high:
        return values[low]
    return values[low] + (values[high] - values[low]) * (index - low)


def build_summary(rows: list[dict[str, Any]], runs: list[dict[str, Any]]) -> dict[str, Any]:
    total_requests = sum(int(row.get("total_requests") or 0) for row in rows)
    non_2xx = sum(int(row.get("non_2xx") or 0) for row in rows)
    client_errors = sum(int(row.get("client_errors") or 0) for row in rows)
    rps_values = finite_values(rows, "rps")
    p95_values = finite_values(rows, "p95_ms")
    success_values = finite_values(rows, "success_pct")

    endpoint_count = len({row.get("endpoint") for row in rows})
    phases = sorted({str(row.get("phase")) for row in rows if row.get("phase")})
    suites = sorted({str(row.get("suite")) for row in rows if row.get("suite")})

    return {
        "generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "run_count": len(runs),
        "case_count": len(rows),
        "endpoint_count": endpoint_count,
        "phases": phases,
        "suites": suites,
        "total_requests": total_requests,
        "non_2xx": non_2xx,
        "client_errors": client_errors,
        "best_rps": max(rps_values) if rps_values else None,
        "median_p95_ms": percentile(p95_values, 0.5),
        "min_success_pct": min(success_values) if success_values else None,
        "avg_success_pct": statistics.fmean(success_values) if success_values else None,
    }


def write_csv(rows: list[dict[str, Any]], path: Path) -> None:
    fieldnames = [
        "suite",
        "run_tag",
        "phase",
        "endpoint",
        "method",
        "path",
        "duration",
        "concurrency",
        "iteration",
        "exit_code",
        "rps",
        "avg_ms",
        "p50_ms",
        "p95_ms",
        "p99_ms",
        "success_pct",
        "total_requests",
        "non_2xx",
        "client_errors",
        "started_at",
        "ended_at",
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})


def html_template(data: dict[str, Any]) -> str:
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    escaped_payload = html.escape(payload, quote=False)
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>oha API 性能测试报告</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f6f7f8;
      --panel: #ffffff;
      --panel-2: #eef2f5;
      --text: #1f2933;
      --muted: #64707d;
      --line: #d8dee5;
      --blue: #2563a8;
      --green: #1f7a4d;
      --orange: #b85c00;
      --red: #b42318;
      --ink: #111827;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    header {{
      border-bottom: 1px solid var(--line);
      background: #fff;
    }}
    .wrap {{
      max-width: 1440px;
      margin: 0 auto;
      padding: 20px 24px;
    }}
    .topbar {{
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-end;
    }}
    h1 {{
      margin: 0;
      font-size: 24px;
      font-weight: 680;
      letter-spacing: 0;
    }}
    .subtitle {{
      margin-top: 6px;
      color: var(--muted);
    }}
    .generated {{
      color: var(--muted);
      white-space: nowrap;
      font-size: 13px;
    }}
    .summary {{
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 12px;
      margin-top: 18px;
    }}
    .metric {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
    }}
    .metric .label {{
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .04em;
    }}
    .metric .value {{
      margin-top: 6px;
      font-size: 22px;
      font-weight: 700;
      color: var(--ink);
    }}
    main .wrap {{
      padding-top: 18px;
    }}
    .controls {{
      display: grid;
      grid-template-columns: 1.3fr repeat(4, minmax(140px, .6fr));
      gap: 10px;
      margin-bottom: 14px;
    }}
    label {{
      display: block;
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 4px;
    }}
    input, select {{
      width: 100%;
      height: 36px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      color: var(--text);
      padding: 0 10px;
      font: inherit;
    }}
    .grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      align-items: stretch;
    }}
    .panel {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      min-width: 0;
    }}
    .panel-header {{
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
    }}
    .panel-title {{
      font-weight: 680;
      color: var(--ink);
    }}
    .panel-note {{
      color: var(--muted);
      font-size: 12px;
    }}
    .chart {{
      height: 360px;
      padding: 10px 12px 14px;
    }}
    svg {{
      display: block;
      width: 100%;
      height: 100%;
    }}
    .axis, .gridline {{
      stroke: #cfd6dd;
      stroke-width: 1;
    }}
    .gridline {{
      stroke-dasharray: 3 4;
    }}
    .tick, .legend, .empty {{
      fill: var(--muted);
      font-size: 11px;
    }}
    .series-line {{
      fill: none;
      stroke-width: 2.2;
    }}
    .point {{
      stroke: #fff;
      stroke-width: 1.5;
      cursor: pointer;
    }}
    .bar {{
      cursor: pointer;
    }}
    .tooltip {{
      position: fixed;
      z-index: 20;
      pointer-events: none;
      background: #111827;
      color: #fff;
      border-radius: 6px;
      padding: 8px 10px;
      max-width: 320px;
      font-size: 12px;
      box-shadow: 0 6px 24px rgba(17, 24, 39, .18);
      opacity: 0;
      transform: translate(10px, 10px);
    }}
    .table-wrap {{
      margin-top: 14px;
      overflow: auto;
      max-height: 560px;
      border-top: 1px solid var(--line);
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      min-width: 1120px;
    }}
    th, td {{
      padding: 9px 10px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }}
    th {{
      position: sticky;
      top: 0;
      background: #f9fafb;
      color: #39424e;
      font-size: 12px;
      cursor: pointer;
      z-index: 1;
    }}
    td.num, th.num {{
      text-align: right;
      font-variant-numeric: tabular-nums;
    }}
    .tag {{
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      padding: 2px 7px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel-2);
      color: #344054;
      font-size: 12px;
      white-space: nowrap;
    }}
    .ok {{ color: var(--green); }}
    .warn {{ color: var(--orange); }}
    .bad {{ color: var(--red); }}
    details {{
      margin: 0;
    }}
    summary {{
      cursor: pointer;
      color: var(--blue);
      white-space: nowrap;
    }}
    pre {{
      white-space: pre-wrap;
      word-break: break-word;
      margin: 8px 0 0;
      color: #364152;
      background: #f6f7f8;
      padding: 8px;
      border: 1px solid var(--line);
      border-radius: 6px;
      max-width: 520px;
    }}
    .status-line {{
      margin: 10px 0 0;
      color: var(--muted);
      font-size: 13px;
    }}
    @media (max-width: 1100px) {{
      .summary {{ grid-template-columns: repeat(3, minmax(0, 1fr)); }}
      .controls {{ grid-template-columns: 1fr 1fr; }}
      .grid {{ grid-template-columns: 1fr; }}
      .topbar {{ align-items: flex-start; flex-direction: column; }}
    }}
    @media (max-width: 640px) {{
      .wrap {{ padding: 16px; }}
      .summary {{ grid-template-columns: 1fr 1fr; }}
      .controls {{ grid-template-columns: 1fr; }}
      h1 {{ font-size: 20px; }}
    }}
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <div class="topbar">
        <div>
          <h1>oha API 性能测试报告</h1>
          <div class="subtitle">汇总 P0 / P1 测试结果，查看吞吐量、延迟、成功率和状态码分布。</div>
        </div>
        <div class="generated" id="generated"></div>
      </div>
      <section class="summary" id="summary"></section>
    </div>
  </header>
  <main>
    <div class="wrap">
      <section class="controls">
        <div>
          <label for="search">接口或路径</label>
          <input id="search" placeholder="按接口、路径、运行批次筛选">
        </div>
        <div>
          <label for="suite">测试分组</label>
          <select id="suite"></select>
        </div>
        <div>
          <label for="phase">测试阶段</label>
          <select id="phase"></select>
        </div>
        <div>
          <label for="metric">主图指标</label>
          <select id="metric">
            <option value="rps">每秒请求数</option>
            <option value="p95_ms">P95 延迟</option>
            <option value="p99_ms">P99 延迟</option>
            <option value="avg_ms">平均延迟</option>
            <option value="success_pct">成功率</option>
          </select>
        </div>
        <div>
          <label for="run">运行批次</label>
          <select id="run"></select>
        </div>
      </section>

      <section class="grid">
        <article class="panel">
          <div class="panel-header">
            <div class="panel-title" id="mainChartTitle">指标随并发变化</div>
            <div class="panel-note">每条线代表一个接口</div>
          </div>
          <div class="chart"><svg id="lineChart" role="img"></svg></div>
        </article>
        <article class="panel">
          <div class="panel-header">
            <div class="panel-title">状态码分布</div>
            <div class="panel-note">按接口聚合</div>
          </div>
          <div class="chart"><svg id="statusChart" role="img"></svg></div>
        </article>
      </section>

      <section class="panel" style="margin-top:14px">
        <div class="panel-header">
          <div>
            <div class="panel-title">测试用例</div>
            <div class="status-line" id="rowCount"></div>
          </div>
          <div class="panel-note">点击表头排序</div>
        </div>
        <div class="table-wrap">
          <table id="casesTable"></table>
        </div>
      </section>
    </div>
  </main>
  <div class="tooltip" id="tooltip"></div>
  <script type="application/json" id="report-data">{escaped_payload}</script>
  <script>
    const DATA = JSON.parse(document.getElementById('report-data').textContent);
    const rows = DATA.rows || [];
    const summary = DATA.summary || {{}};
    const fmt = new Intl.NumberFormat('en-US', {{ maximumFractionDigits: 2 }});
    const intFmt = new Intl.NumberFormat('en-US', {{ maximumFractionDigits: 0 }});
    const palette = ['#2563a8', '#1f7a4d', '#b85c00', '#5f6b7a', '#0f766e', '#b42318', '#6b7280', '#8a4b0f'];
    const state = {{ sortKey: 'rps', sortDir: -1 }};

    const controls = {{
      search: document.getElementById('search'),
      suite: document.getElementById('suite'),
      phase: document.getElementById('phase'),
      metric: document.getElementById('metric'),
      run: document.getElementById('run'),
    }};

    function compact(value, suffix = '') {{
      if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a';
      return fmt.format(Number(value)) + suffix;
    }}

    function metricLabel(key) {{
      return {{
        rps: '每秒请求数',
        p95_ms: 'P95 延迟（ms）',
        p99_ms: 'P99 延迟（ms）',
        avg_ms: '平均延迟（ms）',
        success_pct: '成功率（%）'
      }}[key] || key;
    }}

    function escapeHtml(value) {{
      return String(value ?? '').replace(/[&<>"']/g, ch => ({{
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
      }}[ch]));
    }}

    function optionList(select, values, allLabel) {{
      const current = select.value;
      select.innerHTML = `<option value="">${{allLabel}}</option>` + values.map(v => `<option value="${{escapeHtml(v)}}">${{escapeHtml(v)}}</option>`).join('');
      if ([...select.options].some(o => o.value === current)) select.value = current;
    }}

    function init() {{
      document.getElementById('generated').textContent = `生成时间 ${{summary.generated_at || ''}}`;
      renderSummary();
      optionList(controls.suite, [...new Set(rows.map(r => r.suite).filter(Boolean))].sort(), '全部分组');
      optionList(controls.phase, [...new Set(rows.map(r => r.phase).filter(Boolean))].sort(), '全部阶段');
      optionList(controls.run, [...new Set(rows.map(r => r.run_tag).filter(Boolean))].sort(), '全部批次');
      Object.values(controls).forEach(el => el.addEventListener('input', render));
      window.addEventListener('resize', render);
      render();
    }}

    function renderSummary() {{
      const cards = [
        ['用例数', summary.case_count, ''],
        ['接口数', summary.endpoint_count, ''],
        ['总请求数', summary.total_requests, ''],
        ['最高 RPS', summary.best_rps, ''],
        ['P95 中位数', summary.median_p95_ms, ' ms'],
        ['最低成功率', summary.min_success_pct, '%'],
      ];
      document.getElementById('summary').innerHTML = cards.map(([label, value, suffix]) => `
        <div class="metric">
          <div class="label">${{label}}</div>
          <div class="value">${{suffix ? compact(value, suffix) : (Number.isInteger(value) ? intFmt.format(value) : compact(value))}}</div>
        </div>
      `).join('');
    }}

    function filteredRows() {{
      const q = controls.search.value.trim().toLowerCase();
      return rows.filter(r => {{
        if (controls.suite.value && r.suite !== controls.suite.value) return false;
        if (controls.phase.value && r.phase !== controls.phase.value) return false;
        if (controls.run.value && r.run_tag !== controls.run.value) return false;
        if (!q) return true;
        return [r.endpoint, r.path, r.run_tag, r.phase, r.suite].some(v => String(v || '').toLowerCase().includes(q));
      }});
    }}

    function render() {{
      const data = filteredRows();
      document.getElementById('mainChartTitle').textContent = metricLabel(controls.metric.value) + '随并发变化';
      drawLineChart(document.getElementById('lineChart'), data, controls.metric.value);
      drawStatusChart(document.getElementById('statusChart'), data);
      renderTable(data);
    }}

    function bounds(svg) {{
      const rect = svg.getBoundingClientRect();
      return {{ width: Math.max(rect.width, 320), height: Math.max(rect.height, 260) }};
    }}

    function clear(svg) {{
      while (svg.firstChild) svg.removeChild(svg.firstChild);
    }}

    function el(name, attrs = {{}}, text) {{
      const node = document.createElementNS('http://www.w3.org/2000/svg', name);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      if (text !== undefined) node.textContent = text;
      return node;
    }}

    function drawEmpty(svg, message) {{
      const {{width, height}} = bounds(svg);
      svg.setAttribute('viewBox', `0 0 ${{width}} ${{height}}`);
      svg.appendChild(el('text', {{ x: width / 2, y: height / 2, 'text-anchor': 'middle', class: 'empty' }}, message));
    }}

    function drawLineChart(svg, data, metric) {{
      clear(svg);
      const points = data.filter(r => Number.isFinite(r.concurrency) && Number.isFinite(r[metric]));
      if (!points.length) return drawEmpty(svg, '当前筛选条件下没有用例');

      const {{width, height}} = bounds(svg);
      const margin = {{ top: 18, right: 24, bottom: 42, left: 58 }};
      const plotW = width - margin.left - margin.right;
      const plotH = height - margin.top - margin.bottom;
      svg.setAttribute('viewBox', `0 0 ${{width}} ${{height}}`);

      const xs = [...new Set(points.map(p => p.concurrency))].sort((a,b) => a-b);
      const maxY = Math.max(...points.map(p => p[metric]), 1);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const x = v => margin.left + (xs.length === 1 ? plotW / 2 : (v - minX) / (maxX - minX || 1) * plotW);
      const y = v => margin.top + plotH - (v / maxY) * plotH;

      for (let i = 0; i <= 4; i++) {{
        const yy = margin.top + plotH * i / 4;
        const value = maxY * (1 - i / 4);
        svg.appendChild(el('line', {{ x1: margin.left, y1: yy, x2: width - margin.right, y2: yy, class: 'gridline' }}));
        svg.appendChild(el('text', {{ x: margin.left - 8, y: yy + 4, 'text-anchor': 'end', class: 'tick' }}, compact(value)));
      }}
      svg.appendChild(el('line', {{ x1: margin.left, y1: margin.top, x2: margin.left, y2: margin.top + plotH, class: 'axis' }}));
      svg.appendChild(el('line', {{ x1: margin.left, y1: margin.top + plotH, x2: width - margin.right, y2: margin.top + plotH, class: 'axis' }}));
      xs.forEach(v => svg.appendChild(el('text', {{ x: x(v), y: height - 16, 'text-anchor': 'middle', class: 'tick' }}, v)));

      const groups = new Map();
      points.forEach(p => {{
        const key = `${{p.suite}} / ${{p.endpoint}}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(p);
      }});

      let index = 0;
      for (const [name, items] of groups) {{
        const color = palette[index++ % palette.length];
        items.sort((a,b) => a.concurrency - b.concurrency);
        const d = items.map((p, i) => `${{i ? 'L' : 'M'}} ${{x(p.concurrency)}} ${{y(p[metric])}}`).join(' ');
        svg.appendChild(el('path', {{ d, stroke: color, class: 'series-line' }}));
        items.forEach(p => {{
          const point = el('circle', {{ cx: x(p.concurrency), cy: y(p[metric]), r: 4, fill: color, class: 'point' }});
          point.addEventListener('mouseenter', ev => showTip(ev, `${{name}}<br>c=${{p.concurrency}}, ${{metricLabel(metric)}}=${{compact(p[metric])}}<br>${{p.phase}} · ${{p.run_tag}}`));
          point.addEventListener('mousemove', moveTip);
          point.addEventListener('mouseleave', hideTip);
          svg.appendChild(point);
        }});
      }}
    }}

    function drawStatusChart(svg, data) {{
      clear(svg);
      const grouped = new Map();
      data.forEach(r => {{
        const key = `${{r.suite}} / ${{r.endpoint}}`;
        if (!grouped.has(key)) grouped.set(key, {{ ok: 0, non2xx: 0, errors: 0 }});
        const g = grouped.get(key);
        g.ok += Object.entries(r.status_counts || {{}}).filter(([code]) => code.startsWith('2')).reduce((s, [,v]) => s + Number(v || 0), 0);
        g.non2xx += Number(r.non_2xx || 0);
        g.errors += Number(r.client_errors || 0);
      }});
      const items = [...grouped.entries()].map(([name, v]) => ({{ name, ...v, total: v.ok + v.non2xx + v.errors }})).filter(v => v.total > 0).sort((a,b) => b.total - a.total).slice(0, 12);
      if (!items.length) return drawEmpty(svg, '当前筛选条件下没有状态码数据');

      const {{width, height}} = bounds(svg);
      const margin = {{ top: 18, right: 24, bottom: 34, left: 150 }};
      const plotW = width - margin.left - margin.right;
      const rowH = Math.max(18, Math.min(28, (height - margin.top - margin.bottom) / items.length));
      svg.setAttribute('viewBox', `0 0 ${{width}} ${{height}}`);
      items.forEach((item, i) => {{
        const yy = margin.top + i * rowH;
        let xx = margin.left;
        const segments = [
          ['2xx', item.ok, '#1f7a4d'],
          ['非 2xx', item.non2xx, '#b85c00'],
          ['客户端错误', item.errors, '#b42318'],
        ];
        svg.appendChild(el('text', {{ x: margin.left - 8, y: yy + rowH * .65, 'text-anchor': 'end', class: 'tick' }}, item.name.slice(0, 24)));
        segments.forEach(([label, value, color]) => {{
          const w = plotW * value / item.total;
          if (w > 0) {{
            const rect = el('rect', {{ x: xx, y: yy + 3, width: Math.max(w, 1), height: rowH - 7, fill: color, rx: 2, class: 'bar' }});
            rect.addEventListener('mouseenter', ev => showTip(ev, `${{item.name}}<br>${{label}}: ${{intFmt.format(value)}}`));
            rect.addEventListener('mousemove', moveTip);
            rect.addEventListener('mouseleave', hideTip);
            svg.appendChild(rect);
          }}
          xx += w;
        }});
      }});
      [['2xx', '#1f7a4d'], ['非 2xx', '#b85c00'], ['客户端错误', '#b42318']].forEach(([label, color], i) => {{
        const x = margin.left + i * 110;
        svg.appendChild(el('rect', {{ x, y: height - 20, width: 10, height: 10, fill: color, rx: 2 }}));
        svg.appendChild(el('text', {{ x: x + 16, y: height - 11, class: 'legend' }}, label));
      }});
    }}

    function showTip(ev, html) {{
      const tip = document.getElementById('tooltip');
      tip.innerHTML = html;
      tip.style.opacity = '1';
      moveTip(ev);
    }}
    function moveTip(ev) {{
      const tip = document.getElementById('tooltip');
      tip.style.left = ev.clientX + 'px';
      tip.style.top = ev.clientY + 'px';
    }}
    function hideTip() {{
      document.getElementById('tooltip').style.opacity = '0';
    }}

    const columns = [
      ['suite', '分组'], ['phase', '阶段'], ['endpoint', '接口'], ['concurrency', '并发'],
      ['rps', 'RPS'], ['avg_ms', '平均 ms'], ['p95_ms', 'P95 ms'], ['p99_ms', 'P99 ms'],
      ['success_pct', '成功率'], ['non_2xx', '非 2xx'], ['client_errors', '客户端错误'], ['details', '详情']
    ];

    function renderTable(data) {{
      const table = document.getElementById('casesTable');
      const sorted = [...data].sort((a,b) => compare(a[state.sortKey], b[state.sortKey]) * state.sortDir);
      document.getElementById('rowCount').textContent = `当前显示 ${{sorted.length}} 条用例`;
      table.innerHTML = `
        <thead><tr>${{columns.map(([key, label]) => `<th class="${{['concurrency','rps','avg_ms','p95_ms','p99_ms','success_pct','non_2xx','client_errors'].includes(key) ? 'num' : ''}}" data-key="${{key}}">${{label}}${{state.sortKey === key ? (state.sortDir > 0 ? ' ↑' : ' ↓') : ''}}</th>`).join('')}}</tr></thead>
        <tbody>${{sorted.map(rowHtml).join('')}}</tbody>
      `;
      table.querySelectorAll('th[data-key]').forEach(th => th.addEventListener('click', () => {{
        const key = th.dataset.key;
        if (key === 'details') return;
        if (state.sortKey === key) state.sortDir *= -1;
        else {{ state.sortKey = key; state.sortDir = key === 'endpoint' || key === 'phase' || key === 'suite' ? 1 : -1; }}
        renderTable(data);
      }}));
    }}

    function compare(a, b) {{
      const an = Number(a), bn = Number(b);
      if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
      return String(a ?? '').localeCompare(String(b ?? ''));
    }}

    function rowHtml(r) {{
      const healthClass = (r.non_2xx || r.client_errors) ? 'warn' : 'ok';
      const status = JSON.stringify(r.status_counts || {{}});
      const errors = JSON.stringify(r.error_counts || {{}});
      return `<tr>
        <td><span class="tag">${{escapeHtml(r.suite)}}</span></td>
        <td>${{escapeHtml(r.phase)}}</td>
        <td><strong>${{escapeHtml(r.endpoint)}}</strong><br><span class="panel-note">${{escapeHtml(r.path)}}</span></td>
        <td class="num">${{r.concurrency ?? ''}}</td>
        <td class="num">${{compact(r.rps)}}</td>
        <td class="num">${{compact(r.avg_ms)}}</td>
        <td class="num">${{compact(r.p95_ms)}}</td>
        <td class="num">${{compact(r.p99_ms)}}</td>
        <td class="num ${{healthClass}}">${{compact(r.success_pct, '%')}}</td>
        <td class="num">${{intFmt.format(r.non_2xx || 0)}}</td>
        <td class="num">${{intFmt.format(r.client_errors || 0)}}</td>
        <td><details><summary>查看</summary><pre>批次: ${{escapeHtml(r.run_tag)}}\\n状态码: ${{escapeHtml(status)}}\\n错误: ${{escapeHtml(errors)}}\\n原始文件: ${{escapeHtml(r.raw_file || '')}}</pre></details></td>
      </tr>`;
    }}

    init();
  </script>
</body>
</html>
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Build an interactive report from oha result directories.")
    parser.add_argument("--results", default="oha-results", help="Result root directory. Default: oha-results")
    parser.add_argument("--out", default="oha-results/report.html", help="HTML output path. Default: oha-results/report.html")
    parser.add_argument("--summary-json", default="oha-results/report-summary.json", help="Summary JSON output path.")
    parser.add_argument("--csv", default="oha-results/report-cases.csv", help="Flattened CSV output path.")
    args = parser.parse_args()

    results_root = Path(args.results)
    if not results_root.is_dir():
        raise SystemExit(f"results directory not found: {results_root}")

    rows, runs = collect_results(results_root)
    rows.sort(key=lambda row: (row["run_tag"], row["phase"], row["endpoint"], row.get("concurrency") or 0, row.get("iteration") or 0))
    summary = build_summary(rows, runs)
    data = {"summary": summary, "runs": runs, "rows": rows}

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html_template(data), encoding="utf-8")

    summary_path = Path(args.summary_json)
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    csv_path = Path(args.csv)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    write_csv(rows, csv_path)

    print(f"report: {out_path}")
    print(f"summary: {summary_path}")
    print(f"csv: {csv_path}")
    print(f"cases: {len(rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
