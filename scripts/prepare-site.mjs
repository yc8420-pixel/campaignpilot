// Creates a self-contained publication checkout; the primary repository remains the GitHub deliverable.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
const dir = "sites/campaignpilot-publish";
mkdirSync(dir, { recursive: true });
cpSync("src", `${dir}/src`, { recursive: true });
cpSync("sites/campaignpilot-demo/dist", `${dir}/dist`, { recursive: true });
cpSync("sites/campaignpilot-demo/.openai", `${dir}/.openai`, {
  recursive: true,
});
cpSync("sites/campaignpilot-demo/index.html", `${dir}/index.html`);
writeFileSync(
  `${dir}/main.tsx`,
  readFileSync("sites/campaignpilot-demo/main.tsx", "utf8").replace(
    "../../src/ui/App",
    "./src/ui/App",
  ),
);
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.scripts = {
  dev: "vite --host 127.0.0.1",
  build: "vite build",
  preview: "vite preview",
};
writeFileSync(`${dir}/package.json`, JSON.stringify(pkg, null, 2));
cpSync("package-lock.json", `${dir}/package-lock.json`);
writeFileSync(
  `${dir}/vite.config.ts`,
  'import {defineConfig} from "vite";import react from "@vitejs/plugin-react";export default defineConfig({plugins:[react()],build:{outDir:"dist"}});\n',
);
writeFileSync(`${dir}/.gitignore`, "node_modules/\n.env*\n.DS_Store\n");
writeFileSync(
  `${dir}/README.md`,
  "# 营策台静态演示发布源\n\n虚构品牌、模拟数据、预生成响应；实际编辑/审核/导出/CSV指标在浏览器内执行。\n\nNode 24；npm ci；npm run build。dist 为本次验证后的静态产物。完整 Next.js、SQL、测试、文档在用户工作区的 CampaignPilot 主仓库。此发布仓库不是 GitHub 仓库。\n",
);
console.log(
  `Prepared ${dir}; source and existing built assets copied, no credentials included.`,
);
