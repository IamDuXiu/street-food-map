import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: '街头饭签 · 深圳平价餐食地图', description: '给深圳学生和上班族的务实吃饭地图。', icons: { icon: '/icon.svg' } };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
