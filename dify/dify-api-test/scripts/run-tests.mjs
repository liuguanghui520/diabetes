import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const testFiles = [
  "tests/00-config.test.js",
  "tests/wf-data.test.js",
  "tests/wf-report.test.js",
  "tests/cf-assistant.test.js",
  "tests/wf-checkin.test.js",
  "tests/wf-plan.test.js",
  "tests/cf-admin.test.js",
  "tests/cf-doctor.test.js",
  "tests/wf-risk.test.js"
];

const vitestEntry = resolve("node_modules", "vitest", "vitest.mjs");
const fileTimeoutMs = Number(process.env.TEST_FILE_TIMEOUT_MS || 240000);

if (!existsSync(vitestEntry)) {
  console.error("缺少 Vitest 依赖，请先执行 npm install。");
  process.exit(1);
}

function runOneTestFile(file) {
  return new Promise((resolvePromise, reject) => {
    console.log(`\n==> ${file}`);

    const child = spawn(process.execPath, [vitestEntry, "run", file, "--testTimeout=180000"], {
      stdio: "inherit",
      env: process.env
    });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${file} 超过 ${fileTimeoutMs}ms 未结束，已终止。`));
    }, fileTimeoutMs);

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("exit", (code, signal) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${file} 执行失败，退出码 ${code ?? signal}。`));
    });
  });
}

try {
  for (const file of testFiles) {
    await runOneTestFile(file);
  }
  console.log("\n全部 Dify API 测试文件已通过。");
} catch (error) {
  console.error(`\n${error.message}`);
  process.exit(1);
}
