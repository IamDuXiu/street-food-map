import { randomUUID } from 'node:crypto';
import { PLACES, TAGS, VIEWPORTS } from '../fixtures';
import type { SqliteDatabase } from './db';

export function seedDemo(db: SqliteDatabase) {
  const now = new Date().toISOString();
  const transaction = db.transaction(() => {
    const zone = db.prepare('INSERT OR IGNORE INTO pilot_zones(id,name,audience,center_lng,center_lat,city,active) VALUES (?,?,?,?,?,?,1)');
    zone.run(VIEWPORTS[0].id, VIEWPORTS[0].label, 'student', 113.933073, 22.526639, 'shenzhen');
    zone.run(VIEWPORTS[1].id, VIEWPORTS[1].label, 'office_worker', 113.945, 22.54, 'shenzhen');
    const tag = db.prepare('INSERT OR IGNORE INTO tags(id,name) VALUES (?,?)');
    TAGS.forEach((name) => tag.run(name, name));
    const place = db.prepare('INSERT OR IGNORE INTO places(id,zone_id,city,name,normalized_name,address,lng,lat,category,access_type,access_note,business_status,record_status,opening_hours_note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const menu = db.prepare('INSERT OR IGNORE INTO menu_items(id,place_id,name,normalized_name,category,description,active,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)');
    const price = db.prepare('INSERT OR IGNORE INTO price_reports(id,menu_item_id,price_fen,observed_at,verification_method,status,reviewed_at,created_at) VALUES (?,?,?,?,?,?,?,?)');
    const placeTag = db.prepare('INSERT OR IGNORE INTO place_tags(place_id,tag_id) VALUES (?,?)');
    for (const item of PLACES) {
      place.run(item.id, item.zoneId, 'shenzhen', item.name, normalize(item.name), item.address, item.lng, item.lat, item.category, item.access.includes('公开') ? 'public' : 'identity_restricted', item.access, 'open', 'active', item.note, now, now);
      item.tags.forEach((name) => placeTag.run(item.id, name));
      for (const meal of item.meals) {
        menu.run(meal.id, item.id, meal.name, normalize(meal.name), meal.category, meal.description, now, now);
        price.run(`demo-price-${meal.id}`, meal.id, meal.priceFen, meal.observedAt, methodCode(meal.method), 'verified', now, now);
      }
    }
    const lead = db.prepare('INSERT OR IGNORE INTO source_leads(id,source_platform,source_url,clue_place_name,clue_item_name,clue_price_fen,summary,status,discovery_method,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    lead.run('demo-lead-1','user',null,'南头古城 · 阿婆豆花饭','豆花饭',1800,'一份豆花饭，配卤肉和青菜，看到价签 ¥18。','new','user_submission',now,now);
    lead.run('demo-lead-2','web','https://example.com/demo-lead-2','科兴科学园 · B1 餐厅','烧腊双拼饭',2500,'价格可能已变更，等待独立核验。','verifying','web',now,now);
    const leadItem = db.prepare('INSERT OR IGNORE INTO source_lead_items(id,source_lead_id,clue_item_name,clue_price_fen,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)');
    leadItem.run('demo-lead-item-1', 'demo-lead-1', '豆花饭', 1800, 'new', now, now);
    leadItem.run('demo-lead-item-2', 'demo-lead-2', '烧腊双拼饭', 2500, 'verifying', now, now);
    const submission = db.prepare('INSERT OR IGNORE INTO submissions(id,type,target_place_id,payload_json,status,created_at) VALUES (?,?,?,?,?,?)');
    submission.run('demo-submission-1','new_price','kexing-b1-foodcourt',JSON.stringify({ type:'new_price', placeId:'kexing-b1-foodcourt', menuItemId:'kexing-rice', priceFen:2500, observedAt:'2026-09-01', claimedVerificationMethod:'onsite_menu', note:'今天午餐已经涨到 ¥25。' }), 'pending', now);
    submission.run('demo-submission-2','new_place',null,JSON.stringify({ type:'new_place', zoneId:'sz university', placeName:'南头古城 · 阿婆豆花饭', address:'南山区南头古城内', lng:113.92, lat:22.53, coordinateSystem:'GCJ-02', placeCategory:'街边快餐', menuItemName:'豆花饭', priceFen:1800, observedAt:'2026-08-31', claimedVerificationMethod:'external_lead' }), 'pending', now);
    submission.run('demo-submission-3','correction','shenda-west-noodle',JSON.stringify({ type:'correction', placeId:'shenda-west-noodle', field:'address', proposedValue:'南海大道 3688 号深大西门外 80 米', reason:'门店地址更新' }), 'pending', now);
  });
  transaction();
}

function methodCode(method: string) { return method.includes('菜单') ? 'onsite_menu' : method.includes('小票') ? 'receipt' : method.includes('官方') ? 'official_menu' : 'community_confirmed'; }
export function normalize(value: string) { return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, ''); }
export function newId(prefix: string) { return `${prefix}-${randomUUID()}`; }
