import CryptoJS from 'crypto-js';

export function generateEncryptionKey(uid: string): string {
  return CryptoJS.SHA256(uid + process.env.NEXT_PUBLIC_ENCRYPTION_SALT).toString();
}

export function encryptMessage(content: string, key: string): string {
  return CryptoJS.AES.encrypt(content, key).toString();
}

export function decryptMessage(encryptedContent: string, key: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedContent, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}