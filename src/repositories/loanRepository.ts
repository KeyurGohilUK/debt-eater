import type { DirectRepayment, Loan } from "../domain/loan";

const STORAGE_KEY = "debt-eater.loans.v2";
const LEGACY_STORAGE_KEY = "debt-eater.loans.v1";

export interface LoanRepository {
  list(): Loan[];
  save(loans: Loan[]): void;
}

interface LegacyDirectRepayment extends Omit<DirectRepayment, "amountMinor"> {
  amountPence: number;
}

interface LegacyLoan extends Omit<
  Loan,
  | "currency"
  | "archived"
  | "originalBalanceMinor"
  | "currentBalanceMinor"
  | "monthlyPaymentMinor"
  | "directRepayments"
> {
  originalBalancePence: number;
  currentBalancePence: number;
  monthlyPaymentPence: number;
  directRepayments: LegacyDirectRepayment[];
}

export function createLocalLoanRepository(storage: Storage): LoanRepository {
  return {
    list() {
      try {
        const current = storage.getItem(STORAGE_KEY);
        if (current) return JSON.parse(current) as Loan[];

        const legacy = storage.getItem(LEGACY_STORAGE_KEY);
        if (!legacy) return [];

        const migrated = (JSON.parse(legacy) as LegacyLoan[]).map(
          (loan): Loan => ({
            id: loan.id,
            name: loan.name,
            scope: loan.scope,
            currency: "GBP",
            archived: false,
            originalBalanceMinor: loan.originalBalancePence,
            currentBalanceMinor: loan.currentBalancePence,
            annualInterestRateBps: loan.annualInterestRateBps,
            monthlyPaymentMinor: loan.monthlyPaymentPence,
            directRepayments: loan.directRepayments.map((repayment) => ({
              id: repayment.id,
              amountMinor: repayment.amountPence,
              date: repayment.date,
            })),
          }),
        );
        storage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      } catch {
        return [];
      }
    },
    save(loans) {
      storage.setItem(STORAGE_KEY, JSON.stringify(loans));
    },
  };
}

const browserStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
} as Storage;

export const localLoanRepository = createLocalLoanRepository(browserStorage);
