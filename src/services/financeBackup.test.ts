import { describe, expect, it } from "vitest";
import {
  createFinanceBackup,
  decryptFinanceBackup,
  encryptFinanceBackup,
  isFinanceBackup,
} from "./financeBackup";

describe("finance backup encryption", () => {
  const backup = createFinanceBackup([], [], "2026-10-12T09:00:00.000Z");

  it("encrypts and restores the complete backup payload", async () => {
    const encrypted = await encryptFinanceBackup(
      backup,
      "correct horse battery",
    );
    expect(JSON.stringify(encrypted)).not.toContain("2026-10-12");
    await expect(
      decryptFinanceBackup(encrypted, "correct horse battery"),
    ).resolves.toEqual(backup);
  });

  it("rejects a wrong password without returning data", async () => {
    const encrypted = await encryptFinanceBackup(
      backup,
      "correct horse battery",
    );
    await expect(
      decryptFinanceBackup(encrypted, "wrong password here"),
    ).rejects.toThrow("Check the password");
  });

  it("rejects unsupported or structurally incomplete backups", () => {
    expect(isFinanceBackup({ ...backup, version: 2 })).toBe(false);
    expect(isFinanceBackup({ ...backup, loans: [{ id: "bad" }] })).toBe(false);
  });

  it("requires a strong-enough passphrase", async () => {
    await expect(encryptFinanceBackup(backup, "short")).rejects.toThrow(
      "at least 12 characters",
    );
  });
});
