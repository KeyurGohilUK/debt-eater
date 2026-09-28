import "./styles.css";
import { Loan, penceToPounds, poundsToPence, projectLoan } from "./domain/loan";
import { localLoanRepository } from "./repositories/loanRepository";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Application root not found");

let loans = localLoanRepository.list();
const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});
const fmt = (pence: number) => money.format(penceToPounds(pence));
const uid = () => crypto.randomUUID();

function tenure(months: number | null): string {
  if (months === null) return "Payment too low";
  if (months === 0) return "Cleared";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return years ? `${years}y ${rest}m` : `${rest}m`;
}

function render() {
  const total = loans.reduce(
    (sum, loan) => sum + projectLoan(loan).adjustedBalancePence,
    0,
  );
  app!.innerHTML = `
    <header class="topbar"><div><span class="mark">DE</span><strong>Debt Eater</strong></div><button class="primary" id="add-loan">+ Add loan</button></header>
    <section class="hero">
      <p class="eyebrow">TOTAL DEBT</p><h1>${fmt(total)}</h1>
      <div class="scope"><span>${loans.length} active loan${loans.length === 1 ? "" : "s"}</span><span>Stored on this device</span></div>
    </section>
    <section class="content">
      ${loans.length ? `<div class="loan-grid">${loans.map(loanCard).join("")}</div>` : emptyState()}
    </section>
    <dialog id="loan-dialog">${loanForm()}</dialog>
    <dialog id="repayment-dialog"><form method="dialog" id="repayment-form"><input type="hidden" name="loanId"><div class="dialog-head"><div><p class="eyebrow">DIRECT TO PRINCIPAL</p><h2>Add repayment</h2></div><button class="icon" value="cancel" aria-label="Close">×</button></div><label>Amount (£)<input name="amount" type="number" min="0.01" step="0.01" required inputmode="decimal"></label><label>Date<input name="date" type="date" required></label><button class="primary full" value="default">Apply repayment</button></form></dialog>
  `;
  bind();
}

function loanCard(loan: Loan): string {
  const p = projectLoan(loan);
  const payoff = p.payoffDate
    ? p.payoffDate.toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      })
    : "—";
  return `<article class="loan-card">
    <div class="card-head"><div><span class="pill">${loan.scope}</span><h2>${escapeHtml(loan.name)}</h2></div><span class="rate">${(loan.annualInterestRateBps / 100).toFixed(2)}%</span></div>
    <div class="balance"><span>Remaining</span><strong>${fmt(p.adjustedBalancePence)}</strong></div>
    <div class="progress" role="progressbar" aria-label="${escapeHtml(loan.name)} repaid" aria-valuenow="${p.progressPercent.toFixed(0)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p.progressPercent}%"></i></div>
    <div class="progress-label"><span>${p.progressPercent.toFixed(1)}% repaid</span><span>of ${fmt(loan.originalBalancePence)}</span></div>
    <div class="metrics"><div><span>EMI</span><strong>${fmt(loan.monthlyPaymentPence)}</strong></div><div><span>Tenure</span><strong>${tenure(p.monthsRemaining)}</strong></div><div><span>Payoff</span><strong>${payoff}</strong></div><div><span>Future interest</span><strong>${p.totalInterestPence === null ? "—" : fmt(p.totalInterestPence)}</strong></div></div>
    <button class="secondary full repayment" data-id="${loan.id}">+ Direct repayment</button>
  </article>`;
}

function emptyState(): string {
  return `<div class="empty"><div class="empty-icon">↘</div><h2>Start with your first loan</h2><p>Add an existing loan balance and EMI. Debt Eater will calculate the projected remaining tenure.</p><button class="primary" id="empty-add">Add existing loan</button></div>`;
}

function loanForm(): string {
  return `<form method="dialog" id="loan-form"><div class="dialog-head"><div><p class="eyebrow">EXISTING DEBT</p><h2>Add loan</h2></div><button class="icon" value="cancel" aria-label="Close">×</button></div>
    <label>Loan name<input name="name" required maxlength="60" placeholder="Home mortgage"></label>
    <label>Type<select name="scope"><option value="personal">Personal</option><option value="business">Business</option></select></label>
    <div class="form-grid"><label>Original amount (£)<input name="original" type="number" min="0.01" step="0.01" required inputmode="decimal"></label><label>Current balance (£)<input name="balance" type="number" min="0" step="0.01" required inputmode="decimal"></label></div>
    <div class="form-grid"><label>Interest rate (%)<input name="rate" type="number" min="0" max="100" step="0.01" required inputmode="decimal"></label><label>Monthly EMI (£)<input name="emi" type="number" min="0.01" step="0.01" required inputmode="decimal"></label></div>
    <button class="primary full" value="default">Save loan</button></form>`;
}

function bind() {
  const loanDialog = document.querySelector<HTMLDialogElement>("#loan-dialog")!;
  const repaymentDialog =
    document.querySelector<HTMLDialogElement>("#repayment-dialog")!;
  document
    .querySelector("#add-loan")
    ?.addEventListener("click", () => loanDialog.showModal());
  document
    .querySelector("#empty-add")
    ?.addEventListener("click", () => loanDialog.showModal());
  document
    .querySelector<HTMLFormElement>("#loan-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget as HTMLFormElement);
      const original = poundsToPence(Number(data.get("original")));
      const balance = poundsToPence(Number(data.get("balance")));
      if (balance > original)
        return alert("Current balance cannot exceed original amount.");
      loans = [
        ...loans,
        {
          id: uid(),
          name: String(data.get("name")).trim(),
          scope: data.get("scope") === "business" ? "business" : "personal",
          originalBalancePence: original,
          currentBalancePence: balance,
          annualInterestRateBps: Math.round(Number(data.get("rate")) * 100),
          monthlyPaymentPence: poundsToPence(Number(data.get("emi"))),
          directRepayments: [],
        },
      ];
      localLoanRepository.save(loans);
      loanDialog.close();
      render();
    });
  document.querySelectorAll<HTMLButtonElement>(".repayment").forEach((button) =>
    button.addEventListener("click", () => {
      const form = document.querySelector<HTMLFormElement>("#repayment-form")!;
      (form.elements.namedItem("loanId") as HTMLInputElement).value =
        button.dataset.id ?? "";
      (form.elements.namedItem("date") as HTMLInputElement).value = new Date()
        .toISOString()
        .slice(0, 10);
      repaymentDialog.showModal();
    }),
  );
  document
    .querySelector<HTMLFormElement>("#repayment-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget as HTMLFormElement);
      const id = String(data.get("loanId"));
      const amount = poundsToPence(Number(data.get("amount")));
      loans = loans.map((loan) =>
        loan.id === id
          ? {
              ...loan,
              directRepayments: [
                ...loan.directRepayments,
                {
                  id: uid(),
                  amountPence: amount,
                  date: String(data.get("date")),
                },
              ],
            }
          : loan,
      );
      localLoanRepository.save(loans);
      repaymentDialog.close();
      render();
    });
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

render();
