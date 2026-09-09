import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { requireAdmin, AuthError } from '@/lib/server/auth';
import { PlaceRepository } from '@/lib/server/repository';
import { placeSchema } from '@/lib/server/validation';
import { duplicateCandidates } from '@/lib/server/services';

export async function GET(request: NextRequest) { try { requireAdmin(request, openDatabase()); const url = new URL(request.url); return NextResponse.json({ data: new PlaceRepository(openDatabase()).listAdmin({ q: url.searchParams.get('q') || undefined, zoneId: url.searchParams.get('zoneId') || undefined }) }); } catch (error) { return errorResponse(error); } }
export async function POST(request: NextRequest) { const db = openDatabase(); try { requireAdmin(request, db, true); const input = placeSchema.parse(await request.json()); const duplicates = duplicateCandidates(db, { name: input.name, address: input.address, lng: input.lng, lat: input.lat }); if (duplicates.length) return NextResponse.json({ error: { code: 'DUPLICATE_CANDIDATE', message: '发现疑似重复地点', candidates: duplicates } }, { status: 409 }); const id = new PlaceRepository(db).create(input as never); return NextResponse.json({ id }, { status: 201 }); } catch (error) { return errorResponse(error); } }
function errorResponse(error: unknown) { const status = error instanceof AuthError ? error.status : error instanceof Error && error.name === 'ZodError' ? 400 : 500; return NextResponse.json({ error: { code: error instanceof AuthError ? error.code : 'VALIDATION_ERROR', message: status === 401 ? '未授权' : '请求无法处理' } }, { status }); }
