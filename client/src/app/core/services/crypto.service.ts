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

    private async getSodium() {
        await _sodium.ready;
        const s = (_sodium as any).default || _sodium;
        if (!s.crypto_box_keypair) {
            return (window as any).sodium || s;
        }
        return s;
    }

    async generateKeypair(): Promise<{ publicKey: string; privateKey: Uint8Array }> {
        const sodium = await this.getSodium();

        console.log('[CryptoDebug] Sodium object keys:', Object.keys(sodium).slice(0, 5));

        if (!sodium.crypto_box_keypair) {
        throw new Error('Критическая ошибка: Функции шифрования не найдены в объекте Sodium.');
        }

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
        return sodium.to_base64(encrypted);
  }

    async decrypt(cipherBase64: string, myPublicKeyBase64: string): Promise<string | null> {
        const sodium = await this.getSodium();
        try {
            const privateKey = await this.loadPrivateKey();
            if (!privateKey) {
                console.warn('[Crypto] Нет приватного ключа в IndexedDB');
                return null;
            }

            const cipher = sodium.from_base64(cipherBase64);
            const publicKey = sodium.from_base64(myPublicKeyBase64);
            
            const decrypted = sodium.crypto_box_seal_open(cipher, publicKey, privateKey);
            return sodium.to_string(decrypted);
        } catch (err) {
            console.error('[Crypto] Ошибка расшифровки (возможно, чужой ключ):', err);
            return null;
        }
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
}