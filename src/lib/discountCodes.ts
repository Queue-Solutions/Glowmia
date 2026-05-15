import { randomBytes } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export type DiscountCodeRecord = {
  code: string;
  percentage: number;
  createdAt: string;
  redeemedAt: string | null;
  redeemedOrderId: string | null;
  redeemedCustomerName: string | null;
};

type DiscountCodeStore = {
  codes: DiscountCodeRecord[];
};

const STORE_DIR = path.join(process.cwd(), '.runtime');
const STORE_PATH = path.join(STORE_DIR, 'glowmia-discount-codes.json');

const emptyStore: DiscountCodeStore = {
  codes: [],
};

let writeQueue = Promise.resolve();

async function ensureStorePath() {
  await mkdir(STORE_DIR, { recursive: true });
}

async function readStore(): Promise<DiscountCodeStore> {
  await ensureStorePath();

  try {
    const raw = await readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DiscountCodeStore>;

    return {
      codes: Array.isArray(parsed.codes) ? parsed.codes : [],
    };
  } catch {
    return emptyStore;
  }
}

async function writeStore(store: DiscountCodeStore) {
  await ensureStorePath();
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

async function updateStore<T>(updater: (store: DiscountCodeStore) => T | Promise<T>) {
  const resultPromise = writeQueue.then(async () => {
    const store = await readStore();
    const result = await updater(store);
    await writeStore(store);
    return result;
  });

  writeQueue = resultPromise.then(() => undefined, () => undefined);
  return resultPromise;
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function generateCodeValue() {
  return `GLOW${randomBytes(3).toString('hex').toUpperCase()}`;
}

export async function listDiscountCodes() {
  const store = await readStore();
  return [...store.codes].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createDiscountCode(percentage: number) {
  const normalizedPercentage = Math.max(1, Math.min(100, Math.round(percentage)));

  return updateStore((store) => {
    let code = generateCodeValue();
    const existingCodes = new Set(store.codes.map((entry) => entry.code));

    while (existingCodes.has(code)) {
      code = generateCodeValue();
    }

    const nextCode: DiscountCodeRecord = {
      code,
      percentage: normalizedPercentage,
      createdAt: new Date().toISOString(),
      redeemedAt: null,
      redeemedOrderId: null,
      redeemedCustomerName: null,
    };

    store.codes.unshift(nextCode);
    return nextCode;
  });
}

export async function validateDiscountCode(code: string) {
  const normalizedCode = normalizeCode(code);
  const store = await readStore();
  const discountCode = store.codes.find((entry) => entry.code === normalizedCode);

  if (!discountCode || discountCode.redeemedAt) {
    return null;
  }

  return discountCode;
}

export async function redeemDiscountCode(input: { code: string; orderId: string; customerName: string }) {
  const normalizedCode = normalizeCode(input.code);

  return updateStore((store) => {
    const discountCode = store.codes.find((entry) => entry.code === normalizedCode);

    if (!discountCode || discountCode.redeemedAt) {
      return null;
    }

    discountCode.redeemedAt = new Date().toISOString();
    discountCode.redeemedOrderId = input.orderId;
    discountCode.redeemedCustomerName = input.customerName.trim() || null;
    return discountCode;
  });
}
