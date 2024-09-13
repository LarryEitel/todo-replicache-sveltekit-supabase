<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Replicache } from 'replicache';
	import { nanoid } from 'nanoid';
	import { source } from 'sveltekit-sse';
	import { mutators, type M } from '$lib/replicache/mutators';
	import { page } from '$app/stores';
	import { listTodos } from '$lib/replicache/todo';
	import type { Todo } from '$lib/replicache/todo';
	import { createClient } from '@supabase/supabase-js';

	import TodoMVC from '$lib/components/TodoMVC.svelte';

	let spaceID: string;
	let replicacheInstance: Replicache<M>;
	let _list: Todo[] = [];
	let areAllChangesSaved = true;

	const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
	const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

	let cleanup: (() => void) | undefined;
	let initializationTimeout: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		spaceID = $page.params.spaceID;
		initReplicacheDebounced();
	});

	onDestroy(() => {
		if (cleanup) {
			cleanup();
		}
		if (initializationTimeout) {
			clearTimeout(initializationTimeout);
		}
	});

	$: if (spaceID) {
		initReplicacheDebounced();
	}

	function initReplicacheDebounced() {
		if (initializationTimeout) {
			clearTimeout(initializationTimeout);
		}
		initializationTimeout = setTimeout(() => {
			if (cleanup) {
				cleanup();
			}
			cleanup = initReplicache();
		}, 300); // 300ms debounce
	}

	function initReplicache() {
		console.log(`Initializing Replicache for spaceID: ${spaceID}`);
		
		if (replicacheInstance) {
			console.log('Closing existing Replicache instance');
			replicacheInstance.close();
		}

		try {
			replicacheInstance = createReplicacheInstance(spaceID);
		} catch (error) {
			console.error('Error creating Replicache instance:', error);
			return () => {}; // Return empty cleanup function
		}

		const unsubscribeTodos = replicacheInstance.subscribe(listTodos, (data) => {
			_list = data;
			_list.sort((a: Todo, b: Todo) => a.sort - b.sort);
		});
		
		// Implements a Replicache poke using Server-Sent Events.
		const connection = source(`/api/replicache/${spaceID}/poke`);
		const sseStore = connection.select('poke').transform(() => {
			console.log('Poked! Pulling fresh data for spaceID:', spaceID);
			retryOperation(() => replicacheInstance.pull());
		});
		const unsubscribeSse = sseStore.subscribe(() => {});

		replicacheInstance.onSync = async () => {
			try {
				areAllChangesSaved = (await replicacheInstance.experimentalPendingMutations()).length === 0;
			} catch (error) {
				console.error('Error checking pending mutations:', error);
			}
		};

		const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
		const channel = supabase
			.channel('todos')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, (payload) => {
				console.log('Supabase change received:', payload);
				retryOperation(() => replicacheInstance.pull());
			})
			.subscribe();

		console.log('Replicache initialization complete');

		return () => {
			console.log(`Cleaning up Replicache for spaceID: ${spaceID}`);
			unsubscribeTodos();
			unsubscribeSse();
			connection.close();
			channel.unsubscribe();
			replicacheInstance.close();
		};
	}

	function createReplicacheInstance(spaceID: string) {
		const licenseKey = import.meta.env.VITE_REPLICACHE_LICENSE_KEY;
		if (!licenseKey) {
			throw new Error('Missing VITE_REPLICACHE_LICENSE_KEY');
		}
		return new Replicache({
			licenseKey,
			pushURL: `/api/replicache/${spaceID}/push`,
			pullURL: `/api/replicache/${spaceID}/pull`,
			name: spaceID,
			mutators
		});
	}

	async function retryOperation<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
		let lastError;
		for (let i = 0; i < maxRetries; i++) {
			try {
				return await operation();
			} catch (error) {
				console.error(`Operation failed (attempt ${i + 1}/${maxRetries}):`, error);
				lastError = error;
				await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i))); // Exponential backoff
			}
		}
		throw lastError;
	}

	async function createTodo(text: string) {
		if (!replicacheInstance) {
			console.error('Replicache instance not initialized');
			return;
		}
		await retryOperation(() =>
			replicacheInstance.mutate.createTodo({
				id: nanoid(),
				text,
				completed: false
			})
		);
	}

	async function deleteTodo(id: string) {
		if (!replicacheInstance) {
			console.error('Replicache instance not initialized');
			return;
		}
		await retryOperation(() => replicacheInstance.mutate.deleteTodo(id));
	}

	async function updateTodo(updatedTodo: any) {
		if (!replicacheInstance) {
			console.error('Replicache instance not initialized');
			return;
		}
		await retryOperation(() => replicacheInstance.mutate.updateTodo(updatedTodo));
	}
</script>

<p>{areAllChangesSaved ? 'All Data Saved' : 'Sync Pending'}</p>
<section class="todoapp">
	<TodoMVC
		items={_list}
		onCreateItem={createTodo}
		onDeleteItem={deleteTodo}
		onUpdateItem={updateTodo}
	/>
</section>
