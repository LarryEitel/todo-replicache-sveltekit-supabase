// Low-level config and utilities for Postgres.

import type { Pool, QueryResult } from 'pg';
import { createDatabase } from './schema.js';
import { getDBConfig } from './pgconfig/pgconfig.js';

const pool = getPool();

async function getPool() {
    const global = globalThis as unknown as {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        _pool: Pool;
    };
    if (!global._pool) {
        global._pool = await initPool();
    }
    return global._pool;
}

async function initPool() {
    console.log('Initializing global pool');

    try {
        const dbConfig = getDBConfig();
        console.log('DB Config:', dbConfig);

        const pool = dbConfig.initPool();
        console.log('Pool initialized');

        // the pool will emit an error on behalf of any idle clients
        // it contains if a backend error or network partition happens
        pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
            process.exit(-1);
        });
        pool.on('connect', async (client) => {
            console.log('New client connected');
            try {
                await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL SERIALIZABLE');
            } catch (error) {
                console.error('Error setting transaction isolation level:', error);
            }
        });

        console.log('Attempting to create database schema');
        try {
            await withExecutorAndPool(async (executor) => {
                await transactWithExecutor(executor, async (executor) => {
                    console.log('Calling createDatabase function');
                    await createDatabase(executor, dbConfig);
                    console.log('Database schema created successfully');
                });
            }, pool);
        } catch (schemaError) {
            console.error('Error creating database schema:', schemaError);
            throw schemaError;
        }

        console.log('Pool initialization completed');
        return pool;
    } catch (error) {
        console.error('Error during pool initialization:', error);
        if (error instanceof Error) {
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
        throw error;
    }
}

export async function withExecutor<R>(f: (executor: Executor) => R) {
    const p = await pool;
    return withExecutorAndPool(f, p);
}

async function withExecutorAndPool<R>(f: (executor: Executor) => R, p: Pool): Promise<R> {
    const client = await p.connect();
    console.log('Connected to database');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const executor = async (sql: string, params?: any[]) => {
        try {
            console.log(`Executing SQL: ${sql}`);
            const result = await client.query(sql, params);
            console.log('SQL executed successfully');
            return result;
        } catch (e) {
            console.error(`Error executing SQL: ${sql}`);
            console.error('Error details:', e);
            if (e instanceof Error) {
                console.error('Error name:', e.name);
                console.error('Error message:', e.message);
                console.error('Error stack:', e.stack);
            }
            throw new Error(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                `Error executing SQL: ${sql}: ${(e as unknown as any).toString()}`
            );
        }
    };

    try {
        return await f(executor);
    } finally {
        client.release();
        console.log('Database client released');
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Executor = (sql: string, params?: any[]) => Promise<QueryResult>;
export type TransactionBodyFn<R> = (executor: Executor) => Promise<R>;

/**
 * Invokes a supplied function within a transaction.
 * @param body Function to invoke. If this throws, the transaction will be rolled
 * back. The thrown error will be re-thrown.
 */
export async function transact<R>(body: TransactionBodyFn<R>) {
    return await withExecutor(async (executor) => {
        return await transactWithExecutor(executor, body);
    });
}

async function transactWithExecutor<R>(executor: Executor, body: TransactionBodyFn<R>) {
    for (let i = 0; i < 10; i++) {
        try {
            await executor('begin');
            console.log('Transaction began');
            try {
                const r = await body(executor);
                await executor('commit');
                console.log('Transaction committed');
                return r;
            } catch (e) {
                console.log('Caught error in transaction, rolling back:', e);
                if (e instanceof Error) {
                    console.error('Error name:', e.name);
                    console.error('Error message:', e.message);
                    console.error('Error stack:', e.stack);
                }
                await executor('rollback');
                throw e;
            }
        } catch (e) {
            if (shouldRetryTransaction(e)) {
                console.log(`Retrying transaction due to error ${e} - attempt number ${i + 1}`);
                continue;
            }
            console.error('Transaction failed, not retrying:', e);
            if (e instanceof Error) {
                console.error('Error name:', e.name);
                console.error('Error message:', e.message);
                console.error('Error stack:', e.stack);
            }
            throw e;
        }
    }
    throw new Error('Tried to execute transaction too many times. Giving up.');
}

//stackoverflow.com/questions/60339223/node-js-transaction-coflicts-in-postgresql-optimistic-concurrency-control-and
function shouldRetryTransaction(err: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const code = typeof err === 'object' ? String((err as any).code) : null;
    return code === '40001' || code === '40P01';
}
