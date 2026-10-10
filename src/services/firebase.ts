import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Drama, MonetizationSettings } from '../types/drama';
import { INITIAL_DRAMAS } from '../data/initialDramas';

export const app = initializeApp(firebaseConfig);
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Verify connection per guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline, using local cache fallback.');
    }
  }
}
testConnection();

const DRAMAS_COLLECTION = 'dramas';
const SETTINGS_COLLECTION = 'settings';
const MONETIZATION_DOC_ID = 'monetization';

/**
 * Real-time subscription to all dramas from Firestore.
 * Notifies listener immediately whenever an admin adds, edits, or deletes a drama or episode.
 */
export function subscribeToRemoteDramas(
  callback: (dramas: Drama[]) => void,
  onError?: (err: Error) => void
): () => void {
  const colRef = collection(db, DRAMAS_COLLECTION);

  return onSnapshot(
    colRef,
    async (snapshot) => {
      if (snapshot.empty) {
        // If Firestore is brand new and empty, seed it with initial dramas so all users have content
        try {
          await seedInitialDramas();
        } catch (e) {
          console.error('Error seeding initial dramas:', e);
        }
        callback(INITIAL_DRAMAS);
        return;
      }

      const list: Drama[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Drama;
        list.push({ ...data, id: docSnap.id });
      });

      // Sort by creation date or custom order
      list.sort((a, b) => {
        const timeA = new Date(b.createdAt || 0).getTime();
        const timeB = new Date(a.createdAt || 0).getTime();
        return timeA - timeB;
      });

      callback(list);
    },
    (err) => {
      console.error('Firestore dramas subscription error:', err);
      onError?.(err);
    }
  );
}

/**
 * Seed initial dramas to Firestore if the collection is empty.
 */
export async function seedInitialDramas(): Promise<void> {
  for (const drama of INITIAL_DRAMAS) {
    const docRef = doc(db, DRAMAS_COLLECTION, drama.id);
    await setDoc(docRef, drama, { merge: true });
  }
}

/**
 * Save or update a single drama in Firestore.
 * Triggers real-time update across all connected users immediately.
 */
export async function syncDramaToCloud(drama: Drama): Promise<void> {
  const docRef = doc(db, DRAMAS_COLLECTION, drama.id);
  // Ensure we don't store undefined
  const cleanedDrama = JSON.parse(JSON.stringify(drama));
  await setDoc(docRef, cleanedDrama, { merge: true });
}

/**
 * Delete a drama from Firestore.
 * Triggers real-time update across all connected users immediately.
 */
export async function deleteDramaFromCloud(dramaId: string): Promise<void> {
  const docRef = doc(db, DRAMAS_COLLECTION, dramaId);
  await deleteDoc(docRef);
}

/**
 * Real-time subscription to monetization settings & links.
 * When the admin updates Smartlink or ad settings, ALL users get the new links in real time.
 */
export function subscribeToRemoteMonetizationSettings(
  callback: (settings: MonetizationSettings) => void,
  onError?: (err: Error) => void
): () => void {
  const docRef = doc(db, SETTINGS_COLLECTION, MONETIZATION_DOC_ID);

  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as MonetizationSettings;
        callback(data);
      }
    },
    (err) => {
      console.error('Firestore monetization settings subscription error:', err);
      onError?.(err);
    }
  );
}

/**
 * Save monetization settings and links to Firestore.
 * Syncs instantly to all users worldwide.
 */
export async function syncMonetizationSettingsToCloud(
  settings: MonetizationSettings
): Promise<void> {
  const docRef = doc(db, SETTINGS_COLLECTION, MONETIZATION_DOC_ID);
  const cleaned = JSON.parse(JSON.stringify(settings));
  await setDoc(docRef, cleaned, { merge: true });
}
