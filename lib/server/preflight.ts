/**
 * 部署前凭据自查。
 *
 * 设计原则：本仓库**不内置任何第三方凭据**，腾讯地图与大模型 Key 必须由部署者
 * 用自己的账号申请。这个模块只报告「配了什么 / 缺什么 / 缺了会怎样」，并且**绝不
 * 输出凭据本身**（只报长度）。
 *
 * 被三处复用：`npm run preflight`（严格，缺必需项 exit 1）、容器首启引导
 * `scripts/bootstrap.ts` 与本地 `npm run setup`（只报告，不阻塞启动）。
 */
import fs from 'node:fs';
import path from 'node:path';

export type PreflightLevel = 'error' | 'warning' | 'optional' | 'ok';

export interface PreflightItem {
  /** 相关环境变量名（多个表示互为备选）。 */
  keys: string[];
  /** 这项凭据让哪个功能可用。 */
  feature: string;
  level: PreflightLevel;
  /** 实测结论：配了就写长度，没配写后果。 */
  detail: string;
  /** 怎么拿到 / 怎么设置。 */
  hint?: string;
}

export interface PreflightReport {
  items: PreflightItem[];
  errors: number;
  warnings: number;
  /** 无 error 时为 true（warning 不影响启动）。 */
  ok: boolean;
}

export interface PreflightOptions {
  /** 默认取 DATA_DIR；显式传入便于测试。 */
  dataDir?: string;
  /** 跳过数据目录可写性探测（纯逻辑测试用）。 */
  skipDataDirCheck?: boolean;
}

const SECRET_MIN_LENGTH = 32;

function envValue(name: string): string {
  return (process.env[name] ?? '').trim();
}

/** 只暴露「配没配」与长度，绝不回显凭据内容。 */
function describeSecret(value: string): string {
  return value ? `已配置（${value.length} 字符）` : '未配置';
}

