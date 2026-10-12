import type { FinanceBackup } from "./financeBackup";

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface GoogleIdentityServices {
  oauth2: {
    initTokenClient(options: {
      client_id: string;
      scope: string;
      callback: (response: GoogleTokenResponse) => void;
      error_callback?: (error: { message?: string }) => void;
    }): GoogleTokenClient;
  };
}

declare global {
  interface Window {
    google?: { accounts?: GoogleIdentityServices };
  }
}

interface DriveFile {
  id: string;
  name: string;
  createdTime: string;
}

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const TOKEN_SCRIPT = "https://accounts.google.com/gsi/client";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

function loadGoogleIdentityServices(): Promise<GoogleIdentityServices> {
  if (window.google?.accounts) return Promise.resolve(window.google.accounts);
  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${TOKEN_SCRIPT}"]`,
    );
    if (!script) {
      script = document.createElement("script");
      script.src = TOKEN_SCRIPT;
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
    const timeout = window.setTimeout(
      () =>
        reject(
          new Error(
            "Google sign-in did not load. Check your connection and try again.",
          ),
        ),
      15_000,
    );
    script.addEventListener(
      "load",
      () => {
        window.clearTimeout(timeout);
        if (window.google?.accounts) resolve(window.google.accounts);
        else reject(new Error("Google sign-in could not be initialized."));
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => {
        window.clearTimeout(timeout);
        reject(new Error("Google sign-in could not be loaded."));
      },
      { once: true },
    );
  });
}

async function requestAccessToken(): Promise<string> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error(
      "Google Drive backup is not configured for this deployment yet.",
    );
  }
  const identity = await loadGoogleIdentityServices();
  return new Promise((resolve, reject) => {
    const tokenClient = identity.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.appdata",
      callback: (response) => {
        if (response.access_token) resolve(response.access_token);
        else
          reject(
            new Error(
              response.error_description ??
                response.error ??
                "Google sign-in was cancelled.",
            ),
          );
      },
      error_callback: (error) =>
        reject(new Error(error.message ?? "Google sign-in was cancelled.")),
    });
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

async function driveRequest(
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Google Drive request failed (${response.status}). ${message.slice(0, 240)}`,
    );
  }
  return response;
}

export const googleDriveBackup = {
  isConfigured: Boolean(GOOGLE_CLIENT_ID),

  async save(encryptedBackup: unknown, backup: FinanceBackup): Promise<void> {
    const token = await requestAccessToken();
    const form = new FormData();
    const stamp = backup.createdAt.replace(/[:.]/g, "-");
    const metadata = {
      name: `finance-tracker-backup-${stamp}.json`,
      mimeType: "application/json",
      parents: ["appDataFolder"],
    };
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" }),
    );
    form.append(
      "file",
      new Blob([JSON.stringify(encryptedBackup)], { type: "application/json" }),
    );
    await driveRequest(
      token,
      `${DRIVE_API.replace("/drive/v3", "/upload/drive/v3")}/files?uploadType=multipart&fields=id`,
      { method: "POST", body: form },
    );
  },

  async readLatest(): Promise<unknown> {
    const token = await requestAccessToken();
    const query = new URLSearchParams({
      spaces: "appDataFolder",
      q: "'appDataFolder' in parents and trashed = false",
      orderBy: "createdTime desc",
      pageSize: "1",
      fields: "files(id,name,createdTime)",
    });
    const response = await driveRequest(token, `${DRIVE_API}/files?${query}`);
    const result = (await response.json()) as { files?: DriveFile[] };
    const latest = result.files?.[0];
    if (!latest)
      throw new Error(
        "No Finance Tracker backup was found in this Google Drive.",
      );
    const content = await driveRequest(
      token,
      `${DRIVE_API}/files/${encodeURIComponent(latest.id)}?alt=media`,
    );
    return content.json();
  },
};
