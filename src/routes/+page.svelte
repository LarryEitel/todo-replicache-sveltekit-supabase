<script lang="ts">
	import { onMount } from 'svelte';
	import { Replicache } from 'replicache';
	import { createClient } from '@supabase/supabase-js';
	import type { M } from '$lib/replicache/mutators';

	const SUPABASE_URL = 'YOUR_SUPABASE_URL';
	const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

	let rep: Replicache<M>;
	let count = 0;
	let supabase: any;

	onMount(() => {
		rep = new Replicache({
			name: 'counter-demo',
			licenseKey: 'license_key_here', // Replace with your actual license key
			mutators: {
				increment: async (tx) => {
					const current = (await tx.get<number>('counter')) ?? 0;
					await tx.set('counter', current + 1);
				},
				decrement: async (tx) => {
					const current = (await tx.get<number>('counter')) ?? 0;
					await tx.set('counter', current - 1);
				},
				set: async (tx, value: number) => {
					await tx.set('counter', value);
				}
			}
		});

		rep.subscribe(async (tx) => {
			count = (await tx.get<number>('counter')) ?? 0;
		});

		// Initialize Supabase client
		supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

		// Subscribe to Realtime changes
		supabase
			.channel('counter')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'counter' }, handleRealtimeChange)
			.subscribe();
	});

	function handleRealtimeChange(payload: any) {
		const { eventType, new: newRecord } = payload;
		if (eventType === 'UPDATE' && newRecord && newRecord.value !== undefined) {
			rep.mutate.set(newRecord.value);
		}
	}

	async function increment() {
		await rep.mutate.increment();
		await supabase.from('counter').update({ value: count + 1 }).eq('id', 1);
	}

	async function decrement() {
		await rep.mutate.decrement();
		await supabase.from('counter').update({ value: count - 1 }).eq('id', 1);
	}

	async function reset() {
		await rep.mutate.set(0);
		await supabase.from('counter').update({ value: 0 }).eq('id', 1);
	}
</script>

<h1>Replicache Counter with Supabase Realtime</h1>

<div>
	<button on:click={decrement}>-</button>
	<span>{count}</span>
	<button on:click={increment}>+</button>
</div>

<button on:click={reset}>Reset</button>

<style>
	div {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	span {
		font-size: 2rem;
		min-width: 3rem;
		text-align: center;
	}

	button {
		font-size: 1.5rem;
		padding: 0.5rem 1rem;
	}

</style>
