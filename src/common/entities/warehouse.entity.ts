export class WarehouseEntity {
  id: number;
  name: string;
  address?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
