/**
 * `npm run preflight` —— 部署前凭据自查。
 *
 * 默认严格模式：只要存在「配置错误」（例如选了腾讯底图却没给 Key、SESSION_SECRET
 * 太短、数据目录不可写）就以 exit 1 结束，方便在 CI / 部署脚本里卡住。
 * 加 `--warn-only` 则只报告不失败（容器首启引导用的是这个模式，避免配置错误导致
 * 容器反复重启）。
 */
import { formatPreflight, runPreflight } from '../lib/server/preflight';
import { loadLocalEnv } from './load-env';

// 让 `npm run preflight` 也能读到项目根目录的 .env / .env.local。
loadLocalEnv();

const warnOnly = process.argv.includes('--warn-only');
const report = runPreflight();

console.log(
  '配置位置：项目根目录的 .env（从 .env.example 复制后填写）；用 Docker 时由 docker-compose 的变量插值传入。',
);
console.log('这些凭据必须由你本人申请，仓库与镜像里不包含任何 Key。');
console.log('');
console.log(formatPreflight(report));

if (!warnOnly && !report.ok) process.exit(1);
