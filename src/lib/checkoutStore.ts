import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export type StoredCheckoutCustomer = {
  name: string;
  phone: string;
  email: string;
  country: string;
};

export type StoredCheckoutItem = {
  designId: string;
  designName: string;
  slug: string;
  size: 'S' | 'M' | 'L';
  quantity: number;
  imageUrl: string;
};

export type StoredCheckoutNotifications = {
  email: 'sent' | 'skipped' | 'failed';
  whatsapp: 'sent' | 'skipped' | 'failed';
};

export type StoredCheckoutOrder = {
  id: string;
  customer: StoredCheckoutCustomer;
  items: StoredCheckoutItem[];
  notifications: StoredCheckoutNotifications;
  createdAt: string;
};

type CheckoutStore = {
  orders: StoredCheckoutOrder[];
};

const STORE_DIR = path.join(process.cwd(), '.runtime');
const STORE_PATH = path.join(STORE_DIR, 'glowmia-checkout-orders.json');

const emptyStore: CheckoutStore = {
  orders: [],
};

let writeQueue = Promise.resolve();

async function ensureStorePath() {
  await mkdir(STORE_DIR, { recursive: true });
}

async function readStore(): Promise<CheckoutStore> {
  await ensureStorePath();

  try {
    const raw = await readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<CheckoutStore>;

    return {
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
    };
  } catch {
    return emptyStore;
  }
}

async function writeStore(store: CheckoutStore) {
  await ensureStorePath();
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

async function updateStore<T>(updater: (store: CheckoutStore) => T | Promise<T>) {
  const resultPromise = writeQueue.then(async () => {
    const store = await readStore();
    const result = await updater(store);
    await writeStore(store);
    return result;
  });

  writeQueue = resultPromise.then(() => undefined, () => undefined);
  return resultPromise;
}

export async function addCheckoutOrder(entry: Omit<StoredCheckoutOrder, 'id' | 'createdAt'> & { id?: string }) {
  return updateStore((store) => {
    const nextOrder: StoredCheckoutOrder = {
      id: entry.id || `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      customer: entry.customer,
      items: entry.items,
      notifications: entry.notifications,
      createdAt: new Date().toISOString(),
    };

    store.orders.unshift(nextOrder);
    return nextOrder;
  });
}

export async function listCheckoutOrders() {
  const store = await readStore();
  return store.orders.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
