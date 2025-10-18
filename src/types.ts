export type Role = 'admin' | 'data-admin' | 'client';

export interface GoldItem {
  id: string;
  name: string;
  price: number;
  image: string;
  uploadedAt: string;
}

export interface PawnRecord {
  id: string;
  customerName: string;
  principal: number;
  interestRate: number;
  monthlyInterest: number;
  daysBorrowed: number;
  interestAccrued: number;
  totalPayable: number;
  date: string;
  createdAt: string;
  term?: number;
}

export interface DailyMetrics {
  count: number;
  principal: number;
  interest: number;
}

export interface MonthlyMetrics extends DailyMetrics {
  monthLabel: string;
}
