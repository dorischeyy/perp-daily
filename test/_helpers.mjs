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
  const newsSection = (id, title) => ({
    id,
    title,
    items: Array.from({ length: 3 }, (_, i) => ({
      headline: id === "perpdex" && i === 0 ? "标题" : `${title} 示例 ${i + 1}`,
      body: [id === "perpdex" ? `**事件**：${title} 示例事实 ${i + 1}` : `${title} 示例事实 ${i + 1}`],
      source: "S",
      url: id === "perpdex" && i === 0 ? "https://example.com/a" : `https://example.com/${id}-${i + 1}`,
      date: "2026-06-23",
    })),
  });
  return {
    date: "2026-06-23",
    edition: 1,
    lead: "近期永续市场的竞争正在从扩充标的数量，转向验证真实订单流与持仓质量。",
    sections: [
      newsSection("perpdex", "Perp DEX"),
      newsSection("launchpad", "Launchpad"),
      newsSection("crypto", "Crypto"),
      newsSection("ai", "AI"),
    ],
    ...overrides,
  };
}
