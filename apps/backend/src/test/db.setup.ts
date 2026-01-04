import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from '../db/schema';
import fs from 'fs';
import path from 'path';

export function setupTestDb() {
    const dbPath = path.join(process.cwd(), `test-${Math.random().toString(36).substring(7)}.db`);
    const client = createClient({
        url: `file:${dbPath}`,
    });
    const db = drizzle(client, { schema, logger: false });

    const initDb = async () => {
        await client.execute('PRAGMA foreign_keys = ON;');
        await client.execute(`
            CREATE TABLE users (
                id TEXT PRIMARY KEY NOT NULL,
                email TEXT NOT NULL UNIQUE,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                location TEXT NOT NULL,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            );
        `);
        await client.execute(`
            CREATE TABLE user_events (
                id TEXT PRIMARY KEY NOT NULL,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type TEXT NOT NULL,
                event_date TEXT NOT NULL,
                month_day TEXT NOT NULL,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            );
        `);
        await client.execute(`
            CREATE TABLE sent_logs (
                id TEXT PRIMARY KEY NOT NULL,
                user_id TEXT NOT NULL,
                event_id TEXT NOT NULL REFERENCES user_events(id),
                year INTEGER NOT NULL,
                status TEXT NOT NULL,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                UNIQUE(user_id, event_id, year)
            );
        `);
    };

    const cleanup = () => {
        client.close();
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }
    };

    return { db, client, initDb, cleanup };
}
