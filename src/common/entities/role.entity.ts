export class RoleEntity {
  id: number;
  code: string;
  name: string;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
