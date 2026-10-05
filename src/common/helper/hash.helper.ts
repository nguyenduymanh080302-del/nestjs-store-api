import { hash, compare } from 'bcrypt';

const SALT_ROUNDS = 14;

export const hashData = async (data: string): Promise<string> => {
  return hash(data, SALT_ROUNDS);
};

export const compareHash = async (
  data: string,
  hashed: string
): Promise<boolean> => {
  return compare(data, hashed);
};
