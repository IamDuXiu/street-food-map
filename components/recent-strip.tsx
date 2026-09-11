'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatPrice, lowestMeal } from '@/lib/filter';
import { relativeVerificationLabel } from '@/lib/freshness';
import type { Place } from '@/lib/types';
import styles from './recent-strip.module.css';

type RecentPlace = Place & { zoneName?: string };

export function RecentStrip() {
  const [items, setItems] = useState<RecentPlace[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/recent?days=7&limit=3')
      .then((response) =>
        response.ok
          ? (response.json() as Promise<{ data?: RecentPlace[] }>)
          : Promise.reject(new Error('RECENT_FAILED')),
      )
      .then((payload) => {
        if (cancelled) return;
        if (payload.data?.length) setItems(payload.data.slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed || !items.length) return null;

  return (
    <section className={styles.recentStrip} aria-label="最近核验">
      <h2 className={styles.recentStripTitle}>最近核验</h2>
      <ul className={styles.recentStripList}>
        {items.map((place) => {
          const meal = lowestMeal(place);
          const latest =
            place.meals.reduce<string>(
              (max, current) =>
                current.observedAt > max ? current.observedAt : max,
              place.meals[0]?.observedAt ?? '',
            );
          return (
            <li key={place.id}>
              <Link className={styles.recentStripItem} href={`/places/${place.id}`}>
                <strong>{place.name}</strong>
                <span>{meal ? formatPrice(meal.priceFen) : '—'}</span>
                <span className={styles.recentStripAge}>
                  {relativeVerificationLabel({ observedAt: latest })}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
