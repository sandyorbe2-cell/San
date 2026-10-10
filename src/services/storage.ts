import { Drama, Episode, MonetizationSettings, AppUser } from '../types/drama';
import { INITIAL_DRAMAS } from '../data/initialDramas';
import { saveVideoBlob, deleteVideoBlob } from './db';
import {
  syncDramaToCloud,
  deleteDramaFromCloud,
  syncMonetizationSettingsToCloud,
  subscribeToRemoteDramas,
  subscribeToRemoteMonetizationSettings,
} from './firebase';

export { subscribeToRemoteDramas, subscribeToRemoteMonetizationSettings };

export const DEFAULT_ADMIN_EMAIL = 'delorbesan@gmail.com';
export const DEFAULT_ADMIN_PASSWORD = 'sandy1290';
export const SECONDARY_ADMIN_EMAIL = 'sandyorbe2@gmail.com';
export const THIRD_ADMIN_EMAIL = 'sandymanueldone@gmail.com';

const STORAGE_KEY_DRAMAS = 'sanshort_dramas_v1';
const STORAGE_KEY_FAVORITES = 'sanshort_favorites_v1';
const STORAGE_KEY_HISTORY = 'sanshort_history_v1';
const STORAGE_KEY_CURRENT_USER = 'sanshort_current_user_v1';
const STORAGE_KEY_ADMIN_EMAILS = 'sanshort_admin_emails_v1';
const STORAGE_KEY_ADMIN_PASSWORD = 'sanshort_admin_password_v1';
const STORAGE_KEY_ADMIN_PIN = 'sanshort_admin_pin_v1';
const STORAGE_KEY_ADMIN_SESSION = 'sanshort_admin_session_v1';
const STORAGE_KEY_MONETIZATION = 'sanshort_monetization_v1';
const STORAGE_KEY_UNLOCKED = 'sanshort_unlocked_eps_v1';
const STORAGE_KEY_COINS = 'sanshort_user_coins_v1';
export const ADSTERRA_SMARTLINK_URL = 'https://directyp.org/4/3f05eba60d271f25091781d26c1f2c89';
const DEFAULT_ADMIN_PIN = '1234';

const DEFAULT_MONETIZATION: MonetizationSettings = {
  enabled: true,
  adsterraSmartlinkUrl: ADSTERRA_SMARTLINK_URL,
  secondarySmartlinkUrl: '',
  freeEpisodesCount: 3, // First 3 episodes are completely free!
  rewardCountdownSeconds: 15, // 15 seconds countdown
  coinsPerAd: 2, // 2 coins per completed reward
  coinsToUnlockEpisode: 5, // 5 coins required per episode unlock
  clicksCount: 0,
  unlockedEpisodesCount: 0,
  globalSmartlinkEnabled: true,
  globalFrequency: 'session',
  bannerAdEnabled: true,
};

// Monetization & Rewarded Ads helpers
export function getMonetizationSettings(): MonetizationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MONETIZATION);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_MONETIZATION, JSON.stringify(DEFAULT_MONETIZATION));
      return DEFAULT_MONETIZATION;
    }
    const parsed = JSON.parse(raw);
    
    // Set official Adsterra Smartlink if empty or contains legacy/defunct URLs
    if (
      !parsed.adsterraSmartlinkUrl ||
      parsed.adsterraSmartlinkUrl.trim() === '' ||
      parsed.adsterraSmartlinkUrl.includes('asiafilm.org') ||
      parsed.adsterraSmartlinkUrl.includes('beta.adsterra.com')
    ) {
      parsed.adsterraSmartlinkUrl = ADSTERRA_SMARTLINK_URL;
    }
    parsed.enabled = true;
    if (parsed.bannerAdEnabled === undefined) {
      parsed.bannerAdEnabled = true;
    }
    if (parsed.globalSmartlinkEnabled === undefined) {
      parsed.globalSmartlinkEnabled = true;
    }
    if (parsed.rewardCountdownSeconds === undefined || parsed.rewardCountdownSeconds < 15) {
      parsed.rewardCountdownSeconds = 15;
    }
    if (parsed.coinsPerAd === undefined) {
      parsed.coinsPerAd = 2;
    }
    if (parsed.coinsToUnlockEpisode === undefined) {
      parsed.coinsToUnlockEpisode = 5;
    }
    if (!parsed.globalFrequency) {
      parsed.globalFrequency = 'session';
    }

    const merged = { ...DEFAULT_MONETIZATION, ...parsed };
    localStorage.setItem(STORAGE_KEY_MONETIZATION, JSON.stringify(merged));
    return merged;
  } catch {
    return DEFAULT_MONETIZATION;
  }
}

