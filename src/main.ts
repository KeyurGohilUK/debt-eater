import "./styles.css";
import {
  Loan,
  formatMoney,
  projectLoan,
  summarizeDebts,
  toMinorUnits,
} from "./domain/loan";
import { localLoanRepository } from "./repositories/loanRepository";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Application root not found");

let loans = localLoanRepository.list();
const uid = () => crypto.randomUUID();
const activeLoans = () => loans.filter((loan) => !loan.archived);
const archivedLoans = () => loans.filter((loan) => loan.archived);

function tenure(months: number | null): string {
  if (months === null) return "Payment too low";
  if (months === 0) return "Cleared";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return years ? `${years}y ${rest}m` : `${rest}m`;
}

function render() {
  const active = activeLoans();
  const archived = archivedLoans();
  const summaries = summarizeDebts(active);

  app!.innerHTML = `
    <header class="topbar"><div><img class="brand-icon" src="./debt-eater-icon.png" alt="" /><strong>Debt Eater</strong></div><button class="primary" id="add-loan">+ Add debt</button></header>
    <section class="hero">
      <p class="eyebrow">ACTIVE DEBT</p>
      <div class="total-list">${summaries.length ? summaries.map(({ currency, debtMinor }) => `<div class="total-item"><span>${currency === "GBP" ? "British pounds" : "Indian rupees"}</span><h1>${formatMoney(debtMinor, currency)}</h1></div>`).join("") : `<h1>${formatMoney(0, "GBP")}</h1>`}</div>
      <div class="scope"><span>${active.length} active debt${active.length === 1 ? "" : "s"}</span><span>Stored on this device</span></div>
    </section>
    ${active.length ? dashboardOverview(summaries) : ""}
    <section class="content">
      ${active.length ? `<div class="loan-grid">${active.map((loan) => loanCard(loan)).join("")}</div>` : emptyState()}
      ${archived.length ? `<details class="archived-section"><summary>Archived debts (${archived.length})</summary><div class="loan-grid">${archived.map((loan) => loanCard(loan, true)).join("")}</div></details>` : ""}
    </section>
    <dialog id="loan-dialog">${loanForm()}</dialog>
    <dialog id="repayment-dialog"><form method="dialog" id="repayment-form"><input type="hidden" name="loanId"><div class="dialog-head"><div><p class="eyebrow">DIRECT TO PRINCIPAL</p><h2>Add repayment</h2></div><button type="button" class="icon dialog-close" aria-label="Close">×</button></div><label>Amount <span id="repayment-currency"></span><input name="amount" type="number" min="0.01" step="0.01" required inputmode="decimal"></label><label>Date<input name="date" type="date" required></label><button class="primary full" value="default">Apply repayment</button></form></dialog>
  `;
  bind();
}

function dashboardOverview(
  summaries: ReturnType<typeof summarizeDebts>,
): string {
  return `<section class="dashboard" aria-labelledby="dashboard-heading">
    <div class="dashboard-heading"><div><p class="eyebrow">YOUR DEBT SNAPSHOT</p><h2 id="dashboard-heading">Repayment overview</h2></div><p>Projections assume your saved rates and monthly payments stay unchanged.</p></div>
    <div class="dashboard-grid">${summaries
      .map((summary) => {
        const payoff = summary.projectedPayoffDate
          ? summary.projectedPayoffDate.toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
            })
          : "Not yet predictable";
        return `<article class="dashboard-card">
        <div class="dashboard-card-head"><span class="dashboard-currency">${summary.currency}</span><span>${summary.debtCount} debt${summary.debtCount === 1 ? "" : "s"}</span></div>
        <div class="dashboard-balance"><span>Outstanding</span><strong>${formatMoney(summary.debtMinor, summary.currency)}</strong></div>
        <div class="progress dashboard-progress" role="progressbar" aria-label="${summary.currency} debt repaid" aria-valuenow="${summary.progressPercent.toFixed(0)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${summary.progressPercent}%"></i></div>
        <div class="progress-label"><span>${summary.progressPercent.toFixed(1)}% repaid</span><span>of ${formatMoney(summary.originalDebtMinor, summary.currency)}</span></div>
        <div class="dashboard-details">
          <div><span>Personal debt</span><strong>${formatMoney(summary.personalDebtMinor, summary.currency)}</strong></div>
          <div><span>Business debt</span><strong>${formatMoney(summary.businessDebtMinor, summary.currency)}</strong></div>
          <div><span>Monthly payments</span><strong>${formatMoney(summary.monthlyPaymentMinor, summary.currency)}</strong></div>
          <div><span>Projected debt-free</span><strong>${payoff}</strong></div>
        </div>
      </article>`;
      })
      .join("")}</div>
  </section>`;
}

function loanCard(loan: Loan, isArchived = false): string {
  const p = projectLoan(loan);
  const payoff = p.payoffDate
    ? p.payoffDate.toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      })
    : "—";
  return `<article class="loan-card${isArchived ? " archived-card" : ""}">
    <div class="card-head"><div><span class="pill">${loan.scope}</span><h2>${escapeHtml(loan.name)}</h2></div><span class="rate">${(loan.annualInterestRateBps / 100).toFixed(2)}%</span></div>
    <div class="balance"><span>Remaining</span><strong>${formatMoney(p.adjustedBalanceMinor, loan.currency)}</strong></div>
    <div class="progress" role="progressbar" aria-label="${escapeHtml(loan.name)} repaid" aria-valuenow="${p.progressPercent.toFixed(0)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p.progressPercent}%"></i></div>
    <div class="progress-label"><span>${p.progressPercent.toFixed(1)}% repaid</span><span>of ${formatMoney(loan.originalBalanceMinor, loan.currency)}</span></div>
    <div class="metrics"><div><span>Monthly payment</span><strong>${formatMoney(loan.monthlyPaymentMinor, loan.currency)}</strong></div><div><span>Tenure</span><strong>${tenure(p.monthsRemaining)}</strong></div><div><span>Payoff</span><strong>${payoff}</strong></div><div><span>Future interest</span><strong>${p.totalInterestMinor === null ? "—" : formatMoney(p.totalInterestMinor, loan.currency)}</strong></div></div>
    <div class="card-actions">${isArchived ? `<button class="secondary full restore" data-id="${loan.id}">Restore debt</button>` : `<button class="secondary edit" data-id="${loan.id}">Edit</button><button class="secondary archive" data-id="${loan.id}">Archive</button><button class="secondary full repayment" data-id="${loan.id}">+ Direct repayment</button>`}</div>
  </article>`;
}

function emptyState(): string {
  return `<div class="empty"><div class="empty-icon">↘</div><h2>Start with your first debt</h2><p>Add an existing balance and monthly payment. Debt Eater will calculate the projected remaining tenure.</p><button class="primary" id="empty-add">Add existing debt</button></div>`;
}

function loanForm(): string {
  return `<form method="dialog" id="loan-form"><input type="hidden" name="loanId"><div class="dialog-head"><div><p class="eyebrow">EXISTING DEBT</p><h2 id="loan-form-title">Add debt</h2></div><button type="button" class="icon dialog-close" aria-label="Close">×</button></div>
    <label>Debt name<input name="name" required maxlength="60" placeholder="Home mortgage"></label>
    <div class="form-grid"><label>Type<select name="scope"><option value="personal">Personal</option><option value="business">Business</option></select></label><label>Currency<select name="currency"><option value="GBP">GBP · British pound (£)</option><option value="INR">INR · Indian rupee (₹)</option></select><small id="currency-help"></small></label></div>
    <div class="form-grid"><label>Original amount<input name="original" type="number" min="0.01" step="0.01" required inputmode="decimal"></label><label>Current balance<input name="balance" type="number" min="0" step="0.01" required inputmode="decimal"></label></div>
    <div class="form-grid"><label>Interest rate (%)<input name="rate" type="number" min="0" max="100" step="0.01" required inputmode="decimal"></label><label>Monthly payment<input name="emi" type="number" min="0.01" step="0.01" required inputmode="decimal"></label></div>
    <p class="form-note" id="balance-help">Enter the balance currently shown by your lender.</p>
    <button class="primary full" id="loan-submit" value="default">Save debt</button></form>`;
}

