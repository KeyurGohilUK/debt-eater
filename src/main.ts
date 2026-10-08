import "./styles.css";
import {
  Loan,
  formatMoney,
  projectLoan,
  simulateLoan,
  summarizeDebts,
  toMinorUnits,
} from "./domain/loan";
import { localLoanRepository } from "./repositories/loanRepository";
import { mountInvestments } from "./features/investments/view";
import { summarizeInvestments } from "./domain/investment";
import { localInvestmentRepository } from "./repositories/investmentRepository";
import { escapeHtml } from "./shared/html";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Application root not found");

let loans = localLoanRepository.list();
type AppModule = "overview" | "debts" | "investments";
let activeModule: AppModule = parseModule(window.location.hash);

function parseModule(hash: string): AppModule {
  if (hash === "#/investments") return "investments";
  if (hash === "#/debts") return "debts";
  return "overview";
}
const uid = () => crypto.randomUUID();
const activeLoans = () => loans.filter((loan) => !loan.archived);
const archivedLoans = () => loans.filter((loan) => loan.archived);

function tenure(months: number | null): string {
  if (months === null) return "Payment too low";
  if (months === 0) return "Cleared (0 months)";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${months} month${months === 1 ? "" : "s"}`;
  return `${years}y ${rest}m (${months} months)`;
}

function render() {
  const header = `<header class="topbar"><div><img class="brand-icon" src="./debt-eater-icon.png" alt="" /><strong>Finance Tracker</strong></div><nav class="module-nav" aria-label="Finance sections"><a href="#/overview" aria-label="Overview" ${activeModule === "overview" ? 'aria-current="page"' : ""}>Overview</a><a href="#/debts" aria-label="Debt Eater" ${activeModule === "debts" ? 'aria-current="page"' : ""}><span class="nav-label-full">Debt Eater</span><span class="nav-label-short">Debt</span></a><a href="#/investments" aria-label="Investments &amp; savings" ${activeModule === "investments" ? 'aria-current="page"' : ""}><span class="nav-label-full">Investments &amp; savings</span><span class="nav-label-short">Investments</span></a></nav>${activeModule === "debts" ? '<button class="primary" id="add-loan">+ Add debt</button>' : ""}</header>`;
  if (activeModule === "overview") {
    app!.innerHTML = `${header}${financeOverview()}`;
    return;
  }
  if (activeModule === "investments") {
    app!.innerHTML = `${header}<main id="module-content"></main>`;
    const content = document.querySelector<HTMLElement>("#module-content");
    if (content) mountInvestments(content);
    return;
  }

  const active = activeLoans();
  const archived = archivedLoans();
  const summaries = summarizeDebts(active);

  app!.innerHTML = `
    ${header}
    <section class="hero">
      <p class="eyebrow">ACTIVE DEBT</p>
      <div class="total-list">${summaries.length ? summaries.map(({ currency, debtMinor }) => `<div class="total-item"><span>${currency === "GBP" ? "Pound sterling" : currency === "EUR" ? "Euro" : "Indian rupees"}</span><h1>${formatMoney(debtMinor, currency)}</h1></div>`).join("") : `<h1>${formatMoney(0, "GBP")}</h1>`}</div>
      <div class="scope"><span>${active.length} active debt${active.length === 1 ? "" : "s"}</span><span>Stored on this device</span></div>
    </section>
    ${active.length ? dashboardOverview(summaries) : ""}
    <section class="content">
      ${active.length ? `<div class="loan-grid">${active.map((loan) => loanCard(loan)).join("")}</div>` : emptyState()}
      ${archived.length ? `<details class="archived-section"><summary>Archived debts (${archived.length})</summary><div class="loan-grid">${archived.map((loan) => loanCard(loan, true)).join("")}</div></details>` : ""}
    </section>
    <dialog id="loan-dialog">${loanForm()}</dialog>
    <dialog id="repayment-dialog"><form method="dialog" id="repayment-form"><input type="hidden" name="loanId"><div class="dialog-head"><div><p class="eyebrow">DIRECT TO PRINCIPAL</p><h2>Add repayment</h2></div><button type="button" class="icon dialog-close" aria-label="Close">×</button></div><label>Amount to principal <span id="repayment-currency"></span><input name="amount" type="number" min="0.01" step="0.01" required inputmode="decimal"></label><label>Date<input name="date" type="date" required></label><button class="primary full" value="default">Apply repayment</button></form></dialog>
    <dialog id="simulator-dialog" aria-labelledby="simulator-title"><section class="simulator-shell"><div class="dialog-head"><div><p class="eyebrow">WHAT IF?</p><h2 id="simulator-title">Repayment simulator</h2><p class="simulator-debt" id="simulator-debt"></p></div><button type="button" class="icon dialog-close" aria-label="Close">×</button></div><form id="simulator-form"><input type="hidden" name="loanId"><label>Extra each month <span id="simulator-currency"></span><input name="monthlyExtra" type="number" min="0" step="0.01" value="0" inputmode="decimal"></label><label>One-off repayment now <span id="simulator-lump-currency"></span><input name="lumpSum" type="number" min="0" step="0.01" value="0" inputmode="decimal"></label><p class="simulator-note">Uses your saved balance, interest rate and direct-debit schedule. Scenario changes are not saved.</p></form><div id="simulator-results" aria-live="polite"></div></section></dialog>
  `;
  bind();
}

function financeOverview(): string {
  const debtSummaries = summarizeDebts(activeLoans());
  const investmentSummaries = summarizeInvestments(
    localInvestmentRepository.list(),
  );
  const debtCards = debtSummaries.length
    ? debtSummaries
        .map(
          (summary) => `<article class="finance-currency-card">
            <span class="dashboard-currency">${summary.currency}</span>
            <div><span>Outstanding debt</span><strong>${formatMoney(summary.debtMinor, summary.currency)}</strong></div>
            <small>${summary.debtCount} active debt${summary.debtCount === 1 ? "" : "s"}</small>
          </article>`,
        )
        .join("")
    : `<p class="overview-empty">No active debts</p>`;
  const investmentCards = investmentSummaries.length
    ? investmentSummaries
        .map(
          (summary) => `<article class="finance-currency-card">
            <span class="dashboard-currency">${summary.currency}</span>
            <div><span>Invested</span><strong>${formatMoney(summary.investedMinor, summary.currency)}</strong></div>
            <small>${summary.valuedEntryCount} of ${summary.entryCount} entries valued${summary.valuedEntryCount ? ` · Current value ${formatMoney(summary.currentValueMinor, summary.currency)}` : ""}</small>
          </article>`,
        )
        .join("")
    : `<p class="overview-empty">No investment or savings entries</p>`;

  return `<main class="finance-overview">
    <section class="overview-welcome"><p class="eyebrow">YOUR FINANCES</p><h1>One clear view of your money</h1><p>Track debt, investments and savings in one place.</p></section>
    <section class="overview-feature" aria-labelledby="overview-debts-title"><div class="overview-feature-head"><div><p class="eyebrow">DEBT MANAGEMENT</p><h2 id="overview-debts-title">Debt Eater</h2></div><a class="secondary" href="#/debts">Open debts <span aria-hidden="true">→</span></a></div><div class="finance-currency-grid">${debtCards}</div></section>
    <section class="overview-feature" aria-labelledby="overview-investments-title"><div class="overview-feature-head"><div><p class="eyebrow">ASSETS</p><h2 id="overview-investments-title">Investments &amp; savings</h2></div><a class="secondary" href="#/investments">Open investments <span aria-hidden="true">→</span></a></div><div class="finance-currency-grid">${investmentCards}</div></section>
  </main>`;
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
          <div><span>Required monthly</span><strong>${formatMoney(summary.monthlyPaymentMinor, summary.currency)}</strong></div>
          <div><span>Planned monthly extra</span><strong>${formatMoney(summary.monthlyOverpaymentMinor, summary.currency)}</strong></div>
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
    <div class="metrics"><div><span>Required monthly</span><strong>${formatMoney(loan.monthlyPaymentMinor, loan.currency)}</strong></div><div><span>Planned monthly extra</span><strong>${formatMoney(loan.monthlyOverpaymentMinor, loan.currency)}</strong></div><div><span>Tenure</span><strong>${tenure(p.monthsRemaining)}</strong></div><div><span>Payoff</span><strong>${payoff}</strong></div><div><span>Future interest</span><strong>${p.totalInterestMinor === null ? "—" : formatMoney(p.totalInterestMinor, loan.currency)}</strong></div></div>
    ${paymentHistory(loan)}<div class="card-actions">${isArchived ? `<button class="secondary full restore" data-id="${loan.id}">Restore debt</button>` : `<button class="secondary edit" data-id="${loan.id}">Edit</button><button class="secondary archive" data-id="${loan.id}">Archive</button><button class="secondary full simulate" data-id="${loan.id}">Simulate repayments</button><button class="secondary full repayment" data-id="${loan.id}">+ Direct repayment</button>`}</div>
  </article>`;
}

