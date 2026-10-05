export type ApiResponse<T> = {
  data?: T;
  message: string | string[];
  status: number;
};
