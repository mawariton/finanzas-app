# Finanzas (Cuarzo) — Notas del proyecto

App personal de finanzas: ligera, sin backend, funciona offline con IndexedDB (web) o SQLite (APK Android).
Lenguaje de la UI: español. Usa Capacitor para empaquetar. Sin bundler: JS plano en `js/`.

## Flujo de trabajo (importante)
- El equipo/PC edita aqui -> `git push origin main` (rama `main`).
- El movil del usuario tiene Termux con el repo clonado: `git pull` y el APK se instala por separado (NO se sube el .apk a GitHub, esta en `.gitignore`).
- Usuario no programa: dar comandos copiar/pegar y confirmaciones en espanol.

## Comandos clave (Windows PowerShell)
- Servidor local (para previsualizar la PWA): `live-server . --port=3000` (sirve la raiz del repo; el APK queda accesible en `http://<IP_PC>:3000/Finanzas-Cuarzo-vX.apk`).
- Sincronizar la PWA con el APK: copiar `js/*.js`, `css/styles.css`, `sw.js`, `icons/` a `www/` y luego:
  - `npx cap sync android`
  - `cd android; .\gradlew.bat assembleDebug`
  - Copiar `android/app/build/outputs/apk/debug/app-debug.apk` a `Finanzas-Cuarzo-vX.n.apk` en la raiz.
- Suite de tests headless (jsdom + fake-indexeddb): `node full-test.js` en `C:\Users\jdani\AppData\Local\Temp\opencode\headless\` (lee `C:/Users/jdani/finanzas-app/index.html`). Debe quedar `FULL-SUITE: PASS` sin errores de ventana.
- Icono: `Temp\opencode\gen-icons3.ps1` genera iconos por tema con GDI+. Temas: cuarzo/esmeralda/zafiro.

## Arquitectura
- `index.html` carga en orden: db, gold, budget, csv, charts, income, expenses, investments, loans, dashboard, app.
- `db.js`: motor SQLite nativo dentro del APK (via `window.Capacitor.nativePromise('CapacitorSQLite', method, options)`), tablas `(id AUTOINCREMENT, date TEXT, json TEXT)` + `settings(key,value)`, DB `finanzas`; en web cae a IndexedDB `FinanzaPersonalDB` (migracion IDB->SQLite si SQLite vacio). Store names en `StoreNames`.
- `gold.js`: precio por gramo (setting `goldPricePerGram`, default 400), helpers `Gold.isGold(r)` (usa `r.type==='gold'`), `brlToGold`, `goldToBRL`.
- UI: paginas en `<section class="page">`, navegacion con `App.navigate()`, bottom sheets con `openSheet`/`closeSheet` (cierre por token `sheetToken`), toasts con `Toast`, `App.mask()` enmascara montos, `fmtBRL`/`fmtGrams`/`formatDate`/`esc`.
- Balance: si setting `includeInvestments` esta activo, se resta de `investedAmount` de las inversiones (dashboard y pagina Oro).

## Modelo de datos — INVERSIONES (con plan de retorno)
Ademas de id/dates guarda: `investedAmount` (R$), `currentAmount` (R$ valor actual), `payCurrency` ('gold'|'brl', default gold), `goalMode` ('pct'|'total').
- `gainPct`: % ganancia esperada sobre invertido (si goalMode='pct').
- `expectedTotal`: total a recibir en la moneda de pago (si goalMode='total').
- `returns[]`: historial de retornos `{id, date, amount, currency('gold'|'brl'), note}`.
- `status`: 'invested'|'collecting'|'closed' (derivado si falta).
- `Investment.normalize(rec, price)` calcula: expected (total a recibir en unidad de pago), collected, remaining, collectedPct, expectedBrl, remainingBrl, diff/pct (vs invertido). Usa `Gold.getPricePerGram()` actual; 1 g = R$ precio.
- Flujo del usuario: "compro en R$, me pagan en oro" -> invierte R$, meta por % o total, registra retornos (g o R$, conversion automatica en vivo) y ve cuanto le falta por cobrar.

## Gotchas probadas
- SW cache: `sw.js` usa estrategia network-first y CACHE `finanzas-vN`; subir N al cambiar assets (hoy v4). Sintomas de cache vieja: modal se cierra solo / cambios no se ven -> Ctrl+F5 en el navegador.
- Capacitor 6: los metodos publicos de plugins nativos NO llevan `@PluginMethod` (si se anota da error de compilacion `cannot find symbol`). Plugin de icono `IconSwitcher` registrado en `MainActivity`.
- Icono `activity-alias` por tema en el manifest (`MainActivityCuarzo/Esmeralda/Zafiro`).
- En tests: el modal de inversion guarda con gain=0 si no se toca (compat).

## Estado actual
- APK instalable mas reciente: `Finanzas-Cuarzo-v1.5.apk` en la raiz del repo (firmado debug, ~12.2 MB).
- Ultimo commit: anadir tarjetas de inversion con historia/retornos + fix franja roja de swipe.