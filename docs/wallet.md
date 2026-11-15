# Bonos del Arcade en la wallet (Apple Wallet y Google Wallet)

El bono se puede guardar en la billetera del teléfono. La función `supabase/functions/wallet-pass` crea el pase y la app muestra el botón
solo de las billeteras que estén configuradas (sin configurar, no aparece ninguno y quedan «Enviar al negocio» y «Guardar imagen»).

## 1. Desplegar la función

```bash
supabase functions deploy wallet-pass --no-verify-jwt
```

`--no-verify-jwt` es necesario: el iPhone descarga el `.pkpass` siguiendo un enlace, sin cabeceras de sesión.

## 2. Google Wallet (Android y web)

1. Entra a la [Consola de Google Pay y Wallet](https://pay.google.com/business/console) y crea una cuenta de emisor. Anota el **Issuer ID**.
2. En Google Cloud, en el mismo proyecto, activa la **Google Wallet API** y crea una **cuenta de servicio** con una llave JSON.
3. En la consola de Wallet → «Usuarios», agrega el correo de la cuenta de servicio como administrador del emisor.
4. Guarda los secretos (la llave privada es el campo `private_key` del JSON):

```bash
supabase secrets set GOOGLE_WALLET_ISSUER_ID=3388000000012345 \
  GOOGLE_WALLET_SA_EMAIL=wallet@tu-proyecto.iam.gserviceaccount.com \
  GOOGLE_WALLET_SA_PRIVATE_KEY="$(jq -r .private_key llave.json)"
```

Mientras el emisor esté en modo de **demostración**, solo los correos que agregues como «testers» en la consola pueden guardar pases; para
abrirlo a todos, pide la publicación del emisor en la misma consola. La clase del pase (`mallplay_bono_arcade`) se crea sola con el primero.

## 3. Apple Wallet (iPhone)

Requiere una cuenta de Apple Developer (99 USD al año).

1. En developer.apple.com → Certificates, IDs & Profiles → **Identifiers** → «Pass Type IDs», crea uno (por ejemplo `pass.co.mallplay.bono`).
2. Crea el **certificado** de ese Pass Type ID (sube un CSR generado en tu computador), descárgalo y expórtalo a `.p12` desde «Acceso a llaveros».
3. Descarga el certificado intermedio **Apple WWDR** (G4) de apple.com/certificateauthority.
4. Conviértelos a PEM:

```bash
openssl pkcs12 -in pase.p12 -clcerts -nokeys -out cert.pem
openssl pkcs12 -in pase.p12 -nocerts -nodes -out key.pem
openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
```

5. Guarda los secretos (tu **Team ID** está en la página «Membership» de tu cuenta):

```bash
supabase secrets set APPLE_PASS_TYPE_ID=pass.co.mallplay.bono APPLE_TEAM_ID=ABCDE12345 \
  APPLE_PASS_CERT_PEM="$(cat cert.pem)" APPLE_PASS_KEY_PEM="$(cat key.pem)" APPLE_WWDR_PEM="$(cat wwdr.pem)"
```

Los certificados de Apple vencen cada año: hay que renovarlos y volver a guardar los secretos.

## Qué lleva el pase

QR con el código del bono (`CM-XXXXXX`), el nombre de la tienda, el premio, las condiciones, el vencimiento y las instrucciones de uso.

## Límite importante

El código del bono se genera en el teléfono al canjear, y el servidor no lo registra. Por eso el pase (igual que una captura) **prueba lo
que dice el bono, pero no que sea único ni que no se haya usado ya**. Para premios con costo real conviene registrar cada canje en una tabla
del servidor y que el negocio valide el código desde «Mi negocio» (que marque el bono como usado y limite los cupos).
