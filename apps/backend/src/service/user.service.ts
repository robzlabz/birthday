import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { users } from '../db/schema';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { CreateUser, UpdateUser } from '../schema/user.schema';

// CRUD normal dengan binding D1
export class UserService {
    private db: DrizzleD1Database<typeof schema>;

    constructor(dbBinding: D1Database) {
        this.db = getDb(dbBinding);
    }

    async getById(id: string) {
        return await this.db.select().from(users).where(eq(users.id, id)).get();
    }

    async create(data: CreateUser) {
        return await this.db.insert(users).values(data).returning().get();
    }

    async update(id: string, data: UpdateUser) {
        return await this.db.update(users).set(data).where(eq(users.id, id)).returning().get();
    }

    async list() {
        return await this.db.select().from(users).all();
    }
}
