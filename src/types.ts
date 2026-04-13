export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  sessionId: string;
  userId: string;
}

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  userId: string;
}
