import { json } from '@sveltejs/kit';
import { z, type ZodType } from 'zod';
import type { MutatorDefs, ReadonlyJSONValue } from 'replicache';
import { ReplicacheTransaction } from 'replicache-transaction';
import { mutators } from '$lib/replicache/mutators.js';
import { transact } from '$lib/server/db/pg.js';
import { getPokeBackend } from '$lib/server/sse/poke';
import { PostgresStorage } from '$lib/server/db/postgres-storage.js';
import {
	getCookie,
	getLastMutationIDs,
	setCookie,
	setLastMutationIDs
} from '$lib/server/db//data.js';
import { checkDatabaseHealth } from '$lib/server/db/pg.js';

export async function POST({ request, params }) {
	const { spaceID } = params;
	console.log(`[${spaceID}] Received push request`);
	
	try {
		// Check database health before processing the request
		const isHealthy = await checkDatabaseHealth();
		if (!isHealthy) {
			console.error(`[${spaceID}] Database health check failed. Cannot process push request.`);
			return json({ error: 'Database is currently unavailable' }, { status: 503 });
		}

		const body = await request.json();
		await push(spaceID, body, mutators);
		console.log(`[${spaceID}] Push request processed successfully`);
		return json({}, { status: 200 });
	} catch (error) {
		console.error(`[${spaceID}] Error processing push request:`, error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

// ... rest of the file remains unchanged ...