// User Coins System
export function getUserCoins(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COINS);
    if (raw === null) {
      // Give 5 initial coins for a warm welcome so users can test unlocking 1 episode immediately if they want
      localStorage.setItem(STORAGE_KEY_COINS, '5');
      return 5;
    }
    const val = Number(raw);
    return isNaN(val) ? 0 : Math.max(0, val);
  } catch {
    return 5;
  }
}

export function setUserCoins(amount: number): void {
  try {
    localStorage.setItem(STORAGE_KEY_COINS, String(Math.max(0, amount)));
  } catch (err) {
    console.error('Error saving user coins:', err);
  }
}

export function addCoins(amount: number): number {
  const current = getUserCoins();
  const next = current + Math.max(0, amount);
  setUserCoins(next);
  return next;
}

export function spendCoins(amount: number): boolean {
  const current = getUserCoins();
  if (current >= amount) {
    setUserCoins(current - amount);
    return true;
  }
  return false;
}

export function saveMonetizationSettings(settings: MonetizationSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_MONETIZATION, JSON.stringify(settings));
    syncMonetizationSettingsToCloud(settings).catch((e) =>
      console.warn('Background sync monetization to Firestore:', e)
    );
  } catch (err) {
    console.error('Error saving monetization settings:', err);
  }
}

export function getUnlockedEpisodes(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_UNLOCKED);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isEpisodeUnlocked(dramaId: string, episodeNumber: number, freeCount: number = 3): boolean {
  // If episode is within free count, it's always unlocked
  if (episodeNumber <= freeCount) {
    return true;
  }
  const unlocked = getUnlockedEpisodes();
  const key = `${dramaId}_ep_${episodeNumber}`;
  return unlocked.includes(key);
}

export function unlockEpisode(dramaId: string, episodeNumber: number): void {
  try {
    const unlocked = getUnlockedEpisodes();
    const key = `${dramaId}_ep_${episodeNumber}`;
    if (!unlocked.includes(key)) {
      unlocked.push(key);
      localStorage.setItem(STORAGE_KEY_UNLOCKED, JSON.stringify(unlocked));

      // Increment stats
      const settings = getMonetizationSettings();
      settings.unlockedEpisodesCount = (settings.unlockedEpisodesCount || 0) + 1;
      saveMonetizationSettings(settings);
    }
  } catch (err) {
    console.error('Error unlocking episode:', err);
  }
}

export function recordSmartlinkClick(): void {
  try {
    const settings = getMonetizationSettings();
    settings.clicksCount = (settings.clicksCount || 0) + 1;
    saveMonetizationSettings(settings);
  } catch (err) {
    console.error('Error recording smartlink click:', err);
  }
}

// Admin & User authentication helpers
export function getAdminEmails(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ADMIN_EMAILS);
    const defaults = [DEFAULT_ADMIN_EMAIL, SECONDARY_ADMIN_EMAIL, THIRD_ADMIN_EMAIL];
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_ADMIN_EMAILS, JSON.stringify(defaults));
      return defaults;
    }
    const list = JSON.parse(raw);
    const merged = Array.from(new Set([...defaults, ...(Array.isArray(list) ? list : [])]));
    localStorage.setItem(STORAGE_KEY_ADMIN_EMAILS, JSON.stringify(merged));
    return merged;
  } catch {
    return [DEFAULT_ADMIN_EMAIL, SECONDARY_ADMIN_EMAIL, THIRD_ADMIN_EMAIL];
  }
}

