export class SupplierEntity {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  debt: number | null;
  createdAt: Date;
  updatedAt: Date;
}
