import {
  fromMinorUnits,
  formatMoney,
  isCurrency,
  toMinorUnits,
} from "../../domain/money";
import {
  resolveInvestmentValues,
  summarizeBullionTroyOunces,
  summarizeInvestments,
  type BullionHolding,
  type BullionMetal,
  type InvestmentEntry,
  type InvestmentScope,
} from "../../domain/investment";
import { localInvestmentRepository } from "../../repositories/investmentRepository";
import {
  metalPriceService,
  type MetalPriceResult,
} from "../../services/metalPriceService";
import { escapeHtml } from "../../shared/html";

const uid = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);
const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 }).format(value);
const formatGainPercent = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "percent",
    signDisplay: "exceptZero",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);

const britanniaImages = {
  gold: "https://www.royalmint.com/globalassets/_ecommerce/invest/launches/britannia-25/2025-britannia-gold-1oz-reverse-capsule---ukbgb251t-1500x1500-f3a2c67.jpg",
  silver:
    "https://www.royalmint.com/globalassets/_ecommerce/invest/launches/britannia-25/1oz-silver/2025-britannia-silver-1oz-reverse-capsule---ukbsb251t-1500x1500-f3a2c67.jpg",
} as const;

export type PortfolioMode = "investments" | "commodities";

export function mountInvestments(
  container: HTMLElement,
  mode: PortfolioMode = "investments",
): void {
  let entries = localInvestmentRepository.list();
  let priceResult: MetalPriceResult | null = null;
  let priceLoadComplete = false;
  let deferPriceRender = false;

  const metalPriceStatus = (): string => {
    if (!priceLoadComplete)
      return `<div class="metal-price-status" role="status"><span class="price-dot loading"></span><span>Updating gold and silver prices…</span></div>`;
    if (!priceResult)
      return `<div class="metal-price-status warning" role="status"><span class="price-dot"></span><span>Spot prices unavailable. Manual values are unchanged.</span></div>`;
    const { snapshot, stale } = priceResult;
    const updated = new Date(snapshot.fetchedAt).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `<div class="metal-price-status ${stale ? "warning" : ""}" role="status"><span class="price-dot"></span><span>${stale ? "Using last available prices" : "Spot prices updated"} ${escapeHtml(updated)} · Gold $${formatNumber(snapshot.usdPerTroyOunce.gold)} · Silver $${formatNumber(snapshot.usdPerTroyOunce.silver)} / troy oz</span></div>`;
  };

  const bullionDescription = (holding: BullionHolding): string =>
    `${holding.metal} · ${formatNumber(holding.quantity)} × ${formatNumber(holding.weightPerItem)} ${holding.weightUnit} · ${formatNumber(holding.purity)} fine · ${holding.holdingType}`;

  const investmentCard = (
    entry: InvestmentEntry,
    valuesById: ReadonlyMap<string, number>,
    isCommodity = false,
  ) => {
    const currentValue = valuesById.get(entry.id) ?? entry.currentValueMinor;
    const valueLabel = entry.bullion ? "Est. metal value" : "Current value";
    const bullionMeta = entry.bullion
      ? `<span>·</span> ${escapeHtml(bullionDescription(entry.bullion))}`
      : "";
    const gainMinor =
      currentValue === null ? null : currentValue - entry.investedMinor;
    const gainPercent =
      gainMinor === null ? null : (gainMinor / entry.investedMinor) * 100;
    if (isCommodity && entry.bullion) {
      const metal = entry.bullion.metal;
      const coinName = `${metal === "gold" ? "Gold" : "Silver"} Britannia bullion coin`;
      const weight = `${formatNumber(entry.bullion.quantity * entry.bullion.weightPerItem)} ${entry.bullion.weightUnit === "toz" ? "oz" : "g"}`;
      return `<article class="investment-card edit-investment commodity-card" data-id="${escapeHtml(entry.id)}" role="button" tabindex="0" aria-label="Edit ${escapeHtml(entry.asset)}">
        <img class="commodity-coin-image" src="${britanniaImages[metal]}" alt="${coinName}; photo from The Royal Mint" loading="lazy" decoding="async">
        <div class="commodity-card-main">
          <div class="commodity-card-meta"><span>${escapeHtml(new Date(`${entry.date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))}</span><span>${escapeHtml(entry.provider)}</span></div>
          <div class="investment-card-title"><h3>${escapeHtml(entry.asset)}</h3><span class="investment-category">${metal === "gold" ? "Gold" : "Silver"}</span></div>
          <div class="commodity-card-detail">${escapeHtml(weight)} · ${entry.bullion.holdingType} · ${formatNumber(entry.bullion.purity)} fine</div>
        </div>
        <div class="commodity-card-values">
          <div class="commodity-card-value"><span>Current value</span><strong>${currentValue === null ? "—" : formatMoney(currentValue, entry.currency)}</strong><small>Invested ${formatMoney(entry.investedMinor, entry.currency)}</small></div>
          <div class="commodity-card-gain ${gainMinor === null ? "" : gainMinor >= 0 ? "positive" : "negative"}"><span>Gain / loss</span><strong>${gainMinor === null ? "—" : `${gainMinor > 0 ? "+" : ""}${formatMoney(gainMinor, entry.currency)}`}</strong><small>${gainPercent === null ? "" : formatGainPercent(gainPercent)}</small></div>
        </div>
      </article>`;
    }
    return `<article class="investment-card edit-investment" data-id="${escapeHtml(entry.id)}" role="button" tabindex="0" aria-label="Edit ${escapeHtml(entry.asset)}">
      <div class="investment-date">${escapeHtml(new Date(`${entry.date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))}</div>
      <div class="investment-card-main"><div class="investment-card-title"><h3>${escapeHtml(entry.asset)}</h3><span class="investment-category">${escapeHtml(entry.category)}</span></div><div class="investment-meta">${escapeHtml(entry.provider)} <span>·</span> ${entry.scope} <span>·</span> ${escapeHtml(entry.frequency)} ${bullionMeta}</div></div>
      <div class="investment-amounts"><div><span>Invested</span><strong>${formatMoney(entry.investedMinor, entry.currency)}</strong></div><div><span>${valueLabel}</span><strong>${currentValue === null ? "—" : formatMoney(currentValue, entry.currency)}</strong></div>${gainMinor === null || gainPercent === null ? "" : `<div class="investment-entry-change ${gainMinor >= 0 ? "positive" : "negative"}"><span>Gain / loss</span><strong>${gainMinor > 0 ? "+" : ""}${formatMoney(gainMinor, entry.currency)} <small>${formatGainPercent(gainPercent)}</small></strong></div>`}</div>
    </article>`;
  };

  const render = () => {
    const valuesById = resolveInvestmentValues(
      entries,
      priceResult?.snapshot ?? null,
    );
    const visibleEntries = entries.filter((entry) =>
      mode === "commodities" ? Boolean(entry.bullion) : !entry.bullion,
    );
    const isCommodities = mode === "commodities";
    const summaries = summarizeInvestments(visibleEntries, valuesById);
    const weights = summarizeBullionTroyOunces(visibleEntries);
    container.innerHTML = `
      <section class="investment-page ${isCommodities ? "commodity-page" : ""}" aria-labelledby="investments-title">
        <div class="investment-heading">
          <div><p class="eyebrow">${isCommodities ? "PRECIOUS METALS" : "PORTFOLIO"}</p><h1 id="investments-title">${isCommodities ? "Commodities" : "Investments &amp; savings"}</h1><p class="investment-subtitle">${isCommodities ? "Gold and silver holdings, valued against current spot prices." : "A clear view of what you’ve put aside, across accounts and currencies."}</p></div>
          <button class="primary" id="add-investment">${isCommodities ? "+ Add metal" : "+ Add entry"}</button>
        </div>
        ${isCommodities ? metalPriceStatus() : ""}
        ${isCommodities ? `<section class="commodity-weights" aria-label="Metal quantities"><article><span>Gold held <small>Troy ounces</small></span><strong aria-label="Total gold in troy ounces">${formatNumber(weights.goldTroyOunces)} oz</strong></article><article><span>Silver held <small>Troy ounces</small></span><strong aria-label="Total silver in troy ounces">${formatNumber(weights.silverTroyOunces)} oz</strong></article></section>` : ""}
        <div class="investment-summary ${isCommodities ? "commodity-summary" : ""}" aria-label="${isCommodities ? "Commodity portfolio totals" : "Investment totals"}">
          ${
            summaries.length
              ? summaries
                  .map(
                    (summary) => `<article class="investment-total">
            <div class="investment-total-head"><span>${summary.currency}</span><span>${summary.entryCount} entr${summary.entryCount === 1 ? "y" : "ies"}</span></div>
            ${isCommodities ? `<div class="commodity-current-label">CURRENT VALUE</div><strong class="commodity-current-value">${summary.valuedEntryCount ? formatMoney(summary.currentValueMinor, summary.currency) : "—"}</strong>` : ""}
            ${
              isCommodities
                ? `<div class="commodity-performance">
              <div><span>Invested</span><strong>${formatMoney(summary.investedMinor, summary.currency)}</strong></div>
              <div class="commodity-gain ${summary.valuedEntryCount ? (summary.gainMinor >= 0 ? "positive" : "negative") : ""}"><span>Gain / loss</span><strong>${summary.valuedEntryCount ? `${summary.gainMinor > 0 ? "+" : ""}${formatMoney(summary.gainMinor, summary.currency)} <small>${formatGainPercent(summary.gainPercent)}</small>` : "—"}</strong></div>
            </div>`
                : `<div class="investment-total-row"><span>Invested</span><strong>${formatMoney(summary.investedMinor, summary.currency)}</strong></div>`
            }
            ${!isCommodities ? `<div class="investment-total-row"><span>Current value <small>(${summary.valuedEntryCount} valued)</small></span><strong>${summary.valuedEntryCount ? formatMoney(summary.currentValueMinor, summary.currency) : "—"}</strong></div>` : ""}
            ${!isCommodities && summary.valuedEntryCount ? `<div class="investment-change ${summary.gainMinor >= 0 ? "positive" : "negative"}"><span>Change on valued entries</span><strong>${summary.gainMinor > 0 ? "+" : ""}${formatMoney(summary.gainMinor, summary.currency)} <small>${formatGainPercent(summary.gainPercent)}</small></strong></div>` : ""}
          </article>`,
                  )
                  .join("")
              : `<div class="investment-empty-summary"><span class="empty-icon" aria-hidden="true">↗</span><strong>Your portfolio starts here</strong><span>Add your first investment or savings entry.</span></div>`
          }
        </div>
        ${
          visibleEntries.length
            ? `<section class="investment-ledger" aria-labelledby="ledger-title"><div class="section-title"><div><p class="eyebrow">${isCommodities ? "HOLDINGS" : "ACTIVITY"}</p><h2 id="ledger-title">${isCommodities ? "Your metals" : "Your entries"}</h2></div><span>${visibleEntries.length} total</span></div><div class="investment-list">${[
                ...visibleEntries,
              ]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((entry) =>
                  investmentCard(entry, valuesById, isCommodities),
                )
                .join("")}</div></section>`
            : ""
        }
        <dialog id="investment-dialog"><form id="investment-form">
          <input type="hidden" name="id">
          <div class="dialog-head"><div><p class="eyebrow" id="investment-form-eyebrow">INVESTMENT OR SAVING</p><h2 id="investment-form-title">Add entry</h2></div><button type="button" class="icon investment-close" aria-label="Close">×</button></div>
          <div class="form-grid"><label>Date<input name="date" type="date" required></label><label>Account / provider<input name="provider" maxlength="80" placeholder="Trading 212" required></label></div>
          <label>Investment or saving<input name="asset" maxlength="100" placeholder="Global index fund" required></label>
          <div class="form-grid"><label>Category<input name="category" list="investment-categories" maxlength="60" placeholder="Stocks ISA UK" required><datalist id="investment-categories"><option>Stock UK</option><option>Stocks ISA UK</option><option>SIP India</option><option>Cash ISA UK</option><option>Gold Physical</option><option>Gold Digital</option><option>Silver Physical</option><option>Silver Digital</option><option>Stock India</option></datalist></label><label>Owner<select name="scope"><option value="personal">Personal</option><option value="business">Business</option></select></label></div>
          <div class="form-grid"><label>Amount invested<input name="invested" type="number" min="0.01" step="0.01" inputmode="decimal" required></label><label>Currency<select name="currency"><option value="GBP">GBP · Pound sterling</option><option value="EUR">EUR · Euro</option><option value="INR">INR · Indian rupee</option></select></label></div>
          <div class="form-grid"><label>Valuation<select name="valuationMethod"><option value="manual">Manual value</option><option value="gold">Gold spot price</option><option value="silver">Silver spot price</option></select></label><label>Contribution frequency<input name="frequency" list="investment-frequencies" maxlength="40" value="One time" placeholder="Every 15 days" required><datalist id="investment-frequencies"><option>One time</option><option>Weekly</option><option>Every 15 days</option><option>Monthly</option><option>Quarterly</option><option>Yearly</option><option>Stopped</option></datalist></label></div>
          <label class="manual-value-field">Current value <small>Optional; enter it when you update a valuation.</small><input name="currentValue" type="number" min="0" step="0.01" inputmode="decimal"></label>
          <fieldset class="bullion-fields" hidden>
            <legend>Bullion details</legend>
            <div class="form-grid"><label>Holding type<select name="holdingType"><option value="physical">Physical</option><option value="digital">Digital</option></select></label><label>Quantity<input name="quantity" type="number" min="0.000001" step="any" inputmode="decimal" value="1"></label></div>
            <div class="form-grid bullion-weight-grid"><label>Weight per item<input name="weightPerItem" type="number" min="0.000001" step="any" inputmode="decimal" value="1"></label><label>Weight unit<select name="weightUnit"><option value="toz">Troy ounce</option><option value="g">Gram</option></select></label><label>Purity / fineness<input name="purity" type="number" min="1" max="1000" step="0.1" inputmode="decimal" value="999.9"></label></div>
            <p class="form-note">Estimated metal value uses fine weight and the latest cached spot price. Dealer premiums, fees, VAT and resale spreads are excluded.</p>
          </fieldset>
          <p class="form-note">Totals remain separate by currency. Manual values are used for non-bullion assets.</p>
          <div class="investment-dialog-actions"><button type="button" class="secondary danger" id="delete-investment-dialog" hidden>Delete entry</button><button class="primary" id="investment-submit">Save entry</button></div>
        </form></dialog>
      </section>`;
    bind();
  };

  const readBullion = (data: FormData): BullionHolding | null => {
    const metal = data.get("valuationMethod");
    if (metal !== "gold" && metal !== "silver") return null;
    const quantity = Number(data.get("quantity"));
    const weightPerItem = Number(data.get("weightPerItem"));
    const purity = Number(data.get("purity"));
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(weightPerItem) ||
      weightPerItem <= 0 ||
      !Number.isFinite(purity) ||
      purity <= 0 ||
      purity > 1000
    )
      return null;
    return {
      metal: metal as BullionMetal,
      holdingType:
        data.get("holdingType") === "digital" ? "digital" : "physical",
      quantity,
      weightPerItem,
      weightUnit: data.get("weightUnit") === "g" ? "g" : "toz",
      purity,
    };
  };

  const bind = () => {
    const dialog =
      container.querySelector<HTMLDialogElement>("#investment-dialog")!;
    const form = container.querySelector<HTMLFormElement>("#investment-form")!;
    const valuationMethod = form.elements.namedItem(
      "valuationMethod",
    ) as HTMLSelectElement;
    valuationMethod
      .querySelectorAll<HTMLOptionElement>(
        'option[value="gold"], option[value="silver"]',
      )
      .forEach((option) => (option.disabled = mode !== "commodities"));
    const bullionFields =
      form.querySelector<HTMLFieldSetElement>(".bullion-fields")!;
    const manualValueField = form.querySelector<HTMLElement>(
      ".manual-value-field",
    )!;
    const currentValueInput = form.elements.namedItem(
      "currentValue",
    ) as HTMLInputElement;
    const deleteButton = form.querySelector<HTMLButtonElement>(
      "#delete-investment-dialog",
    )!;

    const syncValuationFields = () => {
      const isBullion = valuationMethod.value !== "manual";
      bullionFields.hidden = !isBullion;
      bullionFields.disabled = !isBullion;
      manualValueField.hidden = isBullion;
      currentValueInput.disabled = isBullion;
      bullionFields
        .querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select")
        .forEach((field) => (field.required = isBullion));
    };

    const setBullionForm = (holding?: BullionHolding) => {
      valuationMethod.value = holding?.metal ?? "manual";
      (form.elements.namedItem("holdingType") as HTMLSelectElement).value =
        holding?.holdingType ?? "physical";
      (form.elements.namedItem("quantity") as HTMLInputElement).value = String(
        holding?.quantity ?? 1,
      );
      (form.elements.namedItem("weightPerItem") as HTMLInputElement).value =
        String(holding?.weightPerItem ?? 1);
      (form.elements.namedItem("weightUnit") as HTMLSelectElement).value =
        holding?.weightUnit ?? "toz";
      (form.elements.namedItem("purity") as HTMLInputElement).value = String(
        holding?.purity ?? 999.9,
      );
      syncValuationFields();
    };

    const openNew = () => {
      form.reset();
      (form.elements.namedItem("id") as HTMLInputElement).value = "";
      (form.elements.namedItem("date") as HTMLInputElement).value = today();
      (form.elements.namedItem("frequency") as HTMLInputElement).value =
        "One time";
      setBullionForm();
      if (mode === "commodities") {
        valuationMethod.value = "gold";
        (form.elements.namedItem("category") as HTMLInputElement).value =
          "Gold Physical";
        (form.elements.namedItem("asset") as HTMLInputElement).value =
          "Gold holding";
        syncValuationFields();
      }
      container.querySelector("#investment-form-eyebrow")!.textContent =
        mode === "commodities" ? "PRECIOUS METAL" : "INVESTMENT OR SAVING";
      container.querySelector("#investment-form-title")!.textContent =
        "Add entry";
      container.querySelector("#investment-submit")!.textContent =
        mode === "commodities" ? "Save metal" : "Save entry";
      deleteButton.hidden = true;
      dialog.showModal();
    };
    valuationMethod.addEventListener("change", syncValuationFields);
    container
      .querySelector("#add-investment")
      ?.addEventListener("click", openNew);
    container
      .querySelector(".investment-close")
      ?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
      if (deferPriceRender) {
        deferPriceRender = false;
        render();
      }
    });

    const openEdit = (entry: InvestmentEntry) => {
      (form.elements.namedItem("id") as HTMLInputElement).value = entry.id;
      (form.elements.namedItem("date") as HTMLInputElement).value = entry.date;
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
      currentValueInput.value =
        entry.currentValueMinor === null
          ? ""
          : fromMinorUnits(entry.currentValueMinor).toFixed(2);
      (form.elements.namedItem("frequency") as HTMLInputElement).value =
        entry.frequency;
      setBullionForm(entry.bullion);
      container.querySelector("#investment-form-eyebrow")!.textContent =
        entry.bullion ? "PRECIOUS METAL" : "INVESTMENT OR SAVING";
      container.querySelector("#investment-form-title")!.textContent =
        "Edit entry";
      container.querySelector("#investment-submit")!.textContent =
        "Save changes";
      deleteButton.hidden = false;
      dialog.showModal();
    };

    container
      .querySelectorAll<HTMLElement>(".edit-investment")
      .forEach((card) => {
        const edit = () => {
          const entry = entries.find(({ id }) => id === card.dataset.id);
          if (entry) openEdit(entry);
        };
        card.addEventListener("click", edit);
        card.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          edit();
        });
      });

    deleteButton.addEventListener("click", () => {
      const id = (form.elements.namedItem("id") as HTMLInputElement).value;
      const entry = entries.find((item) => item.id === id);
      if (!entry || !window.confirm(`Delete “${entry.asset}” entry?`)) return;
      entries = entries.filter((item) => item.id !== id);
      localInvestmentRepository.save(entries);
      dialog.close();
      render();
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const id = String(data.get("id") ?? "");
      const existing = entries.find((entry) => entry.id === id);
      const invested = Number(data.get("invested"));
      const currentValueText = String(data.get("currentValue") ?? "").trim();
      const currentValue =
        currentValueText === "" ? null : Number(currentValueText);
      const bullion = readBullion(data);
      if (
        !Number.isFinite(invested) ||
        invested <= 0 ||
        (currentValue !== null &&
          (!Number.isFinite(currentValue) || currentValue < 0)) ||
        (valuationMethod.value !== "manual" && !bullion)
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
          bullion || currentValue === null ? null : toMinorUnits(currentValue),
        frequency: String(data.get("frequency")).trim(),
        scope:
          data.get("scope") === "business"
            ? ("business" as InvestmentScope)
            : ("personal" as InvestmentScope),
        ...(bullion ? { bullion } : {}),
      };
      entries = existing
        ? entries.map((item) => (item.id === id ? entry : item))
        : [...entries, entry];
      localInvestmentRepository.save(entries);
      render();
    });
  };

  render();
  void metalPriceService.load().then((result) => {
    priceResult = result;
    priceLoadComplete = true;
    const dialog =
      container.querySelector<HTMLDialogElement>("#investment-dialog");
    if (dialog?.open) deferPriceRender = true;
    else render();
  });
}
