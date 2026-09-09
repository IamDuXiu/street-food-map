import os from 'node:os';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '3000';
const isPrivateIpv4 = (address) => {
  const parts = address.split('.').map(Number);
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
};
const addresses = Object.entries(os.networkInterfaces())
  .flatMap(([name, items]) =>
    (items ?? []).map((item) => ({ name, ...item })),
  )
  .filter(
    (item) =>
      !item.internal &&
      item.family === 'IPv4' &&
      isPrivateIpv4(item.address),
  )
  .sort((left, right) => {
    const rank = (name) =>
      name === 'en0' ? 0 : name.startsWith('utun') ? 2 : 1;
    return rank(left.name) - rank(right.name);
  })
  .map((item) => `http://${item.address}:${port}`);

console.warn('\n街头饭签局域网测试模式');
console.warn('仅在你信任的 Wi‑Fi/个人热点使用；测试结束请回到终端按 Ctrl-C 停止。');
console.warn('不要把后台地址、管理员密码或数据库/上传目录交给受试者。');
console.warn(`本机访问：http://127.0.0.1:${port}`);
if (addresses.length) {
  console.warn(`同网访问（优先尝试）：${addresses[0]}`);
  if (addresses.length > 1)
    console.warn(`若无法打开，再尝试：${addresses.slice(1).join('  ')}`);
}
else console.warn('未发现可展示的局域网 IPv4 地址，请查看系统网络设置。');
console.warn('真实高德、公网代理和生产安全边界未在本入口中验证。\n');

const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '0.0.0.0', '--port', port], {
  stdio: 'inherit',
  env: process.env,
});
const stop = (signal) => child.kill(signal);
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
