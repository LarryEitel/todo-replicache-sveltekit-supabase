// This file defines our "mutators".
//
// Mutators are how you change data in Replicache apps.
//
// They are registered with Replicache at construction-time and callable like:
// `myReplicache.mutate.createTodo({text: "foo"})`.
//
// Replicache runs each mutation immediately (optimistically) on the client,
// against the local cache, and then later (usually moments later) sends a
// description of the mutation (its name and arguments) to the server, so that
// the server can *re-run* the mutation there against the authoritative
// datastore.
//
// This re-running of mutations is how Replicache handles conflicts: the
// mutators defensively check the database when they run and do the appropriate
// thing. The Replicache sync protocol ensures that the server-side result takes
// precedence over the client-side optimistic result.
//
// If the server is written in JavaScript, the mutator functions can be directly
// reused on the server. This sample demonstrates the pattern by using these
// mutators both with Replicache on the client (see /list/[spaceID]/+page.svelte) and on the server
// (see /routes/api/replicache/[spaceID]/push).
//
// See https://doc.replicache.dev/how-it-works#sync-details for all the detail
// on how Replicache syncs and resolves conflicts, but understanding that is not
// required to get up and running.

import type { WriteTransaction } from 'replicache';

export type M = typeof mutators;

export const mutators = {
	increment: async (tx: WriteTransaction) => {
		const current = (await tx.get<number>('counter')) ?? 0;
		await tx.set('counter', current + 1);
	},

	decrement: async (tx: WriteTransaction) => {
		const current = (await tx.get<number>('counter')) ?? 0;
		await tx.set('counter', current - 1);
	},

	set: async (tx: WriteTransaction, value: number) => {
		await tx.set('counter', value);
	}
};
