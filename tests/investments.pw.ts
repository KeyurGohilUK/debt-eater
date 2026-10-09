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
  await page.getByRole("link", { name: "Investments & savings" }).click();
  await expect(page.getByText("Spot prices updated")).toBeVisible();
  await page.getByRole("button", { name: "+ Add entry" }).click();
  await page.getByLabel("Account / provider").fill("Bullion dealer");
  await page.getByLabel("Investment or saving").fill("Two Britannias");
  await page.getByLabel("Category").fill("Gold Physical");
  await page.getByLabel("Amount invested").fill("4000");
  await page.getByLabel("Valuation").selectOption("gold");
  await page.getByLabel("Quantity").fill("2");
  await page.getByLabel("Weight per item").fill("1");
  await page.getByLabel("Purity / fineness").fill("999.9");
  await page.getByRole("button", { name: "Save entry" }).click();

  await expect(page.getByText("Est. metal value")).toBeVisible();
  await expect(page.getByText("£4,499.55").first()).toBeVisible();
  await expect(page.getByText(/gold · 2 × 1 toz · 999.9 fine/)).toBeVisible();
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
