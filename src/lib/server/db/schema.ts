import type { PGConfig } from './pgconfig/pgconfig.js';
import type { Executor } from './pg.js';

export async function createDatabase(executor: Executor, dbConfig: PGConfig) {
    console.log('Creating Database');
    try {
        const schemaVersion = await dbConfig.getSchemaVersion(executor);
        const migrations = [createSchemaVersion1];
        if (schemaVersion < 0 || schemaVersion > migrations.length) {
            throw new Error('Unexpected schema version: ' + schemaVersion);
        }
        await createSchemaVersion1(executor);
    } catch (error) {
        console.error('Error in createDatabase:', error);
        throw error;
    }
}

export async function createSchemaVersion1(executor: Executor) {
    try {
        console.log('Starting createSchemaVersion1');

        console.log('Creating replicache_meta table');
        await executor(`create table if not exists replicache_meta (key text primary key, value json)`);
        
        console.log('Inserting schema version');
        await executor(`insert into replicache_meta (key, value) values ('schemaVersion', '1') on conflict (key) do update set value = '1'`);

        console.log('Creating replicache_space table');
        await executor(`create table if not exists replicache_space (
            id text primary key not null,
            version integer not null,
            lastmodified timestamp(6) not null
        )`);

        console.log('Creating replicache_client table');
        await executor(`create table if not exists replicache_client (
            id text primary key not null,
            lastmutationid integer not null,
            version integer not null,
            lastmodified timestamp(6) not null,
            clientgroupid text not null
        )`);

        console.log('Creating replicache_entry table');
        await executor(`create table if not exists replicache_entry (
            spaceid text not null,
            key text not null,
            value text not null,
            deleted boolean not null,
            version integer not null,
            lastmodified timestamp(6) not null
        )`);

        console.log('Creating indexes');
        await executor(`create unique index if not exists replicache_entry_spaceid_key_idx on replicache_entry (spaceid, key)`);
        await executor(`create index if not exists replicache_entry_spaceid_idx on replicache_entry (spaceid)`);
        await executor(`create index if not exists replicache_entry_deleted_idx on replicache_entry (deleted)`);
        await executor(`create index if not exists replicache_entry_version_idx on replicache_entry (version)`);
        await executor(`create index if not exists replicache_client_clientgroupid_version_idx on replicache_client (clientgroupid,version)`);

        console.log('createSchemaVersion1 completed successfully');
    } catch (error) {
        console.error('Error in createSchemaVersion1:', error);
        throw error;
    }
}
