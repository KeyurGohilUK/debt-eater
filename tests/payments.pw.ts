import { expect, test } from "@playwright/test";

test("projects from the direct debit schedule and logs only extra repayments", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("link", { name: "Debt Eater" }).click();
  await page.getByRole("button", { name: "Add existing debt" }).click();
  await page.locator('#loan-form input[name="name"]').fill("Home mortgage");
  await page.locator('#loan-form input[name="original"]').fill("100000");
  await page.locator('#loan-form input[name="balance"]').fill("90000");
  await page.locator('#loan-form input[name="rate"]').fill("4.9");
  await page.locator('#loan-form input[name="emi"]').fill("1000");
  await page
    .locator('#loan-form input[name="nextPaymentDate"]')
    .fill("2026-10-15");
  await page.locator('#loan-form input[name="monthlyOverpayment"]').fill("200");
  await page.getByRole("button", { name: "Save debt" }).click();

  await expect(page.locator(".metrics")).toContainText("Planned monthly extra");
  await expect(page.locator(".metrics")).toContainText("£200.00");
  await expect(page.locator(".metrics")).toContainText("Payoff");
  await expect(
    page.getByRole("button", { name: /Record monthly payment/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(
    page.locator('#loan-form input[name="nextPaymentDate"]'),
  ).toHaveValue("2026-10-15");
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: /Direct repayment/ }).click();
  await page.locator('#repayment-form input[name="amount"]').fill("100");
  await page.getByRole("button", { name: "Apply repayment" }).click();
  await expect(page.locator(".balance strong")).toHaveText("£89,900.00");
  await expect(page.locator(".payment-history summary")).toHaveText(
    "Payment history (1)",
  );
  await page.reload();
  await expect(page.locator(".balance strong")).toHaveText("£89,900.00");
  await expect(page.locator(".payment-history summary")).toHaveText(
    "Payment history (1)",
  );
});
