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
  orderBy,
  type Unsubscribe 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

enum OperationType {
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

export interface Expense {
  id?: string;
  userId: string;
  date: string; // ISO date YYYY-MM-DD
  time?: string; // HH:mm
  description: string;
  amount: number;
  currency?: string;
  category?: string;
  isUnwanted?: boolean;
  createdAt?: any;
}

const COLLECTION_NAME = 'expenses';

export async function addExpense(expense: Omit<Expense, 'userId' | 'createdAt'>) {
  if (!auth.currentUser) throw new Error('User not authenticated');
  
  const path = COLLECTION_NAME;
  try {
    return await addDoc(collection(db, path), {
      ...expense,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateExpense(expenseId: string, updates: Partial<Omit<Expense, 'id' | 'userId' | 'createdAt'>>) {
  const path = `${COLLECTION_NAME}/${expenseId}`;
  try {
    const expenseRef = doc(db, COLLECTION_NAME, expenseId);
    await updateDoc(expenseRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteExpense(expenseId: string) {
  const path = `${COLLECTION_NAME}/${expenseId}`;
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, expenseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToExpenses(callback: (expenses: Expense[]) => void): Unsubscribe {
  if (!auth.currentUser) return () => {};

  const q = query(
    collection(db, COLLECTION_NAME), 
    where('userId', '==', auth.currentUser.uid),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const expenses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Expense[];
    callback(expenses);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
  });
}
