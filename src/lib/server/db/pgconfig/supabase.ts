import pkg from 'pg';
const { Pool } = pkg;
import type { Executor } from '../pg.js';
import type { PGConfig } from './pgconfig.js';

export class SupabaseDBConfig implements PGConfig {
	private url: string;

	constructor(url: string) {
		this.url = url;
	}

	initPool(): Pool {
		return new Pool({
			connectionString: this.url,
			ssl: {
				rejectUnauthorized: false
			}
		});
	}

	async getSchemaVersion(executor: Executor): Promise<number> {
		const result = await executor<{ version: number }>(
			'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
		);
		return result.rows[0]?.version ?? 0;
	}
}