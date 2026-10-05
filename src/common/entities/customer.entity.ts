export class CustomerEntity {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  debt?: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
