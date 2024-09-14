import type { PGConfig } from './pgconfig/pgconfig.js';
import type { Executor } from './pg.js';

export async function createDatabase(executor: Executor, dbConfig: PGConfig) {
    console.log('Creating Database');
    try {
        await createSchemaVersionTable(executor);
        const schemaVersion = await dbConfig.getSchemaVersion(executor);
        const migrations = [createSchemaVersion1];
        if (schemaVersion < 0 || schemaVersion > migrations.length) {
            throw new Error('Unexpected schema version: ' + schemaVersion);
        }
        for (let i = schemaVersion; i < migrations.length; i++) {
            await migrations[i](executor);
        }
    } catch (error) {
        console.error('Error in createDatabase:', error);
        throw error;
    }
}

async function createSchemaVersionTable(executor: Executor) {
    try {
        console.log('Creating schema_version table if not exists');
        await executor(`
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Insert initial version if table is empty
        await executor(`
            INSERT INTO schema_version (version)
            SELECT 0
            WHERE NOT EXISTS (SELECT 1 FROM schema_version)
        `);
    } catch (error) {
        console.error('Error creating schema_version table:', error);
        throw error;
    }
}

export async function createSchemaVersion1(executor: Executor) {
    try {
        console.log('Starting createSchemaVersion1');

        console.log('Creating replicache_meta table');
        await executor(`CREATE TABLE IF NOT EXISTS replicache_meta (key text primary key, value json)`);
        
        console.log('Inserting schema version');
        await executor(`
            INSERT INTO replicache_meta (key, value)
            VALUES ('schemaVersion', '1')
            ON CONFLICT (key)
            DO UPDATE SET value = '1'
            WHERE replicache_meta.value::text != '1'
        `);

        console.log('Creating replicache_space table');
        await executor(`CREATE TABLE IF NOT EXISTS replicache_space (
            id text primary key not null,
            version integer not null,
            lastmodified timestamp(6) not null
        )`);

        console.log('Creating replicache_client table');
        await executor(`CREATE TABLE IF NOT EXISTS replicache_client (
            id text primary key not null,
            lastmutationid integer not null,
            version integer not null,
            lastmodified timestamp(6) not null,
            clientgroupid text not null
        )`);

        console.log('Creating replicache_entry table');
        await executor(`CREATE TABLE IF NOT EXISTS replicache_entry (
            spaceid text not null,
            key text not null,
            value text not null,
            deleted boolean not null,
            version integer not null,
            lastmodified timestamp(6) not null
        )`);

        console.log('Creating indexes');
        await executor(`CREATE UNIQUE INDEX IF NOT EXISTS replicache_entry_spaceid_key_idx ON replicache_entry (spaceid, key)`);
        await executor(`CREATE INDEX IF NOT EXISTS replicache_entry_spaceid_idx ON replicache_entry (spaceid)`);
        await executor(`CREATE INDEX IF NOT EXISTS replicache_entry_deleted_idx ON replicache_entry (deleted)`);
        await executor(`CREATE INDEX IF NOT EXISTS replicache_entry_version_idx ON replicache_entry (version)`);
        await executor(`CREATE INDEX IF NOT EXISTS replicache_client_clientgroupid_version_idx ON replicache_client (clientgroupid,version)`);

        // We are going to be using the supabase realtime api from the client to
        // receive pokes. This requires js access to db. We use RLS to restrict this
        // access to only what is needed: read access to the space table. All this
        // gives JS is the version of the space which is harmless. Everything else is
        // auth'd through cookie auth using normal web application patterns.
        await executor.none(`alter table replicache_meta enable row level security`);
        await executor.none(`alter table replicache_entry enable row level security`);
        await executor.none(`alter table replicache_client enable row level security`);

        // this needs adjusted when we have auth
        await executor.none(`alter table replicache_space enable row level security`);
        await executor.none(`DROP POLICY IF EXISTS anon_read_replicache_space ON public.replicache_space`);
        await executor.none(`DROP POLICY IF EXISTS allow_all ON public.replicache_space`);

        // Do not leave RLS disabled in production environments.
        // Re-Enabling RLS: Once you've completed your debugging, re-enable RLS to restore your security posture.

        await executor.none(`ALTER TABLE public.replicache_space ENABLE ROW LEVEL SECURITY`);
        await executor.none(`CREATE POLICY anon_read_replicache_space ON public.replicache_space FOR SELECT USING (true)`);

        // Here we enable the supabase realtime api and monitor updates to the
        // replicache_space table.
        await executor.none(`alter publication supabase_realtime
    add table replicache_space`);
        await executor.none(`alter publication supabase_realtime set
    (publish = 'update');`);

        // Update schema version
        await executor(`
            UPDATE schema_version
            SET version = 1
            WHERE version = 0
        `);

        console.log('createSchemaVersion1 completed successfully');
    } catch (error) {
        console.error('Error in createSchemaVersion1:', error);
        throw error;
    }
}
