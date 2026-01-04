import { IUserRepository, UserRepository } from '../repositories/user.repository';
import { CreateUser, UpdateUser } from '../schema';

export interface IUserService {
    getById(id: string): Promise<any>;
    create(data: CreateUser): Promise<any>;
    update(id: string, data: UpdateUser): Promise<any>;
    list(): Promise<any[]>;
    delete(id: string): Promise<any>;
}

export class UserService implements IUserService {
    constructor(private repository: IUserRepository) { }

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
