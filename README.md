# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Recuperación de Partes

La búsqueda usa `12 Inventario Rep.`. La verificación usa el último gasto aprobado del mismo proveedor y número de parte en `02 Gastos`. Los gastos creados en la misma captura se excluyen de la comparación. La consulta de una cotización es de lectura y no envía alertas.

Para habilitar el acceso directo a Google Sheets en el servidor, define `HERMES_GOOGLE_SHEETS_ID` y `HERMES_GOOGLE_SERVICE_ACCOUNT_JSON`. Concede acceso de lector a esa cuenta de servicio en la hoja correspondiente. La credencial va en las variables privadas de Vercel. Usa una copia privada de pruebas para validar la conexión antes de conectar la hoja operativa.

Define `HERMES_EXPENSE_PRICE_CURRENCY=MXN` después de confirmar que la hoja de gastos contiene precios en MXN. Configura `TELEGRAM_BOT_TOKEN` y `TELEGRAM_PRICE_ALERT_CHAT_ID` para enviar cambios de precio al guardar un gasto. Durante la validación usa un chat de pruebas. Para el acceso a datos operativos, el inicio de sesión debe vincular una identidad verificada con un rol autorizado.

El lector de fotos y PDF de recibos usa `OPENROUTER_API_KEY` y `HERMES_RECEIPT_OCR_MODEL` en Vercel. Selecciona un modelo compatible con imágenes y salida JSON. Valida con un recibo de prueba y revisa los datos extraídos antes de guardar.

```sh
npx vitest run api/_lib/hermes-part-prices.test.js api/_lib/hermes-part-route.test.js api/_lib/hermes-receipt-ocr.test.js
npm run build
```
