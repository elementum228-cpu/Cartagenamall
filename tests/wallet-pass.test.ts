import { generateKeyPairSync, createVerify } from 'node:crypto'
import { unzipSync, zipSync } from 'fflate'
import forge from 'node-forge'
import { describe, expect, it } from 'vitest'
import { applePassJson, buildPkpass, cleanPass, decodePass, encodePass, googleObject, googleSaveUrl, signManifest } from '../supabase/functions/_shared/wallet/pass'

const input = { code: 'cm-vy6t7c', storeName: 'Chucho Barril', title: 'Una costilla totalmente gratis', detail: 'Lunes a jueves', until: '2026-12-31', at: '2026-11-15T20:00:00Z' }

describe('datos del pase', () => {
  it('limpia lo que llega y rechaza lo que no sirve', () => {
    const p = cleanPass(input)!
    expect(p.code).toBe('CM-VY6T7C')
    expect(cleanPass({ ...input, code: 'XX-1' })).toBeNull()
    expect(cleanPass({ ...input, title: '   ' })).toBeNull()
    expect(cleanPass(null)).toBeNull()
    expect(cleanPass({ ...input, until: '31/12/2026' })!.until).toBe('')
    expect(cleanPass({ ...input, title: 'a'.repeat(300) })!.title).toHaveLength(80)
    expect(cleanPass({ ...input, title: 'Hola\u0000\nmundo' })!.title).toBe('Hola  mundo')
  })
  it('viaja codificado en el enlace y se recupera igual (con tildes)', () => {
    const p = cleanPass(input)!
    expect(decodePass(encodePass(p))).toEqual(p)
    expect(decodePass('%%%')).toBeNull()
  })
})

describe('Google Wallet', () => {
  it('el objeto lleva el código en el QR, el premio, la tienda y el vencimiento', () => {
    const o = googleObject('3388000000012345', cleanPass(input)!) as Record<string, any>
    expect(o.id).toBe('3388000000012345.CM_VY6T7C')
    expect(o.classId).toBe('3388000000012345.mallplay_bono_arcade')
    expect(o.barcode).toMatchObject({ type: 'QR_CODE', value: 'CM-VY6T7C' })
    expect(o.header.defaultValue.value).toBe('Una costilla totalmente gratis')
    expect(o.subheader.defaultValue.value).toBe('Chucho Barril')
    expect(o.validTimeInterval.end.date).toBe('2026-12-31T23:59:59-05:00')
  })
  it('firma el JWT (RS256) y la firma se verifica con la llave pública', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    const url = await googleSaveUrl({ issuerId: '3388000000012345', serviceEmail: 'wallet@proyecto.iam.gserviceaccount.com', privateKey: pem }, cleanPass(input)!, ['https://mallplay.example'])
    expect(url.startsWith('https://pay.google.com/gp/v/save/')).toBe(true)
    const [h, b, s] = url.replace('https://pay.google.com/gp/v/save/', '').split('.')
    const v = createVerify('RSA-SHA256')
    v.update(`${h}.${b}`)
    expect(v.verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true)
    const claims = JSON.parse(Buffer.from(b, 'base64url').toString())
    expect(claims).toMatchObject({ iss: 'wallet@proyecto.iam.gserviceaccount.com', aud: 'google', typ: 'savetowallet', origins: ['https://mallplay.example'] })
    expect(claims.payload.genericObjects[0].barcode.value).toBe('CM-VY6T7C')
  })
  it('acepta la llave con \\n escritos como texto (como se guarda en los secretos)', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().replace(/\n/g, '\\n')
    await expect(googleSaveUrl({ issuerId: '1', serviceEmail: 'a@b', privateKey: pem }, cleanPass(input)!, [])).resolves.toMatch(/^https:\/\/pay\.google\.com/)
  })
})

