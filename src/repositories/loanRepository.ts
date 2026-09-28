import type { Loan } from "../domain/loan";

const STORAGE_KEY = "debt-eater.loans.v1";

export interface LoanRepository {
  list(): Loan[];
  save(loans: Loan[]): void;
}

export const localLoanRepository: LoanRepository = {
  list() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value ? (JSON.parse(value) as Loan[]) : [];
    } catch {
      return [];
    }
  },
  save(loans) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loans));
  },
};