export function getAdminPassword(): string {
  return localStorage.getItem(STORAGE_KEY_ADMIN_PASSWORD) || DEFAULT_ADMIN_PASSWORD;
}

export function verifyAdminPassword(password: string): boolean {
  if (!password) return false;
  return password.trim() === getAdminPassword();
}

export function updateAdminPassword(currentPass: string, newPass: string): boolean {
  if (verifyAdminPassword(currentPass) && newPass.trim().length >= 4) {
    localStorage.setItem(STORAGE_KEY_ADMIN_PASSWORD, newPass.trim());
    return true;
  }
  return false;
}

export function isAdminEmail(email: string): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  const admins = getAdminEmails().map((e) => e.toLowerCase().trim());
  return admins.includes(clean);
}

export function getCurrentUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: AppUser | null): void {
  try {
    if (!user) {
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
      localStorage.removeItem(STORAGE_KEY_ADMIN_SESSION);
    } else {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
      if (user.role === 'admin') {
        localStorage.setItem(STORAGE_KEY_ADMIN_SESSION, 'true');
      } else {
        localStorage.removeItem(STORAGE_KEY_ADMIN_SESSION);
      }
    }
  } catch (err) {
    console.error('Error saving current user:', err);
  }
}

export function loginUserWithEmail(email: string, name?: string): AppUser {
  const cleanEmail = email.trim().toLowerCase();
  const isAdmin = isAdminEmail(cleanEmail);
  const displayName =
    name?.trim() ||
    (cleanEmail === 'delorbesan@gmail.com'
      ? 'Sandy Orbe (Admin)'
      : cleanEmail === 'sandyorbe2@gmail.com'
      ? 'Sandy Orbe'
      : cleanEmail === 'sandymanueldone@gmail.com'
      ? 'Sandy Manuel'
      : isAdmin
      ? 'Administrador SanShort'
      : cleanEmail.split('@')[0]);

  const user: AppUser = {
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: displayName,
    email: cleanEmail,
    role: isAdmin ? 'admin' : 'user',
    createdAt: new Date().toISOString(),
  };

  setCurrentUser(user);
  return user;
}

export function getAdminPin(): string {
  return localStorage.getItem(STORAGE_KEY_ADMIN_PIN) || DEFAULT_ADMIN_PIN;
}

export function isAdminLoggedIn(): boolean {
  const user = getCurrentUser();
  if (user && user.role === 'admin') return true;
  return localStorage.getItem(STORAGE_KEY_ADMIN_SESSION) === 'true';
}

export function loginAdmin(pin: string): boolean {
  const currentPin = getAdminPin();
  if (pin.trim() === currentPin) {
    localStorage.setItem(STORAGE_KEY_ADMIN_SESSION, 'true');
    // Also set or ensure admin user
    if (!getCurrentUser()) {
      loginUserWithEmail(DEFAULT_ADMIN_EMAIL, 'Administrador');
    }
    return true;
  }
  return false;
}

export function logoutAdmin(): void {
  localStorage.removeItem(STORAGE_KEY_ADMIN_SESSION);
  localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
}

export function updateAdminPin(currentPin: string, newPin: string): boolean {
  const storedPin = getAdminPin();
  if (currentPin.trim() === storedPin && newPin.trim().length >= 4) {
    localStorage.setItem(STORAGE_KEY_ADMIN_PIN, newPin.trim());
    return true;
  }
  return false;
}

