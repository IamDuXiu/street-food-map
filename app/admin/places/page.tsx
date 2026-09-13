import { AdminShell, AdminTitle } from '@/components/admin-shell';
import { MergePreview, PlaceCreateForm, PlaceEditor, PlaceStatusButton } from '@/components/admin-actions';
import { formatPrice } from '@/lib/filter';
import { openDatabase } from '@/lib/server/db';
import { PlaceRepository } from '@/lib/server/repository';
import { requireAdminPage } from '@/lib/server/page-auth';

const recordStatusLabels: Record<string, string> = { active: '正常', archived: '已归档', merged: '已合并' };
const businessStatusLabels: Record<string, string> = { open: '营业中', closed: '已停业', unknown: '待确认' };
const recordStatusLabel = (status: string) => recordStatusLabels[status] ?? '处理中';
const businessStatusLabel = (status: string) => businessStatusLabels[status] ?? status;

export default async function PlacesPage() {
  await requireAdminPage();
  const places = new PlaceRepository(openDatabase()).listAdmin();
  return <AdminShell active="/admin/places">
    <AdminTitle eyebrow="04 / PLACES & MEALS" title="地点与餐食"><PlaceCreateForm /></AdminTitle>
    <div className="place-admin-list">
      {places.map((place) => <article key={place.id} className="place-admin-row">
        <div>
          <span className="eyebrow">{place.category} · {place.zoneName}</span>
          <h2>{place.name}</h2>
          <p>{place.address}</p>
          <small>地点 ID：{place.id} · {recordStatusLabel(place.recordStatus)}</small>
        </div>
        <div className="admin-meals">
          {place.meals.map((meal) => <div key={meal.id}><strong>{formatPrice(meal.priceFen)}</strong> {meal.name}{place.recordStatus !== 'merged' && <PlaceEditor placeId={place.id} menuItemId={meal.id} />}</div>)}
          {place.recordStatus !== 'merged' && <PlaceEditor placeId={place.id} />}
        </div>
        <span className="status-text">{place.recordStatus === 'merged' ? '已合并（只读）' : businessStatusLabel(place.businessStatus)}</span>
        {place.recordStatus !== 'merged' && <><PlaceStatusButton id={place.id} archived={place.recordStatus === 'archived'} /><MergePreview placeId={place.id} /></>}
      </article>)}
    </div>
  </AdminShell>;
}
