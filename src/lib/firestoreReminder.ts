import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase.ts';
import {
  DEFAULT_REMINDER_SETTINGS,
  getBrowserTimezone,
  REMINDER_TIME_PATTERN,
  sanitizeReminderSettings,
  type ReminderSettings,
} from './browserReminder.ts';

export { DEFAULT_REMINDER_SETTINGS, sanitizeReminderSettings, type ReminderSettings };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function formatFirestoreTimestamp(value: unknown): string | undefined {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  return undefined;
}

export function subscribeUserReminderSettings(
  uid: string,
  onData: (settings: ReminderSettings | null) => void,
  onError: (error: Error) => void
): () => void {
  const path = `users/${uid}`;
  const docRef = doc(db, 'users', uid);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      const data = snapshot.data();
      onData({
        reminderEnabled: Boolean(data.reminderEnabled),
        reminderTime:
          typeof data.reminderTime === 'string' && REMINDER_TIME_PATTERN.test(data.reminderTime)
            ? data.reminderTime
            : DEFAULT_REMINDER_SETTINGS.reminderTime,
        timezone:
          typeof data.timezone === 'string' && data.timezone.trim()
            ? data.timezone.trim()
            : getBrowserTimezone(),
        updatedAt: formatFirestoreTimestamp(data.updatedAt),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveUserReminderSettings(
  uid: string,
  input: ReminderSettings
): Promise<ReminderSettings> {
  const sanitized = sanitizeReminderSettings(uid, input);
  const path = `users/${sanitized.uid}`;
  const docRef = doc(db, 'users', sanitized.uid);

  let exists = false;
  try {
    const snap = await getDoc(docRef);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!exists) {
    try {
      await setDoc(docRef, {
        uid: sanitized.uid,
        reminderEnabled: sanitized.reminderEnabled,
        reminderTime: sanitized.reminderTime,
        timezone: sanitized.timezone,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(docRef, {
        reminderEnabled: sanitized.reminderEnabled,
        reminderTime: sanitized.reminderTime,
        timezone: sanitized.timezone,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  return {
    reminderEnabled: sanitized.reminderEnabled,
    reminderTime: sanitized.reminderTime,
    timezone: sanitized.timezone,
    updatedAt: new Date().toISOString(),
  };
}
