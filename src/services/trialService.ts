import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  type Unsubscribe 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface Trial {
  id?: string;
  userId: string;
  serviceName: string;
  startDate: string;
  durationDays: number;
  reminderDaysBefore: number;
  status: 'active' | 'cancelled' | 'expired';
  cancelUrl?: string;
  price?: number;
  currency?: string;
  category?: string;
  isAiScanned?: boolean;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION_NAME = 'trials';

export async function addTrial(trial: Omit<Trial, 'userId' | 'status' | 'createdAt' | 'updatedAt'>) {
  if (!auth.currentUser) throw new Error('User not authenticated');
  
  const path = COLLECTION_NAME;
  try {
    return await addDoc(collection(db, path), {
      ...trial,
      userId: auth.currentUser.uid,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTrial(trialId: string, updates: Partial<Omit<Trial, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>) {
  const path = `${COLLECTION_NAME}/${trialId}`;
  try {
    const trialRef = doc(db, COLLECTION_NAME, trialId);
    await updateDoc(trialRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateTrialStatus(trialId: string, status: 'cancelled' | 'active') {
  const path = `${COLLECTION_NAME}/${trialId}`;
  try {
    const trialRef = doc(db, COLLECTION_NAME, trialId);
    await updateDoc(trialRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTrial(trialId: string) {
  const path = `${COLLECTION_NAME}/${trialId}`;
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, trialId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToTrials(callback: (trials: Trial[]) => void): Unsubscribe {
  if (!auth.currentUser) return () => {};

  const q = query(
    collection(db, COLLECTION_NAME), 
    where('userId', '==', auth.currentUser.uid)
  );

  return onSnapshot(q, (snapshot) => {
    const trials = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Trial[];
    callback(trials);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
  });
}

/**
 * Parses the JSON error string thrown by handleFirestoreError
 */
export function parseFirestoreError(error: any): string {
  try {
    const errorInfo = JSON.parse(error.message);
    if (errorInfo.error.includes('permission-denied')) {
      return 'You don\'t have permission to perform this action. Please check your login status.';
    }
    if (errorInfo.error.includes('quota-exceeded')) {
      return 'Database quota exceeded. Please try again tomorrow.';
    }
    return errorInfo.error;
  } catch {
    return error instanceof Error ? error.message : 'An unexpected error occurred';
  }
}
