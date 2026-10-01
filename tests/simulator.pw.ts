import { expect, test } from "@playwright/test";

test("compares a repayment scenario without saving changes", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Add existing debt" }).click();
  await page.locator('#loan-form input[name="name"]').fill("Home mortgage");
  await page.locator('#loan-form input[name="original"]').fill("100000");
  await page.locator('#loan-form input[name="balance"]').fill("90000");
  await page.locator('#loan-form input[name="rate"]').fill("4.9");
  await page.locator('#loan-form input[name="emi"]').fill("1000");
  await page
    .locator('#loan-form input[name="nextPaymentDate"]')
    .fill("2026-10-15");
  await page.getByRole("button", { name: "Save debt" }).click();

  const savedDebt = await page.evaluate(() =>
    localStorage.getItem("debt-eater.loans.v2"),
  );
  await page.getByRole("button", { name: "Simulate repayments" }).click();
  await expect(page.locator(".loan-card .metrics")).toContainText(
    /\(\d+ months\)/,
  );

  const dialog = page.getByRole("dialog", { name: "Repayment simulator" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Extra each month").fill("300");
  await dialog.getByLabel("One-off repayment now").fill("5000");

  await expect(dialog.locator(".simulator-comparison")).toContainText(
    "Current plan",
  );
  await expect(dialog.locator(".simulator-comparison")).toContainText(
    "With scenario",
  );
  await expect(dialog.locator(".simulator-savings")).not.toContainText("—");
  await expect(dialog.locator(".simulator-savings")).toContainText(
    /\(\d+ months\)/,
  );
  await expect(dialog.locator(".scenario-line")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("debt-eater.loans.v2")),
  ).toBe(savedDebt);
});
