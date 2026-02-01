
export enum TransactionType {
  EARNING = 'EARNING',
  EXPENSE = 'EXPENSE'
}

export type Platform = 'Uber' | 'DiDi' | 'Ola' | 'Other';

export type EarningCategory = 
  | 'Gross Transportation Fares' | 'Split Fare Fee' | 'Toll Reimbursement'
  | 'City/Government Fees' | 'Airport Fees' | 'Booking Fees'
  | 'Delivery Fee' | 'Delivery Incentives' | 'Delivery Tolls Reimbursement'
  | 'Miscellaneous/Referrals/Incentives' | 'Tips' | 'Miscellaneous'
  | 'Gross Rider Fares' | 'Booking Fee' | 'Handling Fee' | 'Tolls'
  | 'Airport Fee' | 'Government Levy' | 'Cancellation Fee' | 'CTP Fee'
  | 'Split Fare Fee' | 'Other Fare Breakdown Amounts' | 'Rewards' | 'Other';

export type ExpenseCategory =
  | 'Car Expenses - Fuel' | 'Car Expenses - EV Home Charging' | 'Car Expenses - EV Public Charging'
  | 'Car Expenses - Registration' | 'Car Expenses - Insurance & CTP' | 'Car Expenses - Servicing, Repairs & Tyres'
  | 'Car Expenses - Cleaning' | 'Car Expenses - Accessories & Other' | 'Car Expenses - Rent, Hire & Lease Payments'
  | 'Accountancy' | 'Bank Fees' | 'Computer Expenses' | 'Courses & Training' | 'Equipment (dashcams, tools etc)'
  | 'Internet' | 'Licences, Permits, Vehicle Checks, Medicals etc (GST)' | 'Licences, Permits, Vehicle Checks, Medicals etc (non-GST)'
  | 'Mobile Phone - For Both Business & Personal' | 'Mobile Phone - 100% for Business' | 'Music Subscriptions'
  | 'Parking' | 'Rider Amenities - Water (non-GST)' | 'Rider Amenities - Mints, Tissues & Other (GST)'
  | 'Rideshare & Delivery Company Fees' | 'Sanitisation & Hygiene' | 'Stationery' | 'Sunglasses (only enter business portion)'
  | 'Tolls (Expenses)' | 'Other Expenses (GST)' | 'Other Expenses (non-GST)'
  | 'Uber Service Fees' | 'Other Charges from Uber' | 'Charges from 3rd Parties'
  | 'Split Fare Fees' | 'City/Government Fees' | 'Airport Fees' | 'Booking Fees'
  | 'DiDi Service Fee' | 'Booking Fee' | 'Handling Fee' | 'Government Levy'
  | 'CTP Fee' | 'Split Fare Fee' | 'Other Deductions';

export interface BusinessPercentages {
  motorVehicle: number;
  mobilePhone: number;
  internet: number;
  musicSubscriptions: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  dob?: string;
  avatar?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  type: TransactionType;
  category: EarningCategory | ExpenseCategory;
  grossAmount: number;
  gstAmount: number;
  claimableGstAmount?: number;
  netAmount: number;
  platform: Platform;
  sourceFile?: string;
  confidence: number;
}

export interface GSTSummary {
  totalCollected: number;
  totalPaid: number;
  netPayable: number;
  periodLabel: string;
}

export interface ExtractionResult {
  transactions: Omit<Transaction, 'id'>[];
  summaryNote?: string;
}
