import { getDb } from '../db';
import { UserRepository } from '../repositories/user.repository';
import { CreateUser, UpdateUser } from '../schema';

export class UserService {
    private repository: UserRepository;

    constructor(dbBinding: D1Database) {
        const db = getDb(dbBinding);
        this.repository = new UserRepository(db);
    }

    async getById(id: string) {
        return await this.repository.getById(id);
    }

    async create(data: CreateUser) {
        return await this.repository.create(data);
    }

    async update(id: string, data: UpdateUser) {
        return await this.repository.update(id, data);
    }

    async list() {
        return await this.repository.list();
    }

    async delete(id: string) {
        return await this.repository.delete(id);
    }
}
