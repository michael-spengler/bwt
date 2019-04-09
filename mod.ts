import {
  seal as aeadChaCha20Poly1305Seal,
  open as aeadChaCha20Poly1305Open,
  NONCE_BYTES,
  TAG_BYTES
} from "https://denopkg.com/chiefbiiko/aead-chacha20-poly1305/mod.ts";
import { constantTimeEqual } from  "https://denopkg.com/chiefbiiko/aead-chacha20-poly1305/constant_time_equal/constant_time_equal.ts";
import { Curve25519 } from "https://denopkg.com/chiefbiiko/curve25519/mod.ts";
import {
  toUint8Array as base64ToUint8Array,
  fromUint8Array as base64FromUint8Array
} from "https://denopkg.com/chiefbiiko/base64/mod.ts";

export interface Metadata {
  typ: string;
  iss: string;
  aud: string;
  kid: number | string;
  iat: number;
  exp: number;
}

interface InternalMetadata extends Metadata {
  nonce: Uint8Array;
}

export interface Payload {
  [key: string]: unknown;
}

export interface Authenticator {
  stringify(metadata: Metadata, payload: Payload): string;
  parse(token: string): Payload;
}

export interface Curve25519Keys {
  ownSecretKey: Uint8Array;
  peerPublicKey: Uint8Array;
}

// `iss`, `aud`, `iat`, `kid`, `typ`, and `exp`

// export const MAGIC_BUF: Uint8Array = Uint8Array.from([0x42, 0x57, 0x54, 0x31]);
export const SECRET_KEY_BYTES: number = 32;
export const PUBLIC_KEY_BYTES: number = 32;

const CURVE25519: Curve25519 = new Curve25519();
const enc: TextEncoder = new TextEncoder();
const dec: TextDecoder = new TextDecoder();
// const MAGIC_BYTES: number = 4;
// const MAGIC_NONCE_BYTES: number = MAGIC_BUF.length + NONCE_BYTES;
// const NONCE_TAG_BYTES: number = NONCE_BYTES + TAG_BYTES;

function nextNonce(): Uint8Array {
  return enc.encode(String(Date.now()).slice(-12));
}

// TODO:
//   think about code usage patterns & whether caching the key in the factory
//   makes sense
//     -> createSealer({ sk, pk }), Sealer#stringify(payload)
//     -> createOpener({ sk }), Opener#parse(token)

export function createAuthenticator({
  ownSecretKey,
  peerPublicKey
}: Curve25519Keys): Authenticator {
  if (ownSecretKey.length !== SECRET_KEY_BYTES || peerPublicKey.length !== PUBLIC_KEY_BYTES) {
    return null;
  }
  const key: Uint8Array = CURVE25519.scalarMult(ownSecretKey, peerPublicKey);
  if (key.length !== 32) {
    return null;
  }
  return {
    stringify(metadata: Metadata, payload: Payload): string {
      if (
        !metadata ||
        !payload ||
        typeof metadata.exp !== "number" ||
        Number.isNaN(metadata.exp) ||
        !Number.isFinite(metadata.exp)
      ) {
        return null;
      }
      const nonce: Uint8Array = nextNonce();
      const aad: Uint8Array = enc.encode(JSON.stringify(Object.assign(
        {}, metadata, { nonce: Array.from(nonce) }
      )));
      const plaintext: Uint8Array = enc.encode(JSON.stringify(payload));
      const { ciphertext, tag } = aeadChaCha20Poly1305Seal(
        key,
        nonce,
        plaintext,
        aad
      );
      // const pac: Uint8Array = new Uint8Array(
      //   NONCE_TAG_BYTES + ciphertext.length
      // );
      // // pac.set(MAGIC_BUF, 0);
      // // pac.set(nonce, MAGIC_BYTES);
      // pac.set(aad, 0);
      // // pac.set(tag, MAGIC_NONCE_BYTES);
      // pac.set(tag, aad.length);
      // // pac.set(ciphertext, MAGIC_NONCE_TAG_BYTES);
      // pac.set(ciphertext, aad.length + TAG_BYTES)
      // return base64FromUint8Array(pac);
      return `${base64FromUint8Array(aad)}.${base64FromUint8Array(ciphertext)}.${base64FromUint8Array(tag)}`;
    },
    parse(token: string): Payload {
      // const rebased: Uint8Array = base64ToUint8Array(token);
      // // const magic: Uint8Array = rebased.subarray(0, MAGIC_BYTES);
      // // const nonce: Uint8Array = rebased.subarray(MAGIC_BYTES, MAGIC_NONCE_BYTES);
      // // const tag: Uint8Array = rebased.subarray(MAGIC_NONCE_BYTES, MAGIC_NONCE_TAG_BYTES);
      // // const ciphertext: Uint8Array = rebased.subarray(
      // //   MAGIC_NONCE_TAG_BYTES,
      // //   rebased.length
      // // );
      // const aad: Uint8Array = null;
      // // if (magic.length !== MAGIC_BYTES || nonce.length !== NONCE_BYTES || tag.length !== TAG_BYTES || !constantTimeEqual(magic, MAGIC_BUF)) {
      // //   return null;
      // // }
      if (!token) {
        return null;
      }
      const parts: string[] = token.split(".");
      if (parts.length !== 3) {
        return null;
      }
      const aad: Uint8Array = base64ToUint8Array(parts[0]);
      const metadata: InternalMetadata = JSON.parse(dec.decode(aad));
      const ciphertext: Uint8Array = base64ToUint8Array(parts[1]);
      const tag: Uint8Array = base64ToUint8Array(parts[2]);
      const plaintext: Uint8Array = aeadChaCha20Poly1305Open(
        key,
        Uint8Array.from(metadata.nonce),
        ciphertext,
        aad,
        tag
      );
      if (!plaintext) {
        return null;
      }
      let payload: Payload;
      try {
        payload = JSON.parse(dec.decode(plaintext));
      } catch (_) {
        return null;
      }
      if (
        !metadata ||
        !payload ||
        typeof metadata.exp !== "number" ||
        Number.isNaN(metadata.exp) ||
        !Number.isFinite(metadata.exp) ||
        Date.now() > metadata.exp
      ) {
        return null;
      }
      return payload;
    }
  };
}
