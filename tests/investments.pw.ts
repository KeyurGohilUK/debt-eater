import { expect, test } from "@playwright/test";

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
