import { Injectable } from '@angular/core';
import * as sodium from 'libsodium-wrappers';

const DB_NAME = 'messenger_crypto';
const STORE_NAME = 'keys';
const KEY_ID = 'privateKey';

@Injectable({ providedIn: 'root' })
export class CryptoService {

  private async ready(): Promise<void> {
    await sodium.ready;
  }

  async generateKeypair(): Promise<{ publicKey: string; privateKey: Uint8Array }> {
    await this.ready();
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
    await this.ready();
    const recipientPublicKey = sodium.from_base64(recipientPublicKeyBase64);
    const encrypted = sodium.crypto_box_seal(
      sodium.from_string(message),
      recipientPublicKey,
    );
    return sodium.to_base64(encrypted);
  }

  async decrypt(cipherBase64: string, myPublicKeyBase64: string): Promise<string | null> {
    await this.ready();
    try {
      const privateKey = await this.loadPrivateKey();
      if (!privateKey) return null;

      const cipher = sodium.from_base64(cipherBase64);
      const publicKey = sodium.from_base64(myPublicKeyBase64);
      const decrypted = sodium.crypto_box_seal_open(cipher, publicKey, privateKey);
      return sodium.to_string(decrypted);
    } catch {
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
}