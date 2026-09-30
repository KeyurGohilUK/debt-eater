import type { DirectRepayment, Loan, PaymentRecord } from "../domain/loan";

const STORAGE_KEY = "debt-eater.loans.v2";
const LEGACY_STORAGE_KEY = "debt-eater.loans.v1";

export interface LoanRepository {
  list(): Loan[];
  save(loans: Loan[]): void;
}

interface LegacyDirectRepayment extends Omit<DirectRepayment, "amountMinor"> {
  amountPence: number;
}

interface StoredLoan extends Omit<
  Loan,
  "monthlyOverpaymentMinor" | "payments"
> {
  monthlyOverpaymentMinor?: number;
  payments?: PaymentRecord[];
}

interface LegacyLoan extends Omit<
  Loan,
  | "currency"
  | "archived"
  | "originalBalanceMinor"
  | "currentBalanceMinor"
  | "monthlyPaymentMinor"
  | "monthlyOverpaymentMinor"
  | "payments"
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
        if (current) {
          const normalized = (JSON.parse(current) as StoredLoan[]).map(
            (loan): Loan => ({
              ...loan,
              monthlyOverpaymentMinor:
                Number.isSafeInteger(loan.monthlyOverpaymentMinor) &&
                (loan.monthlyOverpaymentMinor ?? 0) >= 0
                  ? (loan.monthlyOverpaymentMinor ?? 0)
                  : 0,
              payments: Array.isArray(loan.payments) ? loan.payments : [],
            }),
          );
          storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          return normalized;
        }

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
            monthlyOverpaymentMinor: 0,
            payments: [],
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
