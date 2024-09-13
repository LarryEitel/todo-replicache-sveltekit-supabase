import { json } from '@sveltejs/kit';
import { transact } from '$lib/server/db/pg';
import { getChangedEntries, getCookie, getLastMutationIDsSince } from '$lib/server/db/data.js';
import { z } from 'zod';
import type { ClientID, PatchOperation } from 'replicache';
import { checkDatabaseHealth } from '$lib/server/db/pg.js';

const pullRequest = z.object({
	profileID: z.string(),
	clientGroupID: z.string(),
	cookie: z.union([z.number(), z.null()]),
	schemaVersion: z.string()
});

export type PullResponse = {
	cookie: number;
	lastMutationIDChanges: Record<ClientID, number>;
	patch: PatchOperation[];
};

export async function POST({ request, params }) {
	const { spaceID } = params;
	console.log(`[${spaceID}] Received pull request`);

	try {
		// Check database health before processing the request
		const isHealthy = await checkDatabaseHealth();
		if (!isHealthy) {
			console.error(`[${spaceID}] Database health check failed. Cannot process pull request.`);
			return json({ error: 'Database is currently unavailable' }, { status: 503 });
		}

		const pull = await request.json();
		const validatedPull = pullRequest.parse(pull);
		const { cookie: requestCookie } = validatedPull;

		console.log(`[${spaceID}] Processing pull request`, JSON.stringify(validatedPull, null, 2));

		const t0 = Date.now();
		const sinceCookie = requestCookie ?? 0;

		const [entries, lastMutationIDChanges, responseCookie] = await transact(async (executor) => {
			try {
				return await Promise.all([
					getChangedEntries(executor, spaceID, sinceCookie),
					getLastMutationIDsSince(executor, validatedPull.clientGroupID, sinceCookie),
					getCookie(executor, spaceID)
				]);
			} catch (error) {
				console.error(`[${spaceID}] Error during database operations:`, error);
				throw error;
			}
		});

		console.log(`[${spaceID}] lastMutationIDChanges:`, JSON.stringify(lastMutationIDChanges, null, 2));
		console.log(`[${spaceID}] responseCookie:`, responseCookie);
		console.log(`[${spaceID}] Read all objects in ${Date.now() - t0}ms`);

		if (responseCookie === undefined) {
			console.error(`[${spaceID}] Unknown space`);
			throw new Error(`Unknown space ${spaceID}`);
		}

		const resp: PullResponse = {
			lastMutationIDChanges,
			cookie: responseCookie,
			patch: []
		};

		for (const [key, value, deleted] of entries) {
			if (deleted) {
				resp.patch.push({
					op: 'del',
					key
				});
			} else {
				resp.patch.push({
					op: 'put',
					key,
					value
				});
			}
		}

		console.log(`[${spaceID}] Returning pull response`, JSON.stringify(resp, null, 2));

		return json(resp, { status: 200 });
	} catch (error) {
		console.error(`[${spaceID}] Error processing pull request:`, error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
