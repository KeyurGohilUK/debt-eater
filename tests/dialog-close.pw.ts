import { expect, test } from "@playwright/test";

test("closes both dialogs on desktop and mobile viewports", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Add existing debt" }).click();

  const loanDialog = page.locator("#loan-dialog");
  await expect(loanDialog).toBeVisible();
  await expect(page.locator('#loan-form input[name="name"]')).toHaveCSS(
    "font-size",
    "16px",
  );
  await page.getByRole("button", { name: "Close" }).click();
  await expect(loanDialog).toBeHidden();

  await page.getByRole("button", { name: "Add existing debt" }).click();
  await page.locator('#loan-form input[name="name"]').fill("Home mortgage");
  await page.locator('#loan-form input[name="original"]').fill("100000");
  await page.locator('#loan-form input[name="balance"]').fill("90000");
  await page.locator('#loan-form input[name="rate"]').fill("4.9");
  await page.locator('#loan-form input[name="emi"]').fill("1000");
  await page.getByRole("button", { name: "Save debt" }).click();
  await expect(loanDialog).toBeHidden();

  await page.getByRole("button", { name: /Direct repayment/ }).click();
  const repaymentDialog = page.locator("#repayment-dialog");
  await expect(repaymentDialog).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(repaymentDialog).toBeHidden();
});
