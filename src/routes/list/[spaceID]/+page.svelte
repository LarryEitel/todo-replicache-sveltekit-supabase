<!-- +page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Replicache } from 'replicache';
  import { nanoid } from 'nanoid';
  import { mutators, type M } from '$lib/replicache/mutators';
  import { page } from '$app/stores';
  import { listTodos } from '$lib/replicache/todo';
  import type { Todo } from '$lib/replicache/todo';
  import { supabase } from '$lib/supabaseClient'; // Import the singleton client
  import TodoMVC from '$lib/components/TodoMVC.svelte';
  // import { testRealtime } from '$lib/testSupabaseRealtime';

  const { spaceID } = $page.params;
  let repl: Replicache<M>;
  let _list: Todo[] = [];
  let areAllChangesSaved = true;

  onMount(() => {
    // testRealtime();

    // console.log(`[onMount] Initializing Replicache for spaceID: ${spaceID}`);

    try {
      repl = initReplicache(spaceID);
    } catch (error) {
      console.error('[Replicache Initialization Error]', error);
      return; // Exit early if initialization fails
    }

    // Subscribe to Replicache's listTodos
    repl.subscribe(listTodos, (data) => {
      // console.log('[Replicache] listTodos subscription received data:', data);
      _list = data;
      _list.sort((a: Todo, b: Todo) => a.sort - b.sort);
    });

    // Listen for Supabase Realtime events
    console.log('[onMount] Setting up Supabase Realtime listener');
    const unlisten = listen(async () => {
      console.log('[Supabase Realtime] Poke received, triggering Replicache pull');
      try {
        await repl.pull();
        console.log('[Replicache] Pull completed successfully');
      } catch (error) {
        console.error('[Replicache Pull Error]', error);
      }
    });

    // Show sync status
    repl.onSync = async () => {
      try {
        const pending = await repl.experimentalPendingMutations();
        areAllChangesSaved = pending.length === 0;
        // console.log(`[Replicache] Sync status updated: ${areAllChangesSaved ? 'All Data Saved' : 'Sync Pending'}`);
      } catch (error) {
        console.error('[Replicache onSync Error]', error);
      }
    };

    // Handle Replicache errors
    repl.onError = (err) => {
      console.error('[Replicache Error]', err);
    };

    // Cleanup on component unmount
    return () => {
      console.log('[onMount] Cleanup: Closing Replicache and unsubscribing Supabase Realtime');
      repl.close();
      unlisten();
    };
  });

  /**
   * Initializes Replicache with the provided spaceID.
   * @param {string} spaceID - The unique identifier for the Replicache instance.
   * @returns {Replicache<M>} - The initialized Replicache instance.
   */
  function initReplicache(spaceID: string) {
    const licenseKey = import.meta.env.VITE_REPLICACHE_LICENSE_KEY;
    if (!licenseKey) {
      throw new Error('Missing VITE_REPLICACHE_LICENSE_KEY');
    }

    // console.log('[initReplicache] Creating Replicache instance with spaceID:', spaceID);
    return new Replicache({
      licenseKey,
      pushURL: `/api/replicache/${spaceID}/push`,
      pullURL: `/api/replicache/${spaceID}/pull`,
      name: spaceID,
      mutators,
      // Optionally, enable Replicache debugging
      // logLevel: 'debug', // Uncomment if Replicache supports logLevel
    });
  }

  /**
   * Creates a new todo item.
   * @param {string} text - The text of the todo item.
   */
  async function createTodo(text: string) {
    // console.log('[createTodo] Creating todo with text:', text);
    try {
      await repl?.mutate.createTodo({
        id: nanoid(),
        text,
        completed: false,
      });
      console.log('[createTodo] Todo created successfully');
    } catch (error) {
      console.error('[createTodo Error]', error);
    }
  }

  /**
   * Sets up a Supabase Realtime listener for changes on the replicache_space table.
   * @param {() => Promise<void>} onPoke - The callback to invoke when a change is detected.
   * @returns {() => void} - A cleanup function to remove the subscription.
   */
  function listen(onPoke: () => Promise<void>) {
    console.log('[listen] Subscribing to Supabase Realtime channel');

    const subscription = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'replicache_space',
        },
        (payload) => {
          console.log('[Supabase Realtime] Event received:', payload);
          onPoke();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Supabase Realtime] Subscription successful');
        } else if (status === 'ERROR') {
          console.error('[Supabase Realtime] Subscription error:', status);
        }
      });

    return () => {
      console.log('[listen] Removing Supabase Realtime subscription');
      supabase.removeChannel(subscription);
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
