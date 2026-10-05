type SanitizableAccount = {
  id: number;
  name: string;
  username: string;
  email: string | null;
  avatar: string | null;
  phone: string | null;
  address: string | null;
  role: {
    id: number;
    name: string;
    permissions: string[];
  };
};

export const sanitizeAccount = (account: SanitizableAccount) => ({
  id: account.id,
  name: account.name,
  username: account.username,
  email: account.email,
  avatar: account.avatar,
  phone: account.phone,
  address: account.address,
  role: {
    id: account.role.id,
    name: account.role.name,
    permissions: account.role.permissions
  }
});
