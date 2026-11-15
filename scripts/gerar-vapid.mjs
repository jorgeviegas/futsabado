// Gera o par de chaves VAPID usado no Web Push (sem dependências; requer Node 18+).
//   node scripts/gerar-vapid.mjs
// A chave PÚBLICA vai no site (secret VITE_VAPID_PUBLIC_KEY do GitHub). A PRIVADA fica só nos segredos da Edge Function.
import { generateKeyPairSync } from 'node:crypto'

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pub = publicKey.export({ format: 'jwk' })
const priv = privateKey.export({ format: 'jwk' })
const b64 = (s) => Buffer.from(s, 'base64url')
// chave pública no formato "ponto não comprimido": 0x04 | X | Y
const publica = Buffer.concat([Buffer.from([4]), b64(pub.x), b64(pub.y)]).toString('base64url')

console.log('VAPID_PUBLIC_KEY  (também VITE_VAPID_PUBLIC_KEY no GitHub):')
console.log(publica)
console.log('\nVAPID_PRIVATE_KEY (SEGREDO — só no Supabase, nunca no GitHub nem no site):')
console.log(priv.d)
