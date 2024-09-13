<script lang="ts">
	import { onMount } from 'svelte';
	import { Replicache } from 'replicache';
	import { nanoid } from 'nanoid';
	import { source } from 'sveltekit-sse';
	import { mutators, type M } from '$lib/replicache/mutators';
	import { page } from '$app/stores';
	import { listTodos } from '$lib/replicache/todo';
	import type { Todo } from '$lib/replicache/todo';
	import { createClient } from "@supabase/supabase-js";

	import TodoMVC from '$lib/components/TodoMVC.svelte';

	const { spaceID } = $page.params;
	let repl: Replicache<M>;
	let _list: Todo[] = [];
	let areAllChangesSaved = true;

	onMount(() => {
		repl = initReplicache(spaceID);
		repl.subscribe(listTodos, (data) => {
			_list = data;
			_list.sort((a: Todo, b: Todo) => a.sort - b.sort);
		});
		// Implements a Replicache poke using Server-Sent Events.
		// If a "poke" message is received, it will pull from the server.
		const connection = source(`/api/replicache/${spaceID}/poke`);
		const sseStore = connection.select('poke').transform(() => {
			console.log('poked! pulling fresh data for spaceID', spaceID);
			repl.pull();
		});
		// The line below are kinda dumb, it prevents Svelte from removing this store at compile time (since it has not subscribers)
		const unsubscribe = sseStore.subscribe(() => {});

		// This allows us to show the user whether all their local data is saved on the server
		repl.onSync = async () => {
			areAllChangesSaved = (await repl.experimentalPendingMutations()).length === 0;
		};

    const unlisten = listen(async () => repl.pull());

		// cleanup
		return () => {
			repl.close();
			unsubscribe();
			connection.close();
      unlisten();
		};

	});

	function initReplicache(spaceID: string) {
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

	async function createTodo(text: string) {
		await repl?.mutate.createTodo({
			id: nanoid(),
			text,
			completed: false
		});
	}


// Implements a Replicache poke using Supabase's realtime functionality.
// See: backend/poke/supabase.ts.
function listen(onPoke: () => Promise<void>) {
  const supabase = createClient(
		import.meta.env.VITE_SUPABASE_URL,
		import.meta.env.VITE_SUPABASE_ANON_KEY
	);

  const subscriptionChannel = supabase.channel("public:replicache_space");
  subscriptionChannel
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "replicache_space",
      },
      () => {
        void onPoke();
      }
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(subscriptionChannel);
  };
}

</script>

<p>{areAllChangesSaved ? 'All Data Saved' : 'Sync Pending'}</p>
<section class="todoapp">
	<TodoMVC
		items={_list}
		onCreateItem={createTodo}
		onDeleteItem={(id) => repl.mutate.deleteTodo(id)}
		onUpdateItem={(updatedTodo) => repl.mutate.updateTodo(updatedTodo)}
	/>
</section>
