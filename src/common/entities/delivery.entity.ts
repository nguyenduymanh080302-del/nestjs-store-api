export class DeliveryEntity {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