function bind() {
  const loanDialog = document.querySelector<HTMLDialogElement>("#loan-dialog")!;
  const repaymentDialog =
    document.querySelector<HTMLDialogElement>("#repayment-dialog")!;
  document
    .querySelectorAll<HTMLButtonElement>(".dialog-close")
    .forEach((button) =>
      button.addEventListener("click", () => button.closest("dialog")?.close()),
    );
  const openNewLoan = () => {
    const form = document.querySelector<HTMLFormElement>("#loan-form")!;
    form.reset();
    (form.elements.namedItem("loanId") as HTMLInputElement).value = "";
    document.querySelector("#loan-form-title")!.textContent = "Add debt";
    document.querySelector("#loan-submit")!.textContent = "Save debt";
    document.querySelector<HTMLElement>("#balance-help")!.textContent =
      "Enter the balance currently shown by your lender.";
    const currency = form.elements.namedItem("currency") as HTMLSelectElement;
    currency.disabled = false;
    document.querySelector<HTMLElement>("#currency-help")!.textContent = "";
    loanDialog.showModal();
  };
  document.querySelector("#add-loan")?.addEventListener("click", openNewLoan);
  document.querySelector("#empty-add")?.addEventListener("click", openNewLoan);

  document.querySelectorAll<HTMLButtonElement>(".edit").forEach((button) =>
    button.addEventListener("click", () => {
      const loan = loans.find(({ id }) => id === button.dataset.id)!;
      const form = document.querySelector<HTMLFormElement>("#loan-form")!;
      const p = projectLoan(loan);
      (form.elements.namedItem("loanId") as HTMLInputElement).value = loan.id;
      (form.elements.namedItem("name") as HTMLInputElement).value = loan.name;
      (form.elements.namedItem("scope") as HTMLSelectElement).value =
        loan.scope;
      const currency = form.elements.namedItem("currency") as HTMLSelectElement;
      currency.value = loan.currency;
      currency.disabled = loan.directRepayments.length > 0;
      document.querySelector<HTMLElement>("#currency-help")!.textContent =
        currency.disabled
          ? "Currency cannot change after repayments are recorded."
          : "";
      (form.elements.namedItem("original") as HTMLInputElement).value = (
        loan.originalBalanceMinor / 100
      ).toFixed(2);
      (form.elements.namedItem("balance") as HTMLInputElement).value = (
        p.adjustedBalanceMinor / 100
      ).toFixed(2);
      (form.elements.namedItem("rate") as HTMLInputElement).value = (
        loan.annualInterestRateBps / 100
      ).toFixed(2);
      (form.elements.namedItem("emi") as HTMLInputElement).value = (
        loan.monthlyPaymentMinor / 100
      ).toFixed(2);
      document.querySelector("#loan-form-title")!.textContent = "Edit debt";
      document.querySelector("#loan-submit")!.textContent = "Save changes";
      document.querySelector<HTMLElement>("#balance-help")!.textContent =
        "Enter the lender’s current balance. Recorded repayments will stay in history.";
      loanDialog.showModal();
    }),
  );

  document
    .querySelectorAll<HTMLButtonElement>(".archive")
    .forEach((button) =>
      button.addEventListener("click", () =>
        updateLoan(button.dataset.id!, { archived: true }),
      ),
    );
  document
    .querySelectorAll<HTMLButtonElement>(".restore")
    .forEach((button) =>
      button.addEventListener("click", () =>
        updateLoan(button.dataset.id!, { archived: false }),
      ),
    );

  document
    .querySelector<HTMLFormElement>("#loan-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const id = String(data.get("loanId") ?? "");
      const existing = loans.find((loan) => loan.id === id);
      const original = toMinorUnits(Number(data.get("original")));
      const balance = toMinorUnits(Number(data.get("balance")));
      if (balance > original)
        return alert("Current balance cannot exceed original amount.");
      const currency =
        existing && existing.directRepayments.length > 0
          ? existing.currency
          : data.get("currency") === "INR"
            ? "INR"
            : "GBP";
      const repayments = existing?.directRepayments ?? [];
      const savedBalance =
        balance +
        repayments.reduce((sum, repayment) => sum + repayment.amountMinor, 0);
      const loan: Loan = {
        id: existing?.id ?? uid(),
        name: String(data.get("name")).trim(),
        scope: data.get("scope") === "business" ? "business" : "personal",
        currency,
        archived: existing?.archived ?? false,
        originalBalanceMinor: original,
        currentBalanceMinor: savedBalance,
        annualInterestRateBps: Math.round(Number(data.get("rate")) * 100),
        monthlyPaymentMinor: toMinorUnits(Number(data.get("emi"))),
        directRepayments: repayments,
      };
      loans = existing
        ? loans.map((item) => (item.id === id ? loan : item))
        : [...loans, loan];
      localLoanRepository.save(loans);
      loanDialog.close();
      render();
    });

  document.querySelectorAll<HTMLButtonElement>(".repayment").forEach((button) =>
    button.addEventListener("click", () => {
      const loan = loans.find(({ id }) => id === button.dataset.id)!;
      const form = document.querySelector<HTMLFormElement>("#repayment-form")!;
      (form.elements.namedItem("loanId") as HTMLInputElement).value = loan.id;
      (form.elements.namedItem("date") as HTMLInputElement).value = new Date()
        .toISOString()
        .slice(0, 10);
      document.querySelector<HTMLElement>("#repayment-currency")!.textContent =
        `(${loan.currency})`;
      repaymentDialog.showModal();
    }),
  );
  document
    .querySelector<HTMLFormElement>("#repayment-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget as HTMLFormElement);
      const id = String(data.get("loanId"));
      const amount = toMinorUnits(Number(data.get("amount")));
      loans = loans.map((loan) =>
        loan.id === id
          ? {
              ...loan,
              directRepayments: [
                ...loan.directRepayments,
                {
                  id: uid(),
                  amountMinor: amount,
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

function updateLoan(id: string, changes: Partial<Loan>) {
  loans = loans.map((loan) =>
    loan.id === id ? { ...loan, ...changes } : loan,
  );
  localLoanRepository.save(loans);
  render();
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

render();
