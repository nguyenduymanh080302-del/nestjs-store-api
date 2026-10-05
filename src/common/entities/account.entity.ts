import { RoleEntity } from './role.entity';

export class AccountEntity {
  id: number;
  name: string;
  avatar: string;
  phone: string;
  address: string;
  username: string;
  password: string;
  email: string;
  isActive: boolean;
  roleId: number;
  role: RoleEntity;
  createdAt: string;
  updatedAt: string;
}
