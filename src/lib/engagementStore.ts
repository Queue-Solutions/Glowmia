import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export type StoredDesignFeedback = {
  id: string;
  designId: string;
  author: string;
  message: string;
  rating: number;
  createdAt: string;
};

export type StoredAgentFeedback = {
  id: string;
  sessionId: string | null;
  language: 'en' | 'ar';
  rating: number;
  message: string;
  createdAt: string;
};

type LikeState = {
  liked: boolean;
  updatedAt: string;
};

type EngagementStore = {
  designLikes: Record<string, Record<string, LikeState>>;
  designFeedback: StoredDesignFeedback[];
  agentFeedback: StoredAgentFeedback[];
};

const STORE_DIR = path.join(process.cwd(), '.runtime');
const STORE_PATH = path.join(STORE_DIR, 'glowmia-engagement.json');

const emptyStore: EngagementStore = {
  designLikes: {},
  designFeedback: [],
  agentFeedback: [],
};

let writeQueue = Promise.resolve();

async function ensureStorePath() {
  await mkdir(STORE_DIR, { recursive: true });
}

async function readStore(): Promise<EngagementStore> {
  await ensureStorePath();

  try {
    const raw = await readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<EngagementStore>;

    return {
      designLikes: parsed.designLikes ?? {},
      designFeedback: Array.isArray(parsed.designFeedback) ? parsed.designFeedback : [],
      agentFeedback: Array.isArray(parsed.agentFeedback) ? parsed.agentFeedback : [],
    };
  } catch {
    return emptyStore;
  }
}

async function writeStore(store: EngagementStore) {
  await ensureStorePath();
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

async function updateStore<T>(updater: (store: EngagementStore) => T | Promise<T>) {
  const resultPromise = writeQueue.then(async () => {
    const store = await readStore();
    const result = await updater(store);
    await writeStore(store);
    return result;
  });

  writeQueue = resultPromise.then(() => undefined, () => undefined);
  return resultPromise;
}

export async function listDesignFeedback(designId: string) {
  const store = await readStore();
  return store.designFeedback
    .filter((entry) => entry.designId === designId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function addDesignFeedback(entry: Omit<StoredDesignFeedback, 'id' | 'createdAt'>) {
  return updateStore((store) => {
    const nextEntry: StoredDesignFeedback = {
      id: `design-feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      designId: entry.designId,
      author: entry.author.trim() || 'Anonymous',
      message: entry.message.trim(),
      rating: Math.max(1, Math.min(5, Math.round(entry.rating))),
      createdAt: new Date().toISOString(),
    };

    store.designFeedback.unshift(nextEntry);
    return nextEntry;
  });
}

export async function setDesignLike(input: { designId: string; clientId: string; liked: boolean }) {
  return updateStore((store) => {
    const designBucket = store.designLikes[input.designId] ?? {};

    if (input.liked) {
      designBucket[input.clientId] = {
        liked: true,
        updatedAt: new Date().toISOString(),
      };
      store.designLikes[input.designId] = designBucket;
    } else {
      delete designBucket[input.clientId];

      if (Object.keys(designBucket).length === 0) {
        delete store.designLikes[input.designId];
      } else {
        store.designLikes[input.designId] = designBucket;
      }
    }

    return Object.keys(store.designLikes[input.designId] ?? {}).length;
  });
}

export async function addAgentFeedback(entry: Omit<StoredAgentFeedback, 'id' | 'createdAt'>) {
  return updateStore((store) => {
    const nextEntry: StoredAgentFeedback = {
      id: `agent-feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId: entry.sessionId || null,
      language: entry.language,
      rating: Math.max(1, Math.min(5, Math.round(entry.rating))),
      message: entry.message.trim(),
      createdAt: new Date().toISOString(),
    };

    store.agentFeedback.unshift(nextEntry);
    return nextEntry;
  });
}

export async function getEngagementInsights() {
  const store = await readStore();

  const designLikes = Object.entries(store.designLikes)
    .map(([designId, likes]) => ({
      designId,
      count: Object.keys(likes).length,
      updatedAt:
        Object.values(likes)
          .map((entry) => entry.updatedAt)
          .sort()
          .at(-1) ?? null,
    }))
    .sort((left, right) => right.count - left.count || (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''));

  const totalLikes = designLikes.reduce((sum, entry) => sum + entry.count, 0);
  const designRatings = store.designFeedback.map((entry) => entry.rating);
  const agentRatings = store.agentFeedback.map((entry) => entry.rating);

  return {
    designLikes,
    designFeedback: store.designFeedback.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    agentFeedback: store.agentFeedback.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    totals: {
      totalLikes,
      designFeedbackCount: store.designFeedback.length,
      agentFeedbackCount: store.agentFeedback.length,
      averageDesignRating:
        designRatings.length > 0 ? designRatings.reduce((sum, value) => sum + value, 0) / designRatings.length : 0,
      averageAgentRating:
        agentRatings.length > 0 ? agentRatings.reduce((sum, value) => sum + value, 0) / agentRatings.length : 0,
    },
  };
}