function dataDirWritable(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function runPreflight(options: PreflightOptions = {}): PreflightReport {
  const items: PreflightItem[] = [];

  // ── 会话密钥 ────────────────────────────────────────────────
  const sessionSecret = envValue('SESSION_SECRET');
  items.push(
    sessionSecret.length >= SECRET_MIN_LENGTH
      ? {
          keys: ['SESSION_SECRET'],
          feature: '后台会话签名与匿名来源指纹',
          level: 'ok',
          detail: describeSecret(sessionSecret),
        }
      : sessionSecret
        ? {
            keys: ['SESSION_SECRET'],
            feature: '后台会话签名与匿名来源指纹',
            level: 'error',
            detail: `已配置但只有 ${sessionSecret.length} 字符，必须 ≥ ${SECRET_MIN_LENGTH} 字符，否则后台登录会失败`,
            hint: '换成一个 ≥32 字符的随机串（例如 openssl rand -base64 32）',
          }
        : {
            keys: ['SESSION_SECRET'],
            feature: '后台会话签名与匿名来源指纹',
            level: 'warning',
            detail: '未配置：容器首次启动会自动生成并持久化到 /data/.session-secret；本机由 npm run setup 写入 .env.local',
            hint: '自建部署建议显式设置一个 ≥32 字符的随机串，避免换机器后旧会话失效',
          },
  );

  // ── 管理后台 ────────────────────────────────────────────────
  const adminHash = envValue('ADMIN_PASSWORD_HASH');
  const adminPassword = envValue('ADMIN_PASSWORD');
  items.push(
    adminHash || adminPassword
      ? {
          keys: ['ADMIN_PASSWORD_HASH', 'ADMIN_PASSWORD'],
          feature: '管理后台登录',
          level: 'ok',
          detail: adminHash
            ? `已配置密码哈希（用户名 ${envValue('ADMIN_USERNAME') || 'admin'}）`
            : `已配置明文密码，仅用于首次初始化（用户名 ${envValue('ADMIN_USERNAME') || 'admin'}）`,
        }
      : {
          keys: ['ADMIN_PASSWORD_HASH', 'ADMIN_PASSWORD'],
          feature: '管理后台登录',
          level: 'warning',
          detail: '未配置：前台地图、投稿、公开接口照常工作，但 /admin 无法登录，投稿无法审核',
          hint: '设置 ADMIN_PASSWORD（≥12 字符），或用 npm run admin:password 生成 ADMIN_PASSWORD_HASH',
        },
  );

  // ── 地图底图（浏览器端 Key，构建期内联）─────────────────────
  const mapMode = envValue('NEXT_PUBLIC_MAP_MODE') || 'demo';
  const mapKey = envValue('NEXT_PUBLIC_TENCENT_MAP_KEY');
  if (mapMode === 'tencent') {
    items.push(
      mapKey
        ? {
            keys: ['NEXT_PUBLIC_TENCENT_MAP_KEY'],
            feature: '腾讯真实底图（NEXT_PUBLIC_MAP_MODE=tencent）',
            level: 'ok',
            detail: describeSecret(mapKey),
          }
        : {
            keys: ['NEXT_PUBLIC_TENCENT_MAP_KEY'],
            feature: '腾讯真实底图（NEXT_PUBLIC_MAP_MODE=tencent）',
            level: 'error',
            detail:
              '模式选了 tencent 但浏览器端 Key 未配置：地图会安全回退为内置纸上地图',
            hint:
              '要么填上你自己的腾讯位置服务 JS API GL Key（需在腾讯控制台绑定你自己的域名白名单），' +
              '要么把 NEXT_PUBLIC_MAP_MODE 改回 demo。注意 NEXT_PUBLIC_* 是构建期内联，改完必须重新 build',
          },
    );
  } else {
    items.push(
      mapKey
        ? {
            keys: ['NEXT_PUBLIC_MAP_MODE', 'NEXT_PUBLIC_TENCENT_MAP_KEY'],
            feature: '地图底图',
            level: 'warning',
            detail:
              'Key 已配置，但 NEXT_PUBLIC_MAP_MODE 不是 tencent，浏览器端不会加载腾讯底图（当前使用内置纸上地图）',
            hint: '想用真实底图就把 NEXT_PUBLIC_MAP_MODE 设为 tencent，并重新 build',
          }
        : {
            keys: ['NEXT_PUBLIC_MAP_MODE', 'NEXT_PUBLIC_TENCENT_MAP_KEY'],
            feature: '地图底图',
            level: 'ok',
            detail: '使用内置纸上地图：不需要网络、账号或任何 Key',
          },
    );
  }

  // ── 服务端地理编码（选填）───────────────────────────────────
  const geocodeKey =
    envValue('TENCENT_MAP_WEB_SERVICE_KEY') || envValue('TENCENT_MAP_KEY');
  items.push(
    geocodeKey
      ? {
          keys: ['TENCENT_MAP_WEB_SERVICE_KEY'],
          feature: '后台「地址 → GCJ-02 坐标」自动地理编码',
          level: 'ok',
          detail: describeSecret(geocodeKey),
        }
      : {
          keys: ['TENCENT_MAP_WEB_SERVICE_KEY'],
          feature: '后台「地址 → GCJ-02 坐标」自动地理编码',
          level: 'optional',
          detail: '未配置：后台注册与导入时改为人工填写 / 点选坐标，功能不受影响',
          hint:
            '选填。要用就填你自己的腾讯位置服务 WebService Key（腾讯侧可绑定 IP 白名单，不适合借用他人的 Key）',
        },
  );

  // ── 采集脚本（选填，不影响站点运行）─────────────────────────
  const minimaxKey = envValue('MINIMAX_API_KEY');
  items.push(
    minimaxKey
      ? {
          keys: ['MINIMAX_API_KEY'],
          feature: 'npm run collect:web（搜索引擎 + 大模型抽取）',
          level: 'ok',
          detail: describeSecret(minimaxKey),
        }
      : {
          keys: ['MINIMAX_API_KEY'],
          feature: 'npm run collect:web（搜索引擎 + 大模型抽取）',
          level: 'optional',
          detail: '未配置：该采集脚本不可用；站点运行与人工录入不受影响',
          hint:
            '选填。大模型 Key 按调用量计费且归属你的账号，必须用你自己申请的 Key',
        },
  );

  const bilibiliCookie = envValue('BILIBILI_COOKIE');
  items.push(
    bilibiliCookie
      ? {
          keys: ['BILIBILI_COOKIE'],
          feature: 'npm run collect:creators（B站元数据采集）',
          level: 'ok',
          detail: describeSecret(bilibiliCookie),
        }
      : {
          keys: ['BILIBILI_COOKIE'],
          feature: 'npm run collect:creators（B站元数据采集）',
          level: 'optional',
          detail: '未配置：仍可匿名抓取，但更容易遇到 -412 限流',
          hint: '选填。填你自己的浏览器 Cookie 可降低限流概率',
        },
  );

  // ── 数据目录可写（容器卷挂载错误时最常见）──────────────────
  if (!options.skipDataDirCheck) {
    const dir = options.dataDir ?? envValue('DATA_DIR') ?? 'data';
    const absolute = path.resolve(dir);
    const writable = dataDirWritable(absolute);
    items.push({
      keys: ['DATA_DIR'],
      feature: `数据目录可写（${absolute}）`,
      level: writable ? 'ok' : 'error',
      detail: writable
        ? '可写'
        : '不可写：数据库、上传与备份都无法落盘，容器通常是卷挂载权限问题',
      hint: writable
        ? undefined
        : '检查卷挂载与目录属主（镜像内以 node 用户运行，命名卷默认权限正确）',
    });
  }

  const errors = items.filter((item) => item.level === 'error').length;
  const warnings = items.filter((item) => item.level === 'warning').length;
  return { items, errors, warnings, ok: errors === 0 };
}

const MARKERS: Record<PreflightLevel, string> = {
  error: '✗',
  warning: '!',
  optional: '-',
  ok: '✓',
};

const ORDER: Record<PreflightLevel, number> = {
  error: 0,
  warning: 1,
  optional: 2,
  ok: 3,
};

/** 人类可读报告。只包含「配没配」与长度，不含凭据内容。 */
export function formatPreflight(report: PreflightReport): string {
  const lines: string[] = [];
  lines.push('街头饭签 · 部署前凭据自查');
  lines.push(
    '本仓库不内置任何第三方凭据：腾讯地图 Key、大模型 Key 都必须用你自己账号申请的值。',
  );
  lines.push('');
  for (const item of [...report.items].sort(
    (a, b) => ORDER[a.level] - ORDER[b.level],
  )) {
    lines.push(
      `${MARKERS[item.level]} ${item.keys.join(' / ')} — ${item.feature}`,
    );
    lines.push(`    ${item.detail}`);
    if (item.hint && item.level !== 'ok') lines.push(`    ↳ ${item.hint}`);
  }
  lines.push('');
  if (report.errors) {
    lines.push(
      `结论：${report.errors} 项配置错误、${report.warnings} 项警告——请先按上面提示修正再部署。`,
    );
  } else if (report.warnings) {
    lines.push(
      `结论：可以启动，但有 ${report.warnings} 项警告（见上方 ! ）——功能会按说明降级。`,
    );
  } else {
    lines.push('结论：配置完整，可以直接启动。');
  }
  return lines.join('\n');
}
