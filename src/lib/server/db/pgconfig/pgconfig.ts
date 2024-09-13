import pkg from 'pg';
const { Pool } = pkg;
import type { Executor } from '../pg.js';
import { PGMemConfig } from './pgmem.js';
import { PostgresDBConfig } from './postgres.js';
import { SupabaseDBConfig } from './supabase.js';
import { DB_TYPE, DATABASE_URL } from '$env/static/private';

export interface PGConfig {
	initPool(): Pool;
	getSchemaVersion(executor: Executor): Promise<number>;
}

export function getDBConfig(): PGConfig {
	const dbType = DB_TYPE || 'pgmem';
	const dbURL = DATABASE_URL;

	console.log('DB_TYPE:', dbType);
	console.log('DATABASE_URL:', dbURL);

	switch (dbType.toLowerCase()) {
		case 'postgres':
			if (!dbURL) {
				throw new Error('DATABASE_URL is required for Postgres configuration');
			}
			return new PostgresDBConfig(dbURL);
		case 'supabase':
			if (!dbURL) {
				throw new Error('DATABASE_URL is required for Supabase configuration');
			}
			return new SupabaseDBConfig(dbURL);
		case 'pgmem':
		default:
			return new PGMemConfig();
	}
}