export function getDramas(): Drama[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DRAMAS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_DRAMAS, JSON.stringify(INITIAL_DRAMAS));
      return INITIAL_DRAMAS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEY_DRAMAS, JSON.stringify(INITIAL_DRAMAS));
      return INITIAL_DRAMAS;
    }
    return parsed;
  } catch (err) {
    console.error('Error reading dramas from storage:', err);
    return INITIAL_DRAMAS;
  }
}

export function saveDramas(dramas: Drama[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_DRAMAS, JSON.stringify(dramas));
  } catch (err) {
    console.error('Error saving dramas to storage:', err);
  }
}

export function getDramaById(id: string): Drama | undefined {
  const dramas = getDramas();
  return dramas.find((d) => d.id === id);
}

export function createDrama(newDrama: Omit<Drama, 'id' | 'createdAt' | 'updatedAt' | 'episodes' | 'episodesCount' | 'rating' | 'likesCount' | 'viewsCount'>): Drama {
  const dramas = getDramas();
  const id = `drama-custom-${Date.now()}`;
  const now = new Date().toISOString();

  const drama: Drama = {
    ...newDrama,
    id,
    episodesCount: 0,
    rating: 5.0,
    episodes: [],
    likesCount: 1,
    viewsCount: 1,
    isCustom: true,
    createdAt: now,
    updatedAt: now,
  };

  const updated = [drama, ...dramas];
  saveDramas(updated);
  syncDramaToCloud(drama).catch((e) =>
    console.warn('Background sync drama to Firestore:', e)
  );
  return drama;
}

