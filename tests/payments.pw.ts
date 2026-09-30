import { expect, test } from "@playwright/test";

test("tracks a monthly overpayment and records the payment breakdown", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Add existing debt" }).click();
  await page.locator('#loan-form input[name="name"]').fill("Home mortgage");
  await page.locator('#loan-form input[name="original"]').fill("100000");
  await page.locator('#loan-form input[name="balance"]').fill("90000");
  await page.locator('#loan-form input[name="rate"]').fill("4.9");
  await page.locator('#loan-form input[name="emi"]').fill("1000");
  await page.locator('#loan-form input[name="monthlyOverpayment"]').fill("200");
  await page.getByRole("button", { name: "Save debt" }).click();

  await expect(page.locator(".metrics")).toContainText("Planned monthly extra");
  await expect(page.locator(".metrics")).toContainText("£200.00");
  await page.getByRole("button", { name: "Record monthly payment" }).click();

  const paymentDialog = page.locator("#repayment-dialog");
  await expect(paymentDialog).toBeVisible();
  await expect(paymentDialog.locator('input[name="amount"]')).toHaveValue(
    "1200.00",
  );
  await paymentDialog.locator('input[name="interest"]').fill("300");
  await paymentDialog.locator('input[name="overpayment"]').fill("200");
  await page.getByRole("button", { name: "Save payment" }).click();

  await expect(page.locator(".balance strong")).toHaveText("£89,100.00");
  const history = page.locator(".payment-history");
  await expect(history.locator("summary")).toHaveText("Payment history (1)");
  await history.locator("summary").click();
  await expect(history).toContainText("£1,200.00");
  await expect(history).toContainText("Principal £900.00");
  await expect(history).toContainText("Interest £300.00");
  await expect(history).toContainText("Extra £200.00");

  await page.reload();
  await expect(page.locator(".balance strong")).toHaveText("£89,100.00");
  await expect(page.locator(".payment-history summary")).toHaveText(
    "Payment history (1)",
  );

  await page.getByRole("button", { name: /Direct repayment/ }).click();
  await page.locator('#repayment-form input[name="amount"]').fill("100");
  await page.getByRole("button", { name: "Apply repayment" }).click();
  await expect(page.locator(".balance strong")).toHaveText("£89,000.00");
  await expect(page.locator(".payment-history summary")).toHaveText(
    "Payment history (2)",
  );
});
