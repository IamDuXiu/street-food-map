import { AdminShell, AdminTitle } from '@/components/admin-shell';
import {
  MediaReviewActions,
  SubmissionActions,
} from '@/components/admin-actions';
import { openDatabase } from '@/lib/server/db';
import { listSubmissionMedia, listSubmissions } from '@/lib/server/repository';
import { requireAdminPage } from '@/lib/server/page-auth';
import Image from 'next/image';
import Link from 'next/link';

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  await requireAdminPage();
  const db = openDatabase();
  const items = listSubmissions(db);
  const requestedId = (await searchParams).id;
  const active = items.find((item) => item.id === requestedId) ?? items[0];
  const payload = active
    ? (JSON.parse(active.payload_json ?? '{}') as Record<string, unknown>)
    : {};
  const media = active ? listSubmissionMedia(db, active.id) : [];
  return (
    <AdminShell active="/admin/submissions">
      <AdminTitle eyebrow="03 / SUBMISSIONS" title="投稿审核队列">
        <span className="demo-pill">
          <span className="status-dot" />
          数据库工作台
        </span>
      </AdminTitle>
      <div className="review-layout">
        <section className="review-list">
          {items.map((item) => (
            <Link
              href={`/admin/submissions?id=${encodeURIComponent(item.id)}`}
              className={`review-item${item.id === active?.id ? ' active' : ''}`}
              key={item.id}
            >
              <span className="inbox-type">
                {item.type} · #{item.id.slice(-6)}
              </span>
              <h2>
                {item.target_place_id ||
                  String(
                    (
                      JSON.parse(item.payload_json ?? '{}') as Record<
                        string,
                        unknown
                      >
                    ).placeName ||
                      (
                        JSON.parse(item.payload_json ?? '{}') as Record<
                          string,
                          unknown
                        >
                      ).newMenuItemName ||
                      '待处理投稿',
                  )}
              </h2>
              <p>{item.review_note || `状态：${item.status}`}</p>
              <small>
                投稿于 {item.created_at.slice(0, 16).replace('T', ' · ')}
              </small>
            </Link>
          ))}
        </section>
        {active ? (
          <aside className="review-detail">
            <p className="kicker">投稿详情 / {active.type}</p>
            <h2>
              {String(
                payload.placeName ||
                  payload.newMenuItemName ||
                  active.target_place_id ||
                  '待处理投稿',
              )}
            </h2>
            <dl>
              <dt>状态</dt>
              <dd>{active.status}</dd>
              <dt>投稿编号</dt>
              <dd>{active.id}</dd>
              <dt>核验日期</dt>
              <dd>{String(payload.observedAt || '未提供')}</dd>
              <dt>声称方式</dt>
              <dd>{String(payload.claimedVerificationMethod || '未提供')}</dd>
            </dl>
            {media.length > 0 && (
              <div className="submission-media-grid">
                {media.map((item) => (
                  <figure key={item.id}>
                    <Image
                      src={`/api/v1/admin/media/${item.id}`}
                      width={160}
                      height={120}
                      unoptimized
                      alt="投稿证据缩略图"
                    />
                    <figcaption>
                      {item.visibility} · {item.redaction_status}
                    </figcaption>
                    <MediaReviewActions id={item.id} />
                  </figure>
                ))}
              </div>
            )}
            <div className="review-warning">
              公开 DTO 不包含来源链接、后台备注或原始
              payload；通过前请确认核验依据。
            </div>
            <SubmissionActions
              id={active.id}
              type={active.type}
              status={active.status}
              media={
                active.type === 'new_place' || active.type === 'new_price'
                  ? media.filter(
                      (item) =>
                        item.rights_confirmed_at &&
                        ['completed', 'not_needed'].includes(
                          item.redaction_status,
                        ),
                    )
                  : []
              }
            />
          </aside>
        ) : (
          <aside className="review-detail">
            <h2>暂无投稿</h2>
            <p>队列为空。</p>
          </aside>
        )}
      </div>
    </AdminShell>
  );
}