export function updateDrama(dramaId: string, updates: Partial<Drama>): Drama | undefined {
  const dramas = getDramas();
  const index = dramas.findIndex((d) => d.id === dramaId);
  if (index === -1) return undefined;

  dramas[index] = {
    ...dramas[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveDramas(dramas);
  syncDramaToCloud(dramas[index]).catch((e) =>
    console.warn('Background sync update drama to Firestore:', e)
  );
  return dramas[index];
}

export function deleteDrama(dramaId: string): void {
  const dramas = getDramas();
  const dramaToDelete = dramas.find((d) => d.id === dramaId);
  
  // Clean up indexedDB blobs for episodes
  if (dramaToDelete?.episodes) {
    dramaToDelete.episodes.forEach((ep) => {
      if (ep.fileBlobId) {
        deleteVideoBlob(ep.fileBlobId);
      }
    });
  }

  const updated = dramas.filter((d) => d.id !== dramaId);
  saveDramas(updated);
  deleteDramaFromCloud(dramaId).catch((e) =>
    console.warn('Background delete drama from Firestore:', e)
  );
}

export async function addEpisodeToDrama(
  dramaId: string,
  episodeInput: {
    episodeNumber?: number;
    title: string;
    duration?: string;
    videoUrl?: string;
    videoType: 'file' | 'url' | 'youtube' | 'sample';
    videoFile?: File | null;
    thumbnail?: string;
    synopsis?: string;
  }
): Promise<Episode> {
  const dramas = getDramas();
  const dramaIndex = dramas.findIndex((d) => d.id === dramaId);
  if (dramaIndex === -1) {
    throw new Error('Drama no encontrado');
  }

  const targetDrama = dramas[dramaIndex];
  const episodeNumber =
    episodeInput.episodeNumber && episodeInput.episodeNumber > 0
      ? episodeInput.episodeNumber
      : (targetDrama.episodes.length > 0
          ? Math.max(...targetDrama.episodes.map((e) => e.episodeNumber)) + 1
          : 1);

  const episodeId = `${dramaId}-ep-${Date.now()}-${episodeNumber}`;
  let fileBlobId: string | undefined = undefined;
  let finalVideoUrl = episodeInput.videoUrl || '';

  // If user uploaded a physical file, save it into IndexedDB
  if (episodeInput.videoType === 'file' && episodeInput.videoFile) {
    fileBlobId = `blob-${episodeId}`;
    await saveVideoBlob(fileBlobId, episodeInput.videoFile);
    // Create an ephemeral object URL for current session
    finalVideoUrl = URL.createObjectURL(episodeInput.videoFile);
  }

  // Fallback demo video if URL is blank
  if (!finalVideoUrl && episodeInput.videoType !== 'file') {
    finalVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
  }

  const newEp: Episode = {
    id: episodeId,
    dramaId,
    episodeNumber,
    title: episodeInput.title.trim() || `Capítulo ${episodeNumber}`,
    duration: episodeInput.duration || '1:30',
    videoUrl: finalVideoUrl,
    videoType: episodeInput.videoType,
    fileBlobId,
    thumbnail: episodeInput.thumbnail || targetDrama.poster,
    synopsis: episodeInput.synopsis || `Capítulo ${episodeNumber} de ${targetDrama.title}`,
    uploadedAt: new Date().toISOString(),
    views: 1,
    likes: 0,
  };

  // Add and sort by episodeNumber
  const episodes = [...targetDrama.episodes, newEp].sort((a, b) => a.episodeNumber - b.episodeNumber);
  
  targetDrama.episodes = episodes;
  targetDrama.episodesCount = Math.max(targetDrama.episodesCount, episodes.length);
  targetDrama.updatedAt = new Date().toISOString();

  dramas[dramaIndex] = targetDrama;
  saveDramas(dramas);
  syncDramaToCloud(targetDrama).catch((e) =>
    console.warn('Background sync episode to Firestore:', e)
  );

  return newEp;
}

export async function deleteEpisode(dramaId: string, episodeId: string): Promise<void> {
  const dramas = getDramas();
  const dramaIndex = dramas.findIndex((d) => d.id === dramaId);
  if (dramaIndex === -1) return;

  const targetDrama = dramas[dramaIndex];
  const episodeToDelete = targetDrama.episodes.find((e) => e.id === episodeId);

  if (episodeToDelete?.fileBlobId) {
    await deleteVideoBlob(episodeToDelete.fileBlobId);
  }

  targetDrama.episodes = targetDrama.episodes.filter((e) => e.id !== episodeId);
  targetDrama.updatedAt = new Date().toISOString();
  dramas[dramaIndex] = targetDrama;
  saveDramas(dramas);
  syncDramaToCloud(targetDrama).catch((e) =>
    console.warn('Background sync delete episode to Firestore:', e)
  );
}

// Favorites
export function getFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FAVORITES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(dramaId: string): boolean {
  const favs = getFavorites();
  const exists = favs.includes(dramaId);
  let updated: string[];
  if (exists) {
    updated = favs.filter((id) => id !== dramaId);
  } else {
    updated = [...favs, dramaId];
  }
  localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(updated));
  return !exists;
}

// History
export interface HistoryRecord {
  dramaId: string;
  episodeNumber: number;
  timestamp: number;
}

export function getWatchHistory(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordWatch(dramaId: string, episodeNumber: number): void {
  try {
    const history = getWatchHistory().filter((h) => h.dramaId !== dramaId);
    const updated = [{ dramaId, episodeNumber, timestamp: Date.now() }, ...history].slice(0, 30);
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error recording watch history:', err);
  }
}

// Import & Export
export function exportCatalogJson(): string {
  const dramas = getDramas();
  // Strip temporary object URLs
  const cleanDramas = dramas.map((d) => ({
    ...d,
    episodes: d.episodes.map((ep) => ({
      ...ep,
      videoUrl: ep.videoType === 'file' ? '' : ep.videoUrl,
    })),
  }));
  return JSON.stringify(cleanDramas, null, 2);
}

export function importCatalogJson(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) {
      saveDramas(parsed);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to import JSON catalog:', err);
    return false;
  }
}

export function resetToDefaults(): void {
  localStorage.removeItem(STORAGE_KEY_DRAMAS);
  localStorage.removeItem(STORAGE_KEY_FAVORITES);
  localStorage.removeItem(STORAGE_KEY_HISTORY);
}
