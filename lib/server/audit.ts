import type { SqliteDatabase } from './db';
import { newId } from './seed';

export function recordAudit(db: SqliteDatabase, actor: string, objectType: string, objectId: string, action: string, before?: unknown, after?: unknown) {
  db.prepare('INSERT INTO moderation_actions(id,actor,object_type,object_id,action,before_summary,after_summary,created_at) VALUES (?,?,?,?,?,?,?,?)').run(newId('audit'), actor, objectType, objectId, action, compact(before), compact(after), new Date().toISOString());
}
function compact(value: unknown) { return value === undefined ? null : JSON.stringify(value).slice(0, 2000); }
