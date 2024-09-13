<script lang="ts">
	import { onMount } from 'svelte';
	import { Replicache } from 'replicache';
	import type { M } from '$lib/replicache/mutators';

	let rep: Replicache<M>;
	let count = 0;

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
	});

	function increment() {
		rep.mutate.increment();
	}

	function decrement() {
		rep.mutate.decrement();
	}

	function reset() {
		rep.mutate.set(0);
	}
</script>

<h1>Replicache Counter</h1>

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
