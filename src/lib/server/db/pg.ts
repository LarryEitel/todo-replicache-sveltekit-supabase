// Low-level config and utilities for Postgres.

import type { Pool, QueryResult, PoolClient } from 'pg';
import { createDatabase } from './schema.js';
import { getDBConfig } from './pgconfig/pgconfig.js';

let pool: Pool;

async function getPool(): Promise<Pool> {
    if (!pool) {
        pool = await initPool();
    }
    return pool;
}

async function initPool(): Promise<Pool> {
    console.log('Initializing global pool');

    try {
        const dbConfig = getDBConfig();
        console.log('DB Config:', dbConfig);

        const newPool = dbConfig.initPool();
        console.log('Pool initialized');

        newPool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
            // Instead of exiting, attempt to reinitialize the pool
            setTimeout(() => initPool(), 5000);
        });

        newPool.on('connect', async (client) => {
            console.log('New client connected');
            try {
                await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL SERIALIZABLE');
            } catch (error) {
                console.error('Error setting transaction isolation level:', error);
            }
        });

        console.log('Attempting to create database schema');
        await retryOperation(async () => {
            await withExecutorAndPool(async (executor) => {
                await transactWithExecutor(executor, async (executor) => {
                    console.log('Calling createDatabase function');
                    await createDatabase(executor, dbConfig);
                    console.log('Database schema created successfully');
                });
            }, newPool);
        }, 3);

        console.log('Pool initialization completed');
        return newPool;
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

async function retryOperation<T>(operation: () => Promise<T>, maxRetries: number): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            console.error(`Operation failed (attempt ${i + 1}/${maxRetries}):`, error);
            if (i === maxRetries - 1) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i))); // Exponential backoff
        }
    }
    throw new Error('Max retries reached');
}

export async function withExecutor<R>(f: (executor: Executor) => R): Promise<R> {
    const p = await getPool();
    return withExecutorAndPool(f, p);
}

async function withExecutorAndPool<R>(f: (executor: Executor) => R, p: Pool): Promise<R> {
    let client: PoolClient | null = null;
    try {
        client = await p.connect();
        console.log('Connected to database');

        const executor: Executor = async (sql: string, params?: any[]) => {
            try {
                console.log(`Executing SQL: ${sql}`);
                const result = await client!.query(sql, params);
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
                throw new Error(`Error executing SQL: ${sql}: ${e}`);
            }
        };

        return await f(executor);
    } finally {
        if (client) {
            client.release();
            console.log('Database client released');
        }
    }
}

export type Executor = (sql: string, params?: any[]) => Promise<QueryResult>;
export type TransactionBodyFn<R> = (executor: Executor) => Promise<R>;

export async function transact<R>(body: TransactionBodyFn<R>): Promise<R> {
    return await withExecutor(async (executor) => {
        return await transactWithExecutor(executor, body);
    });
}

async function transactWithExecutor<R>(executor: Executor, body: TransactionBodyFn<R>): Promise<R> {
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
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i))); // Exponential backoff
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

function shouldRetryTransaction(err: unknown): boolean {
    const code = typeof err === 'object' ? String((err as any).code) : null;
    return code === '40001' || code === '40P01';
}

// New health check function
export async function checkDatabaseHealth(): Promise<boolean> {
    try {
        const result = await withExecutor(async (executor) => {
            return await executor('SELECT 1');
        });
        return result.rows[0]['?column?'] === 1;
    } catch (error) {
        console.error('Database health check failed:', error);
        return false;
    }
}

// Function to check if the schema is properly initialized
async function isSchemaInitialized(): Promise<boolean> {
    try {
        const result = await withExecutor(async (executor) => {
            return await executor('SELECT COUNT(*) FROM schema_version');
        });
        return parseInt(result.rows[0].count) > 0;
    } catch (error) {
        console.error('Error checking schema initialization:', error);
        return false;
    }
}

// Implement a periodic health check
setInterval(async () => {
    const isHealthy = await checkDatabaseHealth();
    if (!isHealthy) {
        console.error('Database health check failed. Attempting to reinitialize the pool.');
        try {
            pool = await initPool();
            const schemaInitialized = await isSchemaInitialized();
            if (!schemaInitialized) {
                console.error('Schema not initialized. Attempting to create schema.');
                const dbConfig = getDBConfig();
                await withExecutor(async (executor) => {
                    await createDatabase(executor, dbConfig);
                });
            }
        } catch (error) {
            console.error('Failed to reinitialize the pool or create schema:', error);
        }
    }
}, 60000); // Check every minute
