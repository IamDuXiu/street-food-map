import { SiteHeader } from '@/components/site-header';
import { HomeClient } from '@/components/home-client';
import styles from '@/components/home-client.module.css';

export default function HomePage() { return <div className={styles.publicHome}><SiteHeader /><HomeClient /><footer className="site-footer"><span>街头饭签 · 平价餐食地图</span><span>具体餐食 · 具体价格 · 具体核验日期</span></footer></div>; }
