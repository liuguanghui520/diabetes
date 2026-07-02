# 运行方式

## p0

```sh
chmod +x run_p0_oha.sh

# 默认本地 Vite 代理地址
./run_p0_oha.sh

# 指定测试环境
BASE_URL="http://127.0.0.1:3000" ./run_p0_oha.sh

# 指定详情接口 ID，避免默认 /:id=1 不存在
BASE_URL="http://127.0.0.1:3000" ARTICLE_ID=12 DOCTOR_ID=3 ./run_p0_oha.sh

# 调整压测强度
BASE_URL="http://127.0.0.1:3000" \
PERF_CONCURRENCIES="10 30 50" \
STRESS_CONCURRENCIES="100 200 500 1000" \
PERF_DURATION="30s" \
STRESS_DURATION="90s" \
./run_p0_oha.sh
```

## p1

```sh
chmod +x run_p1_oha.sh

# 方式 1：直接传 token，推荐
BASE_URL="http://127.0.0.1:3000" \
AUTH_TOKEN="你的JWT_TOKEN" \
./run_p1_oha.sh

# 方式 2：自动登录获取 token
BASE_URL="http://127.0.0.1:3000" \
LOGIN_ACCOUNT="testuser" \
LOGIN_PASSWORD="123456" \
./run_p1_oha.sh

# 指定医生 ID 和会话 ID，避免自动发现不到时跳过详情消息接口
BASE_URL="http://127.0.0.1:3000" \
AUTH_TOKEN="你的JWT_TOKEN" \
DOCTOR_ID=3 \
ASSISTANT_CONVERSATION_ID=12 \
DOCTOR_CONVERSATION_ID=8 \
./run_p1_oha.sh

# 调整压测强度
BASE_URL="http://127.0.0.1:3000" \
AUTH_TOKEN="你的JWT_TOKEN" \
PERF_CONCURRENCIES="10 30 50" \
STRESS_CONCURRENCIES="100 200 500" \
PERF_DURATION="30s" \
STRESS_DURATION="90s" \
REPEAT=2 \
./run_p1_oha.sh
```

## report

生成 P0/P1 汇总数据、CSV 和可交互 HTML 报告。这个脚本只使用 Python 标准库，
不需要安装绘图库：

```sh
python report_scripts/build_report.py
```

默认输出：

```text
oha-results/report.html
oha-results/report-summary.json
oha-results/report-cases.csv
```

脚本会优先读取每个 run 的 `all_results.json`；
如果该文件还没生成，会读取已经落盘的 `cases/*.json`，生成阶段性报告。

指定输入和输出路径：

```sh
python report_scripts/build_report.py \
  --results oha-results \
  --out oha-results/report.html \
  --summary-json oha-results/report-summary.json \
  --csv oha-results/report-cases.csv
```

Linux/macOS 也可以使用包装脚本：

```sh
./report_scripts/build_report.sh
```

生成静态 PNG 图表需要 `matplotlib`。推荐用 `uv` 创建本地虚拟环境并安装依赖：

```sh
uv venv
uv pip install -r requirements-report.txt
```

Linux/macOS:

```sh
. .venv/bin/activate
python report_scripts/plot_report_images.py
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
python report_scripts\plot_report_images.py
```

默认输出图片：

```text
oha-results/charts/summary.png
oha-results/charts/rps_by_concurrency.png
oha-results/charts/p95_by_concurrency.png
oha-results/charts/success_by_concurrency.png
oha-results/charts/status_distribution.png
```

只绘制某个分组或阶段：

```sh
python report_scripts/plot_report_images.py --suite p0
python report_scripts/plot_report_images.py --phase stress
```
