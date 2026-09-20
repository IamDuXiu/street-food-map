import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: '街头饭签 · 全国 5 城平价餐食地图', description: '给想吃饱又想省钱的人的务实吃饭地图。', icons: { icon: '/icon.svg' } };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
