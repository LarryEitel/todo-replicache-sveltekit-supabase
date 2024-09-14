// $lib/testSupabaseRealtime.ts
import { supabase } from '$lib/supabaseClient';

export function testRealtime() {
	const subscription = supabase
		.channel('test-channel')
		.on(
			'postgres_changes',
			{
				event: '*',
				schema: 'public',
				table: 'replicache_space',
			},
			(payload) => {
				console.log('[Test Realtime] Event received:', payload);
			}
		)
		.subscribe((status) => {
			if (status === 'SUBSCRIBED') {
				console.log('[Test Realtime] Subscription successful');
			} else if (status === 'ERROR') {
				console.error('[Test Realtime] Subscription error:', status);
			}
		});

	// Clean up after 60 seconds
	setTimeout(() => {
		supabase.removeChannel(subscription);
		console.log('[Test Realtime] Subscription removed');
	}, 60000);
}
