// 测试公共工具：跑脚本拿退出码 + 写临时 JSON
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// 运行一个 node 脚本，返回 {code, out}（不抛异常，便于断言退出码）
export function run(args) {
  try {
    const out = execFileSync("node", args, { encoding: "utf8" });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout || ""}${e.stderr || ""}` };
  }
}

const dir = mkdtempSync(join(tmpdir(), "perp-daily-test-"));
let n = 0;
// 把对象写成临时 json 文件，返回路径
export function tmpJson(obj) {
  const p = join(dir, `t${n++}.json`);
  writeFileSync(p, JSON.stringify(obj));
  return p;
}

// 一份结构合法的 content 基线，测试可在其上改字段
export function baseContent(overrides = {}) {
  return {
    date: "2026-06-23",
    edition: 1,
    lead: "测试导语",
    sections: [
      {
        id: "perpdex",
        title: "Perp DEX",
        items: [
          { headline: "标题", body: ["**事件**：x"], source: "S", url: "https://example.com/a", date: "2026-06-23" },
        ],
      },
    ],
    ...overrides,
  };
}
