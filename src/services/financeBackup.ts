import {
  isValidInvestmentEntry,
  type InvestmentEntry,
} from "../domain/investment";
import type { Loan } from "../domain/loan";

const FORMAT = "finance-tracker-backup";
const VERSION = 1;
const PBKDF2_ITERATIONS = 310_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

export interface FinanceBackup {
  format: typeof FORMAT;
  version: typeof VERSION;
  createdAt: string;
  loans: Loan[];
  investments: InvestmentEntry[];
}

interface EncryptedBackup {
  format: typeof FORMAT;
  version: typeof VERSION;
  algorithm: "AES-GCM-256/PBKDF2-SHA-256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(encoder.encode(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: toArrayBuffer(salt), iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptFinanceBackup(
  backup: FinanceBackup,
  passphrase: string,
): Promise<EncryptedBackup> {
  if (passphrase.length < 12) {
    throw new Error("Use a backup password of at least 12 characters.");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(encoder.encode(JSON.stringify(backup))),
  );
  return {
    format: FORMAT,
    version: VERSION,
    algorithm: "AES-GCM-256/PBKDF2-SHA-256",
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptFinanceBackup(
  value: unknown,
  passphrase: string,
): Promise<FinanceBackup> {
  if (!isEncryptedBackup(value)) {
    throw new Error("This file is not a supported Finance Tracker backup.");
  }
  const key = await deriveKey(
    passphrase,
    fromBase64(value.salt),
    value.iterations,
  );
  let decoded: string;
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(fromBase64(value.iv)) },
      key,
      toArrayBuffer(fromBase64(value.ciphertext)),
    );
    decoded = decoder.decode(plaintext);
  } catch {
    throw new Error("Could not decrypt this backup. Check the password.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    throw new Error("The decrypted backup data is invalid.");
  }
  if (!isFinanceBackup(parsed)) {
    throw new Error("The backup is incomplete or has an unsupported version.");
  }
  return parsed;
}

export function createFinanceBackup(
  loans: Loan[],
  investments: InvestmentEntry[],
  createdAt = new Date().toISOString(),
): FinanceBackup {
  return { format: FORMAT, version: VERSION, createdAt, loans, investments };
}

export function isFinanceBackup(value: unknown): value is FinanceBackup {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.format === FORMAT &&
    record.version === VERSION &&
    typeof record.createdAt === "string" &&
    !Number.isNaN(Date.parse(record.createdAt)) &&
    Array.isArray(record.loans) &&
    record.loans.every(isLoan) &&
    Array.isArray(record.investments) &&
    record.investments.every(isValidInvestmentEntry)
  );
}

function isLoan(value: unknown): value is Loan {
  if (!value || typeof value !== "object") return false;
  const loan = value as Record<string, unknown>;
  return (
    typeof loan.id === "string" &&
    typeof loan.name === "string" &&
    (loan.scope === "personal" || loan.scope === "business") &&
    (loan.currency === "GBP" ||
      loan.currency === "EUR" ||
      loan.currency === "INR") &&
    typeof loan.archived === "boolean" &&
    [
      loan.originalBalanceMinor,
      loan.currentBalanceMinor,
      loan.annualInterestRateBps,
      loan.monthlyPaymentMinor,
      loan.monthlyOverpaymentMinor,
    ].every(
      (number) => Number.isSafeInteger(number) && (number as number) >= 0,
    ) &&
    typeof loan.nextPaymentDate === "string" &&
    Array.isArray(loan.directRepayments) &&
    loan.directRepayments.every(
      (repayment) =>
        !!repayment &&
        typeof repayment.id === "string" &&
        Number.isSafeInteger(repayment.amountMinor) &&
        repayment.amountMinor > 0 &&
        typeof repayment.date === "string",
    )
  );
}

function isEncryptedBackup(value: unknown): value is EncryptedBackup {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.format === FORMAT &&
    record.version === VERSION &&
    record.algorithm === "AES-GCM-256/PBKDF2-SHA-256" &&
    Number.isSafeInteger(record.iterations) &&
    (record.iterations as number) >= 100_000 &&
    (record.iterations as number) <= 1_000_000 &&
    [record.salt, record.iv, record.ciphertext].every(
      (part) => typeof part === "string" && part.length > 0,
    )
  );
}
