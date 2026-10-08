import {
  fromMinorUnits,
  formatMoney,
  isCurrency,
  toMinorUnits,
} from "../../domain/money";
import {
  summarizeInvestments,
  type InvestmentEntry,
  type InvestmentScope,
} from "../../domain/investment";
import { localInvestmentRepository } from "../../repositories/investmentRepository";
import { escapeHtml } from "../../shared/html";

const uid = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);

export function mountInvestments(container: HTMLElement): void {
  let entries = localInvestmentRepository.list();

  const render = () => {
    const summaries = summarizeInvestments(entries);
    container.innerHTML = `
      <section class="investment-page" aria-labelledby="investments-title">
        <div class="investment-heading">
          <div><p class="eyebrow">PORTFOLIO</p><h1 id="investments-title">Investments &amp; savings</h1><p class="investment-subtitle">A clear view of what you’ve put aside, across accounts and currencies.</p></div>
          <button class="primary" id="add-investment">+ Add entry</button>
        </div>
        <div class="investment-summary" aria-label="Investment totals">
          ${
            summaries.length
              ? summaries
                  .map(
                    (summary) => `<article class="investment-total">
            <div class="investment-total-head"><span>${summary.currency}</span><span>${summary.entryCount} entr${summary.entryCount === 1 ? "y" : "ies"}</span></div>
            <div class="investment-total-row"><span>Invested</span><strong>${formatMoney(summary.investedMinor, summary.currency)}</strong></div>
            <div class="investment-total-row"><span>Current value <small>(${summary.valuedEntryCount} valued)</small></span><strong>${summary.valuedEntryCount ? formatMoney(summary.currentValueMinor, summary.currency) : "—"}</strong></div>
            ${summary.valuedEntryCount ? `<div class="investment-change ${summary.gainMinor >= 0 ? "positive" : "negative"}"><span>Change on valued entries</span><strong>${summary.gainMinor > 0 ? "+" : ""}${formatMoney(summary.gainMinor, summary.currency)}</strong></div>` : ""}
          </article>`,
                  )
                  .join("")
              : `<div class="investment-empty-summary"><span class="empty-icon" aria-hidden="true">↗</span><strong>Your portfolio starts here</strong><span>Add your first investment or savings entry.</span></div>`
          }
        </div>
        ${
          entries.length
            ? `<section class="investment-ledger" aria-labelledby="ledger-title"><div class="section-title"><div><p class="eyebrow">ACTIVITY</p><h2 id="ledger-title">Your entries</h2></div><span>${entries.length} total</span></div><div class="investment-list">${[
                ...entries,
              ]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((entry) => investmentCard(entry))
                .join("")}</div></section>`
            : ""
        }
        <dialog id="investment-dialog"><form id="investment-form">
          <input type="hidden" name="id">
          <div class="dialog-head"><div><p class="eyebrow">INVESTMENT OR SAVING</p><h2 id="investment-form-title">Add entry</h2></div><button type="button" class="icon investment-close" aria-label="Close">×</button></div>
          <div class="form-grid"><label>Date<input name="date" type="date" required></label><label>Account / provider<input name="provider" maxlength="80" placeholder="Trading 212" required></label></div>
          <label>Investment or saving<input name="asset" maxlength="100" placeholder="Global index fund" required></label>
          <div class="form-grid"><label>Category<input name="category" list="investment-categories" maxlength="60" placeholder="Stocks ISA UK" required><datalist id="investment-categories"><option>Stock UK</option><option>Stocks ISA UK</option><option>SIP India</option><option>Cash ISA UK</option><option>Gold Physical</option><option>Stock India</option></datalist></label><label>Owner<select name="scope"><option value="personal">Personal</option><option value="business">Business</option></select></label></div>
          <div class="form-grid"><label>Amount invested<input name="invested" type="number" min="0.01" step="0.01" inputmode="decimal" required></label><label>Currency<select name="currency"><option value="GBP">GBP · Pound sterling</option><option value="EUR">EUR · Euro</option><option value="INR">INR · Indian rupee</option></select></label></div>
          <div class="form-grid"><label>Current value <small>Optional; enter it when you update a valuation.</small><input name="currentValue" type="number" min="0" step="0.01" inputmode="decimal"></label><label>Contribution frequency<input name="frequency" list="investment-frequencies" maxlength="40" value="One time" placeholder="Every 15 days" required><datalist id="investment-frequencies"><option>One time</option><option>Weekly</option><option>Every 15 days</option><option>Monthly</option><option>Quarterly</option><option>Yearly</option><option>Stopped</option></datalist></label></div>
          <p class="form-note">Totals stay separate by currency. Current values are entered by you; the app does not fetch market prices.</p>
          <button class="primary full" id="investment-submit">Save entry</button>
        </form></dialog>
      </section>`;
    bind();
  };

  const investmentCard = (
    entry: InvestmentEntry,
  ) => `<article class="investment-card">
    <div class="investment-date">${escapeHtml(new Date(`${entry.date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))}</div>
    <div class="investment-card-main"><div class="investment-card-title"><h3>${escapeHtml(entry.asset)}</h3><span class="investment-category">${escapeHtml(entry.category)}</span></div><div class="investment-meta">${escapeHtml(entry.provider)} <span>·</span> ${entry.scope} <span>·</span> ${escapeHtml(entry.frequency)}</div></div>
    <div class="investment-amounts"><div><span>Invested</span><strong>${formatMoney(entry.investedMinor, entry.currency)}</strong></div><div><span>Current value</span><strong>${entry.currentValueMinor === null ? "—" : formatMoney(entry.currentValueMinor, entry.currency)}</strong></div></div>
    <div class="investment-actions"><button class="secondary edit-investment" data-id="${escapeHtml(entry.id)}">Edit</button><button class="secondary delete-investment" data-id="${escapeHtml(entry.id)}" aria-label="Delete ${escapeHtml(entry.asset)}">Delete</button></div>
  </article>`;

  const bind = () => {
    const dialog =
      container.querySelector<HTMLDialogElement>("#investment-dialog")!;
    const form = container.querySelector<HTMLFormElement>("#investment-form")!;
    const openNew = () => {
      form.reset();
      (form.elements.namedItem("id") as HTMLInputElement).value = "";
      (form.elements.namedItem("date") as HTMLInputElement).value = today();
      (form.elements.namedItem("frequency") as HTMLInputElement).value =
        "One time";
      container.querySelector("#investment-form-title")!.textContent =
        "Add entry";
      container.querySelector("#investment-submit")!.textContent = "Save entry";
      dialog.showModal();
    };
    container
      .querySelector("#add-investment")
      ?.addEventListener("click", openNew);
    container
      .querySelector(".investment-close")
      ?.addEventListener("click", () => dialog.close());

    container
      .querySelectorAll<HTMLButtonElement>(".edit-investment")
      .forEach((button) =>
        button.addEventListener("click", () => {
          const entry = entries.find(({ id }) => id === button.dataset.id);
          if (!entry) return;
          (form.elements.namedItem("id") as HTMLInputElement).value = entry.id;
          (form.elements.namedItem("date") as HTMLInputElement).value =
            entry.date;
          (form.elements.namedItem("provider") as HTMLInputElement).value =
            entry.provider;
          (form.elements.namedItem("asset") as HTMLInputElement).value =
            entry.asset;
          (form.elements.namedItem("category") as HTMLInputElement).value =
            entry.category;
          (form.elements.namedItem("scope") as HTMLSelectElement).value =
            entry.scope;
          (form.elements.namedItem("invested") as HTMLInputElement).value =
            fromMinorUnits(entry.investedMinor).toFixed(2);
          (form.elements.namedItem("currency") as HTMLSelectElement).value =
            entry.currency;
          (form.elements.namedItem("currentValue") as HTMLInputElement).value =
            entry.currentValueMinor === null
              ? ""
              : fromMinorUnits(entry.currentValueMinor).toFixed(2);
          (form.elements.namedItem("frequency") as HTMLInputElement).value =
            entry.frequency;
          container.querySelector("#investment-form-title")!.textContent =
            "Edit entry";
          container.querySelector("#investment-submit")!.textContent =
            "Save changes";
          dialog.showModal();
        }),
      );

    container
      .querySelectorAll<HTMLButtonElement>(".delete-investment")
      .forEach((button) =>
        button.addEventListener("click", () => {
          const entry = entries.find(({ id }) => id === button.dataset.id);
          if (!entry || !window.confirm(`Delete “${entry.asset}” entry?`))
            return;
          entries = entries.filter(({ id }) => id !== entry.id);
          localInvestmentRepository.save(entries);
          render();
        }),
      );

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const id = String(data.get("id") ?? "");
      const existing = entries.find((entry) => entry.id === id);
      const invested = Number(data.get("invested"));
      const currentValueText = String(data.get("currentValue") ?? "").trim();
      const currentValue =
        currentValueText === "" ? null : Number(currentValueText);
      if (
        !Number.isFinite(invested) ||
        invested <= 0 ||
        (currentValue !== null &&
          (!Number.isFinite(currentValue) || currentValue < 0))
      )
        return;
      const currencyValue = data.get("currency");
      const entry: InvestmentEntry = {
        id: existing?.id ?? uid(),
        date: String(data.get("date")),
        provider: String(data.get("provider")).trim(),
        asset: String(data.get("asset")).trim(),
        category: String(data.get("category")).trim(),
        currency: isCurrency(currencyValue) ? currencyValue : "GBP",
        investedMinor: toMinorUnits(invested),
        currentValueMinor:
          currentValue === null ? null : toMinorUnits(currentValue),
        frequency: String(data.get("frequency")).trim(),
        scope:
          data.get("scope") === "business"
            ? ("business" as InvestmentScope)
            : ("personal" as InvestmentScope),
      };
      entries = existing
        ? entries.map((item) => (item.id === id ? entry : item))
        : [...entries, entry];
      localInvestmentRepository.save(entries);
      render();
    });
  };

  render();
}