/** Un certificado de prueba (autofirmado): sirve para comprobar la estructura del .pkpass, no para instalarlo en un iPhone. */
function testCerts() {
  const make = (cn: string) => {
    const keys = forge.pki.rsa.generateKeyPair(1024)
    const cert = forge.pki.createCertificate()
    cert.publicKey = keys.publicKey
    cert.serialNumber = '01'
    cert.validity.notBefore = new Date(Date.now() - 1000)
    cert.validity.notAfter = new Date(Date.now() + 86_400_000)
    const attrs = [{ name: 'commonName', value: cn }]
    cert.setSubject(attrs)
    cert.setIssuer(attrs)
    cert.sign(keys.privateKey, forge.md.sha256.create())
    return { certPem: forge.pki.certificateToPem(cert), keyPem: forge.pki.privateKeyToPem(keys.privateKey) }
  }
  const a = make('Pass Type ID: pass.co.mallplay.bono')
  const w = make('Apple WWDR (prueba)')
  return { certPem: a.certPem, keyPem: a.keyPem, wwdrPem: w.certPem }
}

describe('Apple Wallet', () => {
  it('el pase de cupón lleva el QR, la tienda, el premio y el vencimiento', () => {
    const j = applePassJson({ passTypeId: 'pass.co.mallplay.bono', teamId: 'ABCDE12345' }, cleanPass(input)!) as Record<string, any>
    expect(j.serialNumber).toBe('CM-VY6T7C')
    expect(j.barcodes[0]).toMatchObject({ format: 'PKBarcodeFormatQR', message: 'CM-VY6T7C' })
    expect(j.coupon.primaryFields[0]).toMatchObject({ label: 'CHUCHO BARRIL', value: 'Una costilla totalmente gratis' })
    expect(j.expirationDate).toBe('2026-12-31T23:59:59-05:00')
  })
  it('arma un .pkpass completo: archivos, manifiesto con SHA-1 correcto y firma PKCS#7 separada', async () => {
    const certs = testCerts()
    const file = await buildPkpass({ passTypeId: 'pass.co.mallplay.bono', teamId: 'ABCDE12345' }, cleanPass(input)!, { zipSync, sign: (m) => signManifest(forge, m, certs) })
    const files = unzipSync(file)
    expect(Object.keys(files).sort()).toEqual(['icon.png', 'icon@2x.png', 'icon@3x.png', 'logo.png', 'logo@2x.png', 'manifest.json', 'pass.json', 'signature'])
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']))
    const { createHash } = await import('node:crypto')
    for (const [name, sha] of Object.entries(manifest)) expect(createHash('sha1').update(files[name]).digest('hex')).toBe(sha)
    expect(Object.keys(manifest)).not.toContain('signature')
    // la firma es un PKCS#7 «signedData» (DER) y trae los dos certificados
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(String.fromCharCode(...files['signature'])))
    const p7 = forge.pkcs7.messageFromAsn1(asn1) as { type: string; certificates: unknown[]; content?: unknown }
    expect(p7.type).toBe(forge.pki.oids.signedData)
    expect(p7.certificates).toHaveLength(2)
    expect(p7.content).toBeFalsy() // separada: el contenido (manifest.json) va aparte
    const png = files['icon.png']
    expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
  })
})

describe('qué billeteras se ofrecen en el cliente', () => {
  it('iPhone → Apple; Android → Google; computador → las dos; solo las configuradas', async () => {
    const { walletKinds } = await import('../src/arcade/wallet')
    const both = { google: true, apple: true }
    expect(walletKinds(both, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', false)).toEqual(['apple'])
    expect(walletKinds(both, 'Mozilla/5.0 (Linux; Android 14; Pixel 8)', false)).toEqual(['google'])
    expect(walletKinds(both, 'Mozilla/5.0 (X11; Linux x86_64)', false)).toEqual(['apple', 'google'])
    expect(walletKinds(both, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', true)).toEqual(['apple']) // iPad que se hace pasar por Mac
    expect(walletKinds({ google: false, apple: true }, 'Mozilla/5.0 (Linux; Android 14)', false)).toEqual([])
    expect(walletKinds({ google: false, apple: false }, 'Mozilla/5.0 (X11; Linux x86_64)', false)).toEqual([])
  })
})
