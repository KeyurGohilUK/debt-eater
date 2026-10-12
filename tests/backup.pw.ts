import { expect, test } from "@playwright/test";

test("backup settings explain private encrypted Google Drive storage", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Backup" }).click();
  await expect(
    page.getByRole("heading", { name: "Back up your finances" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /encrypted copy of debts, repayments, investments and metal holdings/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Back up now" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Restore latest backup" }),
  ).toBeDisabled();
  await expect(page.getByText(/Google Drive setup is required/)).toBeVisible();
});
