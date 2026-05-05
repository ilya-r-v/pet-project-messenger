import { Injectable } from '@angular/core';
import * as _sodium from 'libsodium-wrappers-sumo';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

const DB_NAME = 'messenger_crypto';
const STORE_NAME = 'keys';
const KEY_ID = 'privateKey';

@Injectable({ providedIn: 'root' })
export class CryptoService {
  constructor(private apiService: ApiService) {}

  async getSodium() {
    await _sodium.ready;
    const s = (_sodium as any).default || _sodium;
    if (!s.crypto_box_keypair) {
      return (window as any).sodium || s;
    }
    return s;
  }

  async generateKeypair(): Promise<{ publicKey: string; privateKey: Uint8Array }> {
    const sodium = await this.getSodium();
    const keypair = sodium.crypto_box_keypair();
    return {
      publicKey: sodium.to_base64(keypair.publicKey),
      privateKey: keypair.privateKey,
    };
  }

  async storePrivateKey(privateKey: Uint8Array): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(privateKey, KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async loadPrivateKey(): Promise<Uint8Array | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(KEY_ID);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async encrypt(message: string, recipientPublicKeyBase64: string): Promise<string> {
    const sodium = await this.getSodium();
    const recipientPublicKey = sodium.from_base64(recipientPublicKeyBase64);
    
    const encrypted = sodium.crypto_box_seal(
      sodium.from_string(message),
      recipientPublicKey,
    );
    return `[e2ee]:${sodium.to_base64(encrypted)}`;
  }

  async decrypt(encryptedMessage: string, privateKey: Uint8Array): Promise<string> {
    if (!encryptedMessage.startsWith('[e2ee]:')) {
      return encryptedMessage; 
    }

    const actualCiphertext = encryptedMessage.replace('[e2ee]:', '');

    try {
      return await this.performDecryption(actualCiphertext, privateKey);
    } catch (e) {
      console.error('[Crypto] Ошибка расшифровки:', e);
      return '🔒 Ошибка расшифровки';
    }
  }

  private async performDecryption(ciphertextBase64: string, privateKey: Uint8Array): Promise<string> {
    const sodium = await this.getSodium();
    const ciphertext = sodium.from_base64(ciphertextBase64);
    
    const publicKey = sodium.crypto_scalarmult_base(privateKey);
    
    const decrypted = sodium.crypto_box_seal_open(ciphertext, publicKey, privateKey);
    return sodium.to_string(decrypted);
  }

  async hasPrivateKey(): Promise<boolean> {
    const key = await this.loadPrivateKey();
    return key !== null;
  }

  async clearKeys(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private publicKeyCache = new Map<string, string>();

  async getRecipientPublicKey(userId: string): Promise<string | null> {
    if (this.publicKeyCache.has(userId)) {
      return this.publicKeyCache.get(userId)!;
    }

    try {
      const response = await firstValueFrom(this.apiService.getPublicKey(userId));
      if (!response || !response.publicKey) return null;

      this.publicKeyCache.set(userId, response.publicKey);
      return response.publicKey;
    } catch (err) {
      console.error(`[CryptoService] Could not fetch public key for user ${userId}`, err);
      return null;
    }
  }

  async generateRoomKey(): Promise<Uint8Array> {
    const sodium = await this.getSodium();
    return sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
  }

  async encryptGroup(message: string, roomKey: Uint8Array): Promise<string> {
    const sodium = await this.getSodium();
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const cipher = sodium.crypto_secretbox_easy(sodium.from_string(message), nonce, roomKey);
    
    const combined = new Uint8Array(nonce.length + cipher.length);
    combined.set(nonce);
    combined.set(cipher, nonce.length);
    return `[e2ee]:${sodium.to_base64(combined)}`;
  }

  async decryptGroup(combinedBase64: string, roomKey: Uint8Array): Promise<string | null> {
    const sodium = await this.getSodium();
    try {
        const cleanBase64 = combinedBase64.replace('[e2ee]:', '');
        const combined = sodium.from_base64(cleanBase64);
        
        const nonce = combined.slice(0, sodium.crypto_secretbox_NONCEBYTES);
        const cipher = combined.slice(sodium.crypto_secretbox_NONCEBYTES);
        
        const decrypted = sodium.crypto_secretbox_open_easy(cipher, nonce, roomKey);
        return sodium.to_string(decrypted);
    } catch (e) {
        return null;
    }
  }
}