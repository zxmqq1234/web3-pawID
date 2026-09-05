import { cloneSeedState } from '../domain/seed';
import type { DemoState } from '../domain/types';

/** 演示状态的本地持久化命名空间。 */
export const DEMO_STORAGE_KEY = 'pawid_demo_v1';

/** 将当前状态写入结构化 JSON；浏览器存储不可用时静默保留内存状态。 */
export function saveDemoState(state: DemoState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 无痕模式或配额不足时，页面仍可继续使用内存状态。
  }
}

/** 读取并校验状态的最小结构，异常内容回退到不可变种子。 */
export function loadDemoState(): DemoState {
  if (typeof window === 'undefined') return cloneSeedState();
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return cloneSeedState();
    const parsed: unknown = JSON.parse(raw);
    if (isDemoState(parsed)) return parsed;
  } catch {
    // 损坏的本地数据使用种子恢复，不阻塞应用启动。
  }
  return cloneSeedState();
}

/** 清理 PawID 自有状态键，不影响其他网站或应用数据。 */
export function clearStoredDemoState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DEMO_STORAGE_KEY);
  } catch {
    // 存储不可用时无需额外处理。
  }
}

/** 监听 storage 事件时使用的窄校验，避免把其他 JSON 当作业务状态。 */
export function isDemoState(value: unknown): value is DemoState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DemoState>;
  return Array.isArray(candidate.pets)
    && Array.isArray(candidate.users)
    && Array.isArray(candidate.guardianLinks)
    && Array.isArray(candidate.invites)
    && Array.isArray(candidate.relations)
    && Array.isArray(candidate.lifeEvents)
    && Array.isArray(candidate.credentials)
    && Array.isArray(candidate.pointEntries)
    && Array.isArray(candidate.inventoryItems)
    && Array.isArray(candidate.badges)
    && Array.isArray(candidate.lostCases)
    && Array.isArray(candidate.foundReports)
    && Array.isArray(candidate.serviceInterests)
    && (candidate.currentRole === 'owner' || candidate.currentRole === 'invitee' || candidate.currentRole === 'visitor')
    && typeof candidate.failNext === 'boolean'
    && Array.isArray(candidate.processedOperationKeys);
}

/** IndexedDB 图片数据库名称与对象仓库名称。 */
export const IMAGE_DB_NAME = 'pawid-demo-images';
export const IMAGE_STORE_NAME = 'images';

/** 打开图片数据库，并在首次使用时创建图片对象仓库。 */
function openImageDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('当前浏览器不支持 IndexedDB 图片存储'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB_NAME, 1);
    request.onerror = () => reject(request.error ?? new Error('图片数据库打开失败'));
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        request.result.createObjectStore(IMAGE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

/** 在 IndexedDB 中保存用户图片 Blob；失败时抛出可被页面展示的错误。 */
export async function saveImage(photoKey: string, blob: Blob): Promise<void> {
  const database = await openImageDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(IMAGE_STORE_NAME, 'readwrite');
      const request = transaction.objectStore(IMAGE_STORE_NAME).put(blob, photoKey);
      request.onerror = () => reject(request.error ?? new Error('图片保存失败'));
      request.onsuccess = () => resolve();
    });
  } finally {
    database.close();
  }
}

/** 读取图片 Blob；不存在时返回 null 供页面降级到示例形象。 */
export async function getImage(photoKey: string): Promise<Blob | null> {
  const database = await openImageDatabase();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const request = database.transaction(IMAGE_STORE_NAME, 'readonly').objectStore(IMAGE_STORE_NAME).get(photoKey);
      request.onerror = () => reject(request.error ?? new Error('图片读取失败'));
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    });
  } finally {
    database.close();
  }
}

/** 删除单张图片，供替换照片时使用。 */
export async function deleteImage(photoKey: string): Promise<void> {
  const database = await openImageDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(IMAGE_STORE_NAME, 'readwrite').objectStore(IMAGE_STORE_NAME).delete(photoKey);
      request.onerror = () => reject(request.error ?? new Error('图片删除失败'));
      request.onsuccess = () => resolve();
    });
  } finally {
    database.close();
  }
}

/** 仅清理 PawID 图片数据库，绝不删除其他 IndexedDB 数据库。 */
export async function clearImageStore(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(IMAGE_DB_NAME);
    request.onerror = () => reject(request.error ?? new Error('图片数据库清理失败'));
    request.onsuccess = () => resolve();
    request.onblocked = () => reject(new Error('图片数据库正在被其他标签页使用'));
  });
}