function paymentHistory(loan: Loan): string {
  const records = [
    ...loan.directRepayments.map((repayment) => ({
      id: repayment.id,
      date: repayment.date,
      title: "Direct principal",
      amountMinor: repayment.amountMinor,
      detail: "Applied to principal",
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  if (records.length === 0) return "";
  return `<details class="payment-history">
    <summary>Payment history (${records.length})</summary>
    <ul class="payment-list">${records
      .map((record) => {
        const date = new Date(`${record.date}T00:00:00`).toLocaleDateString(
          "en-GB",
        );
        return `<li>
          <div><strong>${record.title}</strong><span>${escapeHtml(date)}</span></div>
          <strong>${formatMoney(record.amountMinor, loan.currency)}</strong>
          <small>${record.detail}</small>
        </li>`;
      })
      .join("")}</ul>
  </details>`;
}

function emptyState(): string {
  return `<div class="empty"><div class="empty-icon">↘</div><h2>Start with your first debt</h2><p>Add an existing balance and monthly payment. Debt Eater will calculate the projected remaining tenure.</p><button class="primary" id="empty-add">Add existing debt</button></div>`;
}

function loanForm(): string {
  return `<form method="dialog" id="loan-form"><input type="hidden" name="loanId"><div class="dialog-head"><div><p class="eyebrow">EXISTING DEBT</p><h2 id="loan-form-title">Add debt</h2></div><button type="button" class="icon dialog-close" aria-label="Close">×</button></div>
    <label>Debt name<input name="name" required maxlength="60" placeholder="Home mortgage"></label>
    <div class="form-grid"><label>Type<select name="scope"><option value="personal">Personal</option><option value="business">Business</option></select></label><label>Currency<select name="currency"><option value="GBP">GBP · Pound sterling (£)</option><option value="EUR">EUR · Euro (€)</option><option value="INR">INR · Indian rupee (₹)</option></select><small id="currency-help"></small></label></div>
    <div class="form-grid"><label>Original amount<input name="original" type="number" min="0.01" step="0.01" required inputmode="decimal"></label><label>Current balance<input name="balance" type="number" min="0" step="0.01" required inputmode="decimal"></label></div>
    <div class="form-grid"><label>Interest rate (%)<input name="rate" type="number" min="0" max="100" step="0.01" required inputmode="decimal"></label><label>Monthly direct debit amount<input name="emi" type="number" min="0.01" step="0.01" required inputmode="decimal"></label></div>
    <label>Next direct debit date<input name="nextPaymentDate" type="date" required></label>
    <label>Planned monthly overpayment (optional)<input name="monthlyOverpayment" type="number" min="0" step="0.01" value="0" required inputmode="decimal"></label>
    <p class="form-note" id="balance-help">Add the direct debit amount and next collection date. The app estimates the remaining schedule; it won’t ask you to record each debit.</p>
    <button class="primary full" id="loan-submit" value="default">Save debt</button></form>`;
}

function bind() {
  const loanDialog = document.querySelector<HTMLDialogElement>("#loan-dialog")!;
  const repaymentDialog =
    document.querySelector<HTMLDialogElement>("#repayment-dialog")!;
  const simulatorDialog =
    document.querySelector<HTMLDialogElement>("#simulator-dialog")!;
  document
    .querySelectorAll<HTMLButtonElement>(".dialog-close")
    .forEach((button) =>
      button.addEventListener("click", () => button.closest("dialog")?.close()),
    );
  const openNewLoan = () => {
    const form = document.querySelector<HTMLFormElement>("#loan-form")!;
    form.reset();
    (form.elements.namedItem("loanId") as HTMLInputElement).value = "";
    (form.elements.namedItem("nextPaymentDate") as HTMLInputElement).value =
      new Date().toISOString().slice(0, 10);
    document.querySelector("#loan-form-title")!.textContent = "Add debt";
    document.querySelector("#loan-submit")!.textContent = "Save debt";
    document.querySelector<HTMLElement>("#balance-help")!.textContent =
      "Add the direct debit amount and next collection date. The app estimates the remaining schedule; it won’t ask you to record each debit.";
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
      (form.elements.namedItem("nextPaymentDate") as HTMLInputElement).value =
        loan.nextPaymentDate;
      (
        form.elements.namedItem("monthlyOverpayment") as HTMLInputElement
      ).value = (loan.monthlyOverpaymentMinor / 100).toFixed(2);
      document.querySelector("#loan-form-title")!.textContent = "Edit debt";
      document.querySelector("#loan-submit")!.textContent = "Save changes";
      document.querySelector<HTMLElement>("#balance-help")!.textContent =
        "The estimate uses this balance, rate and direct debit schedule. Update them if your loan terms change.";
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
            : data.get("currency") === "EUR"
              ? "EUR"
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
        nextPaymentDate: String(data.get("nextPaymentDate")),
        monthlyOverpaymentMinor: toMinorUnits(
          Number(data.get("monthlyOverpayment")),
        ),
        directRepayments: repayments,
      };
      loans = existing
        ? loans.map((item) => (item.id === id ? loan : item))
        : [...loans, loan];
      localLoanRepository.save(loans);
      loanDialog.close();
      render();
    });

  const openRepaymentDialog = (loanId: string) => {
    const loan = loans.find(({ id }) => id === loanId)!;
    const form = document.querySelector<HTMLFormElement>("#repayment-form")!;
    form.reset();
    (form.elements.namedItem("loanId") as HTMLInputElement).value = loan.id;
    (form.elements.namedItem("date") as HTMLInputElement).value = new Date()
      .toISOString()
      .slice(0, 10);
    (form.elements.namedItem("amount") as HTMLInputElement).value = "";
    document.querySelector<HTMLElement>("#repayment-currency")!.textContent =
      `(${loan.currency})`;
    repaymentDialog.showModal();
  };

  document
    .querySelectorAll<HTMLButtonElement>(".repayment")
    .forEach((button) =>
      button.addEventListener("click", () =>
        openRepaymentDialog(button.dataset.id!),
      ),
    );
  document.querySelectorAll<HTMLButtonElement>(".simulate").forEach((button) =>
    button.addEventListener("click", () => {
      const loan = loans.find(({ id }) => id === button.dataset.id)!;
      const form = document.querySelector<HTMLFormElement>("#simulator-form")!;
      form.reset();
      (form.elements.namedItem("loanId") as HTMLInputElement).value = loan.id;
      document.querySelector<HTMLElement>("#simulator-debt")!.textContent =
        loan.name;
      document.querySelector<HTMLElement>("#simulator-currency")!.textContent =
        `(${loan.currency})`;
      document.querySelector<HTMLElement>(
        "#simulator-lump-currency",
      )!.textContent = `(${loan.currency})`;
      simulatorDialog.showModal();
      updateSimulator(loan);
    }),
  );
  document
    .querySelector<HTMLFormElement>("#simulator-form")
    ?.addEventListener("input", () => {
      const loanId = (
        document
          .querySelector<HTMLFormElement>("#simulator-form")!
          .elements.namedItem("loanId") as HTMLInputElement
      ).value;
      const loan = loans.find(({ id }) => id === loanId);
      if (loan) updateSimulator(loan);
    });
  document
    .querySelector<HTMLFormElement>("#repayment-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const id = String(data.get("loanId"));
      const date = String(data.get("date"));
      const amount = toMinorUnits(Number(data.get("amount")));
      loans = loans.map((loan) =>
        loan.id === id
          ? {
              ...loan,
              directRepayments: [
                ...loan.directRepayments,
                { id: uid(), amountMinor: amount, date },
              ],
            }
          : loan,
      );
      localLoanRepository.save(loans);
      repaymentDialog.close();
      render();
    });
}

function updateSimulator(loan: Loan) {
  const form = document.querySelector<HTMLFormElement>("#simulator-form")!;
  const formData = new FormData(form);
  const simulation = simulateLoan(loan, {
    additionalMonthlyPaymentMinor: toMinorUnits(
      Number(formData.get("monthlyExtra")),
    ),
    lumpSumMinor: toMinorUnits(Number(formData.get("lumpSum"))),
  });
  const { baseline, scenario } = simulation;
  const moneySaved = (amount: number | null) =>
    amount === null ? "—" : formatMoney(amount, loan.currency);
  const projectedDate = (date: Date | null) =>
    date
      ? date.toLocaleDateString("en-GB", { month: "short", year: "numeric" })
      : "Not predictable";
  const baselineValues = baseline.balanceTrajectoryMinor ?? [];
  const scenarioValues = scenario.balanceTrajectoryMinor ?? [];
  const maxLength = Math.max(baselineValues.length, scenarioValues.length);
  const maxBalance = Math.max(1, ...baselineValues, ...scenarioValues);
  const chartLine = (values: number[]) =>
    values
      .map((value, index) => {
        const x = 12 + (index / Math.max(1, maxLength - 1)) * 296;
        const y = 12 + (1 - value / maxBalance) * 126;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  const baselineMonthText =
    baseline.monthsRemaining === null
      ? "Unknown"
      : tenure(baseline.monthsRemaining);
  const scenarioMonthText =
    scenario.monthsRemaining === null
      ? "Unknown"
      : tenure(scenario.monthsRemaining);

  document.querySelector<HTMLElement>("#simulator-results")!.innerHTML = `
    <div class="simulator-savings">
      <article><span>Time saved</span><strong>${simulation.monthsSaved === null ? "—" : tenure(simulation.monthsSaved)}</strong></article>
      <article><span>Interest saved</span><strong>${moneySaved(simulation.interestSavedMinor)}</strong></article>
    </div>
    <div class="simulator-comparison">
      <article><p>Current plan</p><strong>${baselineMonthText}</strong><span>Payoff ${projectedDate(baseline.payoffDate)} · Interest ${moneySaved(baseline.totalInterestMinor)}</span></article>
      <article><p>With scenario</p><strong>${scenarioMonthText}</strong><span>Payoff ${projectedDate(scenario.payoffDate)} · Interest ${moneySaved(scenario.totalInterestMinor)}</span></article>
    </div>
    <div class="simulator-chart-wrap"><p>Estimated balance over time</p><svg class="simulator-chart" viewBox="0 0 320 150" role="img" aria-label="Estimated balance projection for ${escapeHtml(loan.name)}"><line x1="12" y1="138" x2="308" y2="138"></line><polyline class="baseline-line" points="${chartLine(baselineValues)}"></polyline><polyline class="scenario-line" points="${chartLine(scenarioValues)}"></polyline></svg><div class="chart-legend"><span><i class="baseline-key"></i>Current plan</span><span><i class="scenario-key"></i>Scenario</span></div></div>`;
}

function updateLoan(id: string, changes: Partial<Loan>) {
  loans = loans.map((loan) =>
    loan.id === id ? { ...loan, ...changes } : loan,
  );
  localLoanRepository.save(loans);
  render();
}

window.addEventListener("hashchange", () => {
  activeModule = parseModule(window.location.hash);
  render();
});

render();
