import { expect, test } from "@playwright/test";

test("automatically values bullion from spot price and fine weight", async ({
  page,
}) => {
  await page.route("https://api.gold-api.com/price/*", async (route) => {
    await route.fulfill({
      json: { price: route.request().url().endsWith("XAU") ? 3000 : 30 },
    });
  });
  await page.route(
    "https://api.frankfurter.dev/v2/rate/usd/*",
    async (route) => {
      const currency = route.request().url().split("/").at(-1);
      await route.fulfill({
        json: {
          rate: currency === "gbp" ? 0.75 : currency === "eur" ? 0.9 : 83,
        },
      });
    },
  );

  await page.goto("/");
  await page.getByRole("link", { name: "Commodities" }).click();
  await expect(page.getByText("Spot prices updated")).toBeVisible();
  await page.getByRole("button", { name: "+ Add metal" }).click();
  await expect(
    page.locator('#investment-form select[name="valuationMethod"]'),
  ).toHaveValue("gold");
  await page.getByLabel("Account / provider").fill("Bullion dealer");
  await page.getByLabel("Investment or saving").fill("Two Britannias");
  await page.getByLabel("Category").fill("Gold Physical");
  await page.getByLabel("Amount invested").fill("4000");
  await page.getByLabel("Quantity").fill("2");
  await page.getByLabel("Weight per item").fill("1");
  await page.getByLabel("Purity / fineness").fill("999.9");
  await page.getByRole("button", { name: "Save metal" }).click();

  await expect(page.getByText("CURRENT VALUE", { exact: true })).toBeVisible();
  await expect(page.getByText("£4,499.55").first()).toBeVisible();
  await expect(
    page.getByLabel("Commodity portfolio totals").getByText("+£499.55 +12.49%"),
  ).toBeVisible();
  await expect(
    page.getByLabel("Commodity portfolio totals").getByText("Invested"),
  ).toBeVisible();
  await expect(
    page.getByLabel("Commodity portfolio totals").getByText("Gain / loss"),
  ).toBeVisible();
  await expect(page.getByText("Gold held")).toBeVisible();
  await expect(page.getByText("2 oz", { exact: true })).toBeVisible();
  await expect(page.getByText(/gold · 2 × 1 toz · 999.9 fine/)).toBeVisible();

  const entryCard = page.getByRole("button", { name: "Edit Two Britannias" });
  await entryCard.focus();
  await entryCard.press("Enter");
  await expect(page.getByRole("heading", { name: "Edit entry" })).toBeVisible();
  const deleteButton = page.getByRole("button", { name: "Delete entry" });
  await expect(deleteButton).toBeVisible();
  page.once("dialog", (confirmation) => confirmation.accept());
  await deleteButton.click();
  await expect(entryCard).toBeHidden();
});

test("commodities and investments use separate views over the same ledger", async ({
  page,
}) => {
  await page.goto("/#/commodities");
  await expect(
    page.getByRole("heading", { name: "Commodities" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "+ Add metal" }).click();
  await page.getByLabel("Account / provider").fill("Digital vault");
  await page.getByLabel("Investment or saving").fill("Silver balance");
  await page.getByLabel("Category").fill("Silver Digital");
  await page.getByLabel("Amount invested").fill("50");
  await page
    .locator('#investment-form select[name="valuationMethod"]')
    .selectOption("silver");
  await page.getByLabel("Quantity").fill("5");
  await page.getByLabel("Weight per item").fill("10");
  await page
    .locator("#investment-form")
    .getByRole("button", { name: "Save metal" })
    .click();
  await expect(page.getByText("Silver balance")).toBeVisible();
  await expect(page.getByText("1.608 oz", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Investments & savings" }).click();
  await expect(page.getByText("Silver balance")).toHaveCount(0);
  await page.getByRole("link", { name: "Commodities" }).click();
  await expect(page.getByText("Silver balance")).toBeVisible();
});

test("date field stays within the investment dialog on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("link", { name: "Investments & savings" }).click();
  await page.getByRole("button", { name: "+ Add entry" }).click();

  const dateInput = page.locator('#investment-dialog input[name="date"]');
  const dateBounds = await dateInput.boundingBox();
  const formBounds = await page
    .locator("#investment-dialog form")
    .boundingBox();
  const formPaddingRight = await page
    .locator("#investment-dialog form")
    .evaluate((form) => parseFloat(getComputedStyle(form).paddingRight));

  expect(dateBounds).not.toBeNull();
  expect(formBounds).not.toBeNull();
  expect(dateBounds!.x).toBeGreaterThanOrEqual(formBounds!.x);
  expect(dateBounds!.x + dateBounds!.width).toBeLessThanOrEqual(
    formBounds!.x + formBounds!.width - formPaddingRight + 1,
  );
});

test("records investment entries and keeps currency totals separate", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "One clear view of your money" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Investments & savings" }).click();
  await expect(
    page.getByRole("heading", { name: "Investments & savings" }),
  ).toBeVisible();
  expect(
    await page
      .locator(
        '#investment-form select[name="valuationMethod"] option[value="gold"]',
      )
      .evaluate((option) => (option as HTMLOptionElement).disabled),
  ).toBe(true);

  await page.getByRole("button", { name: "+ Add entry" }).click();
  await page.getByLabel("Account / provider").fill("Trading 212");
  await page.getByLabel("Investment or saving").fill("Stocks ISA");
  await page.getByLabel("Category").fill("Stocks ISA UK");
  await page.getByLabel("Amount invested").fill("2999.40");
  await page.getByLabel("Current value").fill("3100");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByText("£2,999.40").first()).toBeVisible();
  await expect(page.getByText("£3,100.00").first()).toBeVisible();

  await page.getByRole("button", { name: "+ Add entry" }).click();
  await page.getByLabel("Account / provider").fill("Amundi");
  await page.getByLabel("Investment or saving").fill("Employee shares");
  await page.getByLabel("Category").fill("Stock EU");
  await page.getByLabel("Amount invested").fill("1183.24");
  await page.getByLabel("Currency").selectOption("EUR");
  await page.getByRole("button", { name: "Save entry" }).click();

  await expect(page.getByText("€1,183.24").first()).toBeVisible();
  await expect(page.getByText("£2,999.40").first()).toBeVisible();
  await expect(page.getByText("Current value (0 valued)")).toBeVisible();
});
