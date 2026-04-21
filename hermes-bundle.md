This file is a merged representation of a subset of the codebase, containing specifically included files and files not matching ignore patterns, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of a subset of the repository's contents that is considered the most important context.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Only files matching these patterns are included: src/**/*, vite.config.ts, package.json, tsconfig.json
- Files matching these patterns are excluded: node_modules, dist, *.lock, *.log, *.svg, *.png, *.jpg, *.ico, public
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
package.json
src/App.tsx
src/assets/hero.png
src/assets/react.svg
src/assets/vite.svg
src/components/chat/ChatBubble.tsx
src/components/chat/ChatInput.tsx
src/components/chat/HermesChat.tsx
src/components/chat/TypingIndicator.tsx
src/components/dashboard/AccionesDelDia.tsx
src/components/dashboard/AvailabilityChart.tsx
src/components/dashboard/BriefingCard.tsx
src/components/dashboard/ExecutiveDashboard.tsx
src/components/dashboard/FleetGrid.tsx
src/components/dvir/DVIRResultBanner.tsx
src/components/dvir/SystemCheckRow.tsx
src/components/falla/AutoPriorityIndicator.tsx
src/components/layout/AppShell.tsx
src/components/layout/BottomNav.tsx
src/components/layout/Header.tsx
src/components/layout/MoreTray.tsx
src/components/mechanic/DiagramViewer.tsx
src/components/mechanic/ManualSearch.tsx
src/components/mechanic/MechanicHome.tsx
src/components/mechanic/PartCard.tsx
src/components/mechanic/PartsSearch.tsx
src/components/ui/ConfirmModal.tsx
src/components/ui/EmptyState.tsx
src/components/ui/EquipmentCard.tsx
src/components/ui/KPICard.tsx
src/components/ui/OfflineBanner.tsx
src/components/ui/OTCard.tsx
src/components/ui/PhotoCapture.tsx
src/components/ui/PullIndicator.tsx
src/components/ui/Skeleton.tsx
src/components/ui/StatusDot.tsx
src/components/ui/SuccessToast.tsx
src/data/dvir-systems.ts
src/data/equipment-catalog.ts
src/data/fuel-benchmarks.ts
src/data/mock-workorders.ts
src/data/pm-parts-catalog.ts
src/data/pm-rules.ts
src/hooks/useDashboardData.ts
src/hooks/useOnlineStatus.ts
src/hooks/usePullToRefresh.ts
src/index.css
src/lib/date-utils.ts
src/lib/hermes-api.ts
src/lib/offline-queue.ts
src/lib/ot-generator.ts
src/lib/photo-upload-safe.ts
src/lib/photo-upload.ts
src/lib/print-pm-order.ts
src/lib/priority-calculator.ts
src/lib/sheets-api.ts
src/lib/supabase.ts
src/main.tsx
src/pages/AlertsPage.tsx
src/pages/ChatPage.tsx
src/pages/CoordinatorHomePage.tsx
src/pages/DashboardPage.tsx
src/pages/DieselPage.tsx
src/pages/DVIRPage.tsx
src/pages/FallaPage.tsx
src/pages/FleetPage.tsx
src/pages/HorometroPage.tsx
src/pages/InventoryPage.tsx
src/pages/LoginPage.tsx
src/pages/MechanicPage.tsx
src/pages/MyReportsPage.tsx
src/pages/NeumaticosPage.tsx
src/pages/OperatorHomePage.tsx
src/pages/PedidosPage.tsx
src/pages/PerfilPage.tsx
src/pages/PMSchedulePage.tsx
src/pages/PMWorkOrderPage.tsx
src/pages/SupervisorHomePage.tsx
src/pages/ViajePage.tsx
src/pages/ViajesPenaPage.tsx
src/pages/WorkOrderDetailPage.tsx
src/pages/WorkOrdersPage.tsx
src/pages/WorkshopHomePage.tsx
src/stores/auth-store.ts
src/stores/cart-store.ts
src/stores/workorder-store.ts
src/types/chat.ts
src/types/dvir.ts
src/types/equipment.ts
src/types/fuel.ts
src/types/roles.ts
src/types/trip.ts
src/types/workorder.ts
tsconfig.json
vite.config.ts
```

# Files

## File: package.json
```json
{
  "name": "hermes-fleet-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.101.1",
    "lucide-react": "^1.7.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.14.0",
    "recharts": "^3.8.1",
    "zustand": "^5.0.12"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "@tailwindcss/vite": "^4.2.2",
    "@types/node": "^24.12.0",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "eslint": "^9.39.4",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.4.0",
    "tailwindcss": "^4.2.2",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.57.0",
    "vite": "^8.0.1"
  }
}
```

## File: src/assets/react.svg
```xml
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--logos" width="35.93" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 228"><path fill="#00D8FF" d="M210.483 73.824a171.49 171.49 0 0 0-8.24-2.597c.465-1.9.893-3.777 1.273-5.621c6.238-30.281 2.16-54.676-11.769-62.708c-13.355-7.7-35.196.329-57.254 19.526a171.23 171.23 0 0 0-6.375 5.848a155.866 155.866 0 0 0-4.241-3.917C100.759 3.829 77.587-4.822 63.673 3.233C50.33 10.957 46.379 33.89 51.995 62.588a170.974 170.974 0 0 0 1.892 8.48c-3.28.932-6.445 1.924-9.474 2.98C17.309 83.498 0 98.307 0 113.668c0 15.865 18.582 31.778 46.812 41.427a145.52 145.52 0 0 0 6.921 2.165a167.467 167.467 0 0 0-2.01 9.138c-5.354 28.2-1.173 50.591 12.134 58.266c13.744 7.926 36.812-.22 59.273-19.855a145.567 145.567 0 0 0 5.342-4.923a168.064 168.064 0 0 0 6.92 6.314c21.758 18.722 43.246 26.282 56.54 18.586c13.731-7.949 18.194-32.003 12.4-61.268a145.016 145.016 0 0 0-1.535-6.842c1.62-.48 3.21-.974 4.76-1.488c29.348-9.723 48.443-25.443 48.443-41.52c0-15.417-17.868-30.326-45.517-39.844Zm-6.365 70.984c-1.4.463-2.836.91-4.3 1.345c-3.24-10.257-7.612-21.163-12.963-32.432c5.106-11 9.31-21.767 12.459-31.957c2.619.758 5.16 1.557 7.61 2.4c23.69 8.156 38.14 20.213 38.14 29.504c0 9.896-15.606 22.743-40.946 31.14Zm-10.514 20.834c2.562 12.94 2.927 24.64 1.23 33.787c-1.524 8.219-4.59 13.698-8.382 15.893c-8.067 4.67-25.32-1.4-43.927-17.412a156.726 156.726 0 0 1-6.437-5.87c7.214-7.889 14.423-17.06 21.459-27.246c12.376-1.098 24.068-2.894 34.671-5.345a134.17 134.17 0 0 1 1.386 6.193ZM87.276 214.515c-7.882 2.783-14.16 2.863-17.955.675c-8.075-4.657-11.432-22.636-6.853-46.752a156.923 156.923 0 0 1 1.869-8.499c10.486 2.32 22.093 3.988 34.498 4.994c7.084 9.967 14.501 19.128 21.976 27.15a134.668 134.668 0 0 1-4.877 4.492c-9.933 8.682-19.886 14.842-28.658 17.94ZM50.35 144.747c-12.483-4.267-22.792-9.812-29.858-15.863c-6.35-5.437-9.555-10.836-9.555-15.216c0-9.322 13.897-21.212 37.076-29.293c2.813-.98 5.757-1.905 8.812-2.773c3.204 10.42 7.406 21.315 12.477 32.332c-5.137 11.18-9.399 22.249-12.634 32.792a134.718 134.718 0 0 1-6.318-1.979Zm12.378-84.26c-4.811-24.587-1.616-43.134 6.425-47.789c8.564-4.958 27.502 2.111 47.463 19.835a144.318 144.318 0 0 1 3.841 3.545c-7.438 7.987-14.787 17.08-21.808 26.988c-12.04 1.116-23.565 2.908-34.161 5.309a160.342 160.342 0 0 1-1.76-7.887Zm110.427 27.268a347.8 347.8 0 0 0-7.785-12.803c8.168 1.033 15.994 2.404 23.343 4.08c-2.206 7.072-4.956 14.465-8.193 22.045a381.151 381.151 0 0 0-7.365-13.322Zm-45.032-43.861c5.044 5.465 10.096 11.566 15.065 18.186a322.04 322.04 0 0 0-30.257-.006c4.974-6.559 10.069-12.652 15.192-18.18ZM82.802 87.83a323.167 323.167 0 0 0-7.227 13.238c-3.184-7.553-5.909-14.98-8.134-22.152c7.304-1.634 15.093-2.97 23.209-3.984a321.524 321.524 0 0 0-7.848 12.897Zm8.081 65.352c-8.385-.936-16.291-2.203-23.593-3.793c2.26-7.3 5.045-14.885 8.298-22.6a321.187 321.187 0 0 0 7.257 13.246c2.594 4.48 5.28 8.868 8.038 13.147Zm37.542 31.03c-5.184-5.592-10.354-11.779-15.403-18.433c4.902.192 9.899.29 14.978.29c5.218 0 10.376-.117 15.453-.343c-4.985 6.774-10.018 12.97-15.028 18.486Zm52.198-57.817c3.422 7.8 6.306 15.345 8.596 22.52c-7.422 1.694-15.436 3.058-23.88 4.071a382.417 382.417 0 0 0 7.859-13.026a347.403 347.403 0 0 0 7.425-13.565Zm-16.898 8.101a358.557 358.557 0 0 1-12.281 19.815a329.4 329.4 0 0 1-23.444.823c-7.967 0-15.716-.248-23.178-.732a310.202 310.202 0 0 1-12.513-19.846h.001a307.41 307.41 0 0 1-10.923-20.627a310.278 310.278 0 0 1 10.89-20.637l-.001.001a307.318 307.318 0 0 1 12.413-19.761c7.613-.576 15.42-.876 23.31-.876H128c7.926 0 15.743.303 23.354.883a329.357 329.357 0 0 1 12.335 19.695a358.489 358.489 0 0 1 11.036 20.54a329.472 329.472 0 0 1-11 20.722Zm22.56-122.124c8.572 4.944 11.906 24.881 6.52 51.026c-.344 1.668-.73 3.367-1.15 5.09c-10.622-2.452-22.155-4.275-34.23-5.408c-7.034-10.017-14.323-19.124-21.64-27.008a160.789 160.789 0 0 1 5.888-5.4c18.9-16.447 36.564-22.941 44.612-18.3ZM128 90.808c12.625 0 22.86 10.235 22.86 22.86s-10.235 22.86-22.86 22.86s-22.86-10.235-22.86-22.86s10.235-22.86 22.86-22.86Z"></path></svg>
```

## File: src/assets/vite.svg
```xml
<svg xmlns="http://www.w3.org/2000/svg" width="77" height="47" fill="none" aria-labelledby="vite-logo-title" viewBox="0 0 77 47"><title id="vite-logo-title">Vite</title><style>.parenthesis{fill:#000}@media (prefers-color-scheme:dark){.parenthesis{fill:#fff}}</style><path fill="#9135ff" d="M40.151 45.71c-.663.844-2.02.374-2.02-.699V34.708a2.26 2.26 0 0 0-2.262-2.262H24.493c-.92 0-1.457-1.04-.92-1.788l7.479-10.471c1.07-1.498 0-3.578-1.842-3.578H15.443c-.92 0-1.456-1.04-.92-1.788l9.696-13.576c.213-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.472c-1.07 1.497 0 3.578 1.842 3.578h11.376c.944 0 1.474 1.087.89 1.83L40.153 45.712z"/><mask id="a" width="48" height="47" x="14" y="0" maskUnits="userSpaceOnUse" style="mask-type:alpha"><path fill="#000" d="M40.047 45.71c-.663.843-2.02.374-2.02-.699V34.708a2.26 2.26 0 0 0-2.262-2.262H24.389c-.92 0-1.457-1.04-.92-1.788l7.479-10.472c1.07-1.497 0-3.578-1.842-3.578H15.34c-.92 0-1.456-1.04-.92-1.788l9.696-13.575c.213-.297.556-.474.92-.474H53.93c.92 0 1.456 1.04.92 1.788L47.37 13.03c-1.07 1.498 0 3.578 1.842 3.578h11.376c.944 0 1.474 1.088.89 1.831L40.049 45.712z"/></mask><g mask="url(#a)"><g filter="url(#b)"><ellipse cx="5.508" cy="14.704" fill="#eee6ff" rx="5.508" ry="14.704" transform="rotate(269.814 20.96 11.29)scale(-1 1)"/></g><g filter="url(#c)"><ellipse cx="10.399" cy="29.851" fill="#eee6ff" rx="10.399" ry="29.851" transform="rotate(89.814 -16.902 -8.275)scale(1 -1)"/></g><g filter="url(#d)"><ellipse cx="5.508" cy="30.487" fill="#8900ff" rx="5.508" ry="30.487" transform="rotate(89.814 -19.197 -7.127)scale(1 -1)"/></g><g filter="url(#e)"><ellipse cx="5.508" cy="30.599" fill="#8900ff" rx="5.508" ry="30.599" transform="rotate(89.814 -25.928 4.177)scale(1 -1)"/></g><g filter="url(#f)"><ellipse cx="5.508" cy="30.599" fill="#8900ff" rx="5.508" ry="30.599" transform="rotate(89.814 -25.738 5.52)scale(1 -1)"/></g><g filter="url(#g)"><ellipse cx="14.072" cy="22.078" fill="#eee6ff" rx="14.072" ry="22.078" transform="rotate(93.35 31.245 55.578)scale(-1 1)"/></g><g filter="url(#h)"><ellipse cx="3.47" cy="21.501" fill="#8900ff" rx="3.47" ry="21.501" transform="rotate(89.009 35.419 55.202)scale(-1 1)"/></g><g filter="url(#i)"><ellipse cx="3.47" cy="21.501" fill="#8900ff" rx="3.47" ry="21.501" transform="rotate(89.009 35.419 55.202)scale(-1 1)"/></g><g filter="url(#j)"><ellipse cx="14.592" cy="9.743" fill="#8900ff" rx="4.407" ry="29.108" transform="rotate(39.51 14.592 9.743)"/></g><g filter="url(#k)"><ellipse cx="61.728" cy="-5.321" fill="#8900ff" rx="4.407" ry="29.108" transform="rotate(37.892 61.728 -5.32)"/></g><g filter="url(#l)"><ellipse cx="55.618" cy="7.104" fill="#00c2ff" rx="5.971" ry="9.665" transform="rotate(37.892 55.618 7.104)"/></g><g filter="url(#m)"><ellipse cx="12.326" cy="39.103" fill="#8900ff" rx="4.407" ry="29.108" transform="rotate(37.892 12.326 39.103)"/></g><g filter="url(#n)"><ellipse cx="12.326" cy="39.103" fill="#8900ff" rx="4.407" ry="29.108" transform="rotate(37.892 12.326 39.103)"/></g><g filter="url(#o)"><ellipse cx="49.857" cy="30.678" fill="#8900ff" rx="4.407" ry="29.108" transform="rotate(37.892 49.857 30.678)"/></g><g filter="url(#p)"><ellipse cx="52.623" cy="33.171" fill="#00c2ff" rx="5.971" ry="15.297" transform="rotate(37.892 52.623 33.17)"/></g></g><path d="M6.919 0c-9.198 13.166-9.252 33.575 0 46.789h6.215c-9.25-13.214-9.196-33.623 0-46.789zm62.424 0h-6.215c9.198 13.166 9.252 33.575 0 46.789h6.215c9.25-13.214 9.196-33.623 0-46.789" class="parenthesis"/><defs><filter id="b" width="60.045" height="41.654" x="-5.564" y="16.92" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="7.659"/></filter><filter id="c" width="90.34" height="51.437" x="-40.407" y="-6.762" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="7.659"/></filter><filter id="d" width="79.355" height="29.4" x="-35.435" y="2.801" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="e" width="79.579" height="29.4" x="-30.84" y="20.8" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="f" width="79.579" height="29.4" x="-29.307" y="21.949" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="g" width="74.749" height="58.852" x="29.961" y="-17.13" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="7.659"/></filter><filter id="h" width="61.377" height="25.362" x="37.754" y="3.055" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="i" width="61.377" height="25.362" x="37.754" y="3.055" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="j" width="56.045" height="63.649" x="-13.43" y="-22.082" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="k" width="54.814" height="64.646" x="34.321" y="-37.644" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="l" width="33.541" height="35.313" x="38.847" y="-10.552" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="m" width="54.814" height="64.646" x="-15.081" y="6.78" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="n" width="54.814" height="64.646" x="-15.081" y="6.78" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="o" width="54.814" height="64.646" x="22.45" y="-1.645" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="p" width="39.409" height="43.623" x="32.919" y="11.36" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter></defs></svg>
```

## File: src/components/dashboard/FleetGrid.tsx
```typescript
import type { Equipment } from '../../types/equipment';
import StatusDot from '../ui/StatusDot';

interface FleetGridProps {
  equipment: Equipment[];
}

const STATUS_ORDER: Equipment['status'][] = ['operativo', 'alerta', 'taller', 'inactivo'];

export default function FleetGrid({ equipment }: FleetGridProps) {
  const sorted = [...equipment].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  );

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {sorted.map((unit) => (
        <div
          key={unit.unit_id}
          className="bg-card rounded-lg p-3 border border-border text-center hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex justify-center mb-1">
            <StatusDot status={unit.status} />
          </div>
          <p className="font-mono text-sm font-semibold text-text leading-tight">{unit.unit_id}</p>
          <p className="text-xs text-text-secondary truncate mt-0.5">{unit.model}</p>
        </div>
      ))}
    </div>
  );
}
```

## File: src/components/dvir/DVIRResultBanner.tsx
```typescript
import type { CheckStatus, DVIRResult } from '../../types/dvir';

interface CheckSummary {
  status: CheckStatus;
}

interface DVIRResultBannerProps {
  checks: CheckSummary[];
}

export default function DVIRResultBanner({ checks }: DVIRResultBannerProps) {
  const allChecked = checks.every((c) => c.status !== null);
  if (!allChecked) return null;

  const okCount = checks.filter((c) => c.status === 'ok').length;
  const alertaCount = checks.filter((c) => c.status === 'alerta').length;
  const fallaCount = checks.filter((c) => c.status === 'falla').length;

  let result: DVIRResult;
  if (fallaCount > 0) {
    result = 'reprobado';
  } else if (alertaCount > 0) {
    result = 'condicional';
  } else {
    result = 'aprobado';
  }

  if (result === 'aprobado') {
    return (
      <div className="bg-green-50 border-l-4 border-success rounded-lg p-4 mt-4">
        <p className="text-success font-semibold text-sm">
          APROBADO {okCount}/12 — Equipo habilitado para operar
        </p>
      </div>
    );
  }

  if (result === 'condicional') {
    return (
      <div className="bg-amber-50 border-l-4 border-warning rounded-lg p-4 mt-4">
        <p className="text-amber-800 font-semibold text-sm">
          CONDICIONAL — Supervisor será notificado
        </p>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border-l-4 border-critical rounded-lg p-4 mt-4">
      <p className="text-critical font-semibold text-sm">
        REPROBADO — OT auto-generada. Equipo FUERA DE SERVICIO
      </p>
    </div>
  );
}
```

## File: src/components/dvir/SystemCheckRow.tsx
```typescript
import {
  Cog,
  Settings,
  CircleStop,
  Navigation,
  Droplets,
  Zap,
  Circle,
  Box,
  Lightbulb,
  FlaskConical,
  LayoutDashboard,
  Footprints,
  type LucideProps,
} from 'lucide-react';
import type { DVIRSystem, CheckStatus } from '../../types/dvir';
import PhotoCapture from '../ui/PhotoCapture';

type IconComponent = React.ComponentType<LucideProps>;

const ICON_MAP: Record<string, IconComponent> = {
  Cog,
  Settings,
  CircleStop,
  Navigation,
  Droplets,
  Zap,
  Circle,
  Box,
  Lightbulb,
  Beaker: FlaskConical,
  LayoutDashboard,
  Footprints,
};

interface PhotoItem {
  file: File;
  preview: string;
}

interface SystemCheckRowProps {
  system: DVIRSystem;
  value: CheckStatus;
  onChange: (status: CheckStatus) => void;
  photos: PhotoItem[];
  onPhotoCapture: (file: File) => void;
  onPhotoRemove: (index: number) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
}

export default function SystemCheckRow({
  system,
  value,
  onChange,
  photos,
  onPhotoCapture,
  onPhotoRemove,
  notes,
  onNotesChange,
}: SystemCheckRowProps) {
  const IconComponent = ICON_MAP[system.icon] ?? Cog;

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-border mb-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <IconComponent size={18} className="text-text-secondary shrink-0" />
          <span className="font-medium text-text text-sm truncate">{system.label}</span>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onChange('ok')}
            className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
              value === 'ok'
                ? 'bg-success text-white'
                : 'bg-gray-100 text-text-secondary'
            }`}
          >
            OK
          </button>
          <button
            type="button"
            onClick={() => onChange('alerta')}
            className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
              value === 'alerta'
                ? 'bg-warning text-white'
                : 'bg-gray-100 text-text-secondary'
            }`}
          >
            Alerta
          </button>
          <button
            type="button"
            onClick={() => onChange('falla')}
            className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
              value === 'falla'
                ? 'bg-critical text-white'
                : 'bg-gray-100 text-text-secondary'
            }`}
          >
            Falla
          </button>
        </div>
      </div>

      {value === 'falla' && (
        <div className="mt-3 flex flex-col gap-2">
          <PhotoCapture
            photos={photos}
            onCapture={onPhotoCapture}
            onRemove={onPhotoRemove}
            multiple={false}
          />
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Describe el problema..."
            rows={2}
            className="w-full rounded-xl border border-border p-2 text-sm text-text resize-none bg-white"
          />
        </div>
      )}
    </div>
  );
}
```

## File: src/components/falla/AutoPriorityIndicator.tsx
```typescript
import type { OTPriority } from '../../types/workorder';
import { PRIORITY_CONFIG } from '../../types/workorder';

interface AutoPriorityIndicatorProps {
  priority: OTPriority;
}

export default function AutoPriorityIndicator({ priority }: AutoPriorityIndicatorProps) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <div className="flex flex-col gap-1">
      <span
        className="rounded-full px-4 py-2 font-semibold text-sm w-fit"
        style={{ backgroundColor: config.bg, color: config.color }}
      >
        {config.label}
      </span>
      <span className="text-sm text-text-secondary">
        Tiempo de respuesta: {config.time}
      </span>
    </div>
  );
}
```

## File: src/components/mechanic/ManualSearch.tsx
```typescript
import { useState } from 'react';
import { Search, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { manualLookup, type ManualLookupResult } from '../../lib/hermes-api';

const EQUIPMENT_OPTIONS = [
  'Seleccionar equipo',
  'Komatsu D155AX-6',
  'Komatsu D65EX-16',
  'Komatsu HM400-3',
  'CAT 740B',
  'Doosan DL420A',
  'Doosan DX340LC',
  'Doosan DX225LC',
  'Mack GR84B 8x4',
];

const MOCK_RESULT: ManualLookupResult = {
  extracto:
    'Procedimiento de cambio de aceite de motor para Komatsu D155AX-6. Intervalo recomendado: cada 500 horas de operación o 6 meses. Utilizar aceite SAE 15W-40 API CH-4 o superior.',
  pasos_tecnicos: [
    'Precalentar el motor durante 5 minutos a ralentí para fluidificar el aceite.',
    'Apagar el motor y esperar 5 minutos antes de drenar.',
    'Retirar el tapón de drenaje (M20x1.5) y drenar completamente el aceite usado.',
    'Reemplazar el filtro de aceite (ref. 6156-81-8300) con filtro nuevo.',
    'Reinstalar el tapón de drenaje con torque especificado.',
    'Rellenar con 28 litros de aceite SAE 15W-40 API CH-4.',
    'Verificar nivel con varilla y arrancar motor. Revisar fugas.',
    'Registrar la intervención en bitácora de mantenimiento.',
  ],
  herramientas_requeridas: [
    'Llave de cubo 22mm',
    'Llave para filtros de aceite',
    'Recipiente para residuos de 30L mínimo',
    'Bandeja de drenaje',
    'Paños absorbentes',
  ],
  torque_specs: 'Tapón de drenaje: 78 N·m (8 kgf·m). Filtro de aceite: apriete a mano + 3/4 de vuelta.',
};

export default function ManualSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedEquipo, setSelectedEquipo] = useState('Seleccionar equipo');
  const [result, setResult] = useState<ManualLookupResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const equipo = selectedEquipo !== 'Seleccionar equipo' ? selectedEquipo : 'General';
      const data = await manualLookup({ equipo, tema: query });
      setResult(data);
    } catch {
      setResult(MOCK_RESULT);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSearch();
  }

  return (
    <div className="flex flex-col py-4">
      {/* Search bar */}
      <div className="relative mb-3">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar por equipo, sistema o procedimiento..."
          className="w-full bg-white rounded-xl border-2 border-border focus:border-amber outline-none pl-11 pr-4 py-4 text-sm text-text placeholder:text-text-secondary"
        />
      </div>

      {/* Equipment selector */}
      <select
        value={selectedEquipo}
        onChange={(e) => setSelectedEquipo(e.target.value)}
        className="w-full bg-white rounded-xl border-2 border-border focus:border-amber outline-none px-4 py-3 text-sm text-text mb-4 appearance-none"
      >
        {EQUIPMENT_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>

      <button
        onClick={handleSearch}
        disabled={!query.trim() || loading}
        className="bg-amber text-white rounded-xl py-3 font-medium text-sm mb-6 disabled:opacity-50 transition-opacity"
      >
        {loading ? 'Buscando...' : 'Buscar Procedimiento'}
      </button>

      {/* Result card */}
      {result && (
        <div className="bg-card rounded-xl shadow-sm border border-border p-4">
          <h3 className="font-semibold text-text text-base mb-3">Procedimiento</h3>

          <p className="text-sm text-text-secondary mb-4 leading-relaxed">{result.extracto}</p>

          <h4 className="font-semibold text-text text-sm mb-2">Pasos técnicos</h4>
          <ol className="list-decimal list-inside space-y-1.5 mb-4">
            {result.pasos_tecnicos.map((paso, i) => (
              <li key={i} className="text-sm text-text leading-relaxed">{paso}</li>
            ))}
          </ol>

          <h4 className="font-semibold text-text text-sm mb-2">Herramientas requeridas</h4>
          <ul className="list-disc list-inside space-y-1 mb-4">
            {result.herramientas_requeridas.map((tool, i) => (
              <li key={i} className="text-sm text-text-secondary">{tool}</li>
            ))}
          </ul>

          {result.torque_specs && (
            <>
              <h4 className="font-semibold text-text text-sm mb-2">Torques</h4>
              <p className="text-sm text-text-secondary mb-4">{result.torque_specs}</p>
            </>
          )}

          <button
            onClick={() => navigate('/diagrams')}
            className="w-full border-2 border-amber text-amber rounded-xl py-3 font-medium text-sm flex items-center justify-center gap-2 hover:bg-amber hover:text-white transition-colors"
          >
            <FileText size={16} />
            Ver PDF completo
          </button>
        </div>
      )}

      {!result && !loading && (
        <p className="text-center text-text-secondary text-sm py-8">
          Ingresa un tema y selecciona el equipo para buscar procedimientos técnicos
        </p>
      )}
    </div>
  );
}
```

## File: src/components/mechanic/PartsSearch.tsx
```typescript
import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { searchParts, type PartResult } from '../../lib/hermes-api';
import PartCard from './PartCard';

const EQUIPMENT_FILTERS = ['Todos', 'Komatsu', 'CAT', 'Doosan', 'Mack'];

const MOCK_PARTS: PartResult[] = [
  {
    part_number: 'KOM-07100-6171',
    description: 'Sello hidráulico 85mm — cilindro de dirección',
    oem_ref: '07100-61711',
    compatible_units: ['EPAK-09', 'EPAK-02'],
    stock_quantity: 4,
    stock_minimum: 2,
    location: 'Estante A-3',
    unit_price: 128.5,
    alternatives: ['SH-850-K', 'KOM-07100-6170'],
  },
  {
    part_number: 'KOM-21T-60-72231',
    description: 'Rodillo portador — tren de rodaje D155AX',
    oem_ref: '21T-60-72231',
    compatible_units: ['EPTK-08', 'EPTK-09', 'EPTK-10'],
    stock_quantity: 2,
    stock_minimum: 2,
    location: 'Estante B-7',
    unit_price: 345.0,
    alternatives: [],
  },
  {
    part_number: 'CAT-283-5648',
    description: 'Relay 24V — sistema eléctrico CAT 740B',
    oem_ref: '283-5648',
    compatible_units: ['EPAK-06', 'EPAK-07', 'EPAK-08'],
    stock_quantity: 8,
    stock_minimum: 3,
    location: 'Estante C-1',
    unit_price: 45.0,
    alternatives: ['REL-24V-40A'],
  },
  {
    part_number: 'KOM-6156-81-8300',
    description: 'Filtro de aceite motor SAA6D140E',
    oem_ref: '6156-81-8300',
    compatible_units: ['EPTK-08', 'EPTK-09', 'EPTK-12'],
    stock_quantity: 0,
    stock_minimum: 5,
    location: 'Estante A-1',
    unit_price: 38.75,
    alternatives: ['FO-D140-K'],
  },
  {
    part_number: 'MACK-25164427',
    description: 'Filtro combustible Mack GR84B',
    oem_ref: '25164427',
    compatible_units: ['ULTRATK-01', 'ULTRATK-02', 'ULTRATK-03'],
    stock_quantity: 12,
    stock_minimum: 4,
    location: 'Estante D-2',
    unit_price: 52.0,
    alternatives: ['FF5786', 'P551315'],
  },
];

export default function PartsSearch() {
  const [query, setQuery] = useState('');
  const [selectedEquipo, setSelectedEquipo] = useState('Todos');
  const [results, setResults] = useState<PartResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const equipo = selectedEquipo !== 'Todos' ? selectedEquipo : undefined;
        const data = await searchParts(query, equipo);
        setResults(data);
      } catch {
        const q = query.toLowerCase();
        const equipo = selectedEquipo !== 'Todos' ? selectedEquipo.toLowerCase() : null;
        const filtered = MOCK_PARTS.filter((p) => {
          const matchesQuery =
            p.part_number.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.oem_ref.toLowerCase().includes(q);
          const matchesEquipo = !equipo || p.description.toLowerCase().includes(equipo);
          return matchesQuery && matchesEquipo;
        });
        setResults(filtered.length > 0 ? filtered : MOCK_PARTS.slice(0, 5));
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selectedEquipo]);

  return (
    <div className="flex flex-col py-4">
      {/* Search bar */}
      <div className="relative mb-3">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por número, descripción o equipo..."
          className="w-full bg-white rounded-xl border-2 border-border focus:border-amber outline-none pl-11 pr-4 py-4 text-sm text-text placeholder:text-text-secondary"
        />
      </div>

      {/* Equipment filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {EQUIPMENT_FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedEquipo(filter)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              selectedEquipo === filter
                ? 'bg-amber text-white border-amber'
                : 'bg-white text-text-secondary border-border hover:border-amber'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading && (
        <p className="text-center text-text-secondary text-sm py-4">Buscando...</p>
      )}
      {!loading && query && results.length === 0 && (
        <p className="text-center text-text-secondary text-sm py-4">No se encontraron resultados</p>
      )}
      {!loading && !query && (
        <p className="text-center text-text-secondary text-sm py-8">
          Ingresa un número de parte, descripción o nombre de equipo
        </p>
      )}
      {results.map((part) => (
        <PartCard key={part.part_number} part={part} />
      ))}
    </div>
  );
}
```

## File: src/components/ui/ConfirmModal.tsx
```typescript
interface ConfirmModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
}

export default function ConfirmModal({ open, onConfirm, onCancel, title, message }: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full">
        <h2 className="font-semibold text-lg text-text">{title}</h2>
        <p className="text-text-secondary mt-2">{message}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-border rounded-xl px-6 py-3 font-medium text-text"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 bg-amber text-white rounded-xl px-6 py-3 font-medium"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
```

## File: src/components/ui/EmptyState.tsx
```typescript
import { ClipboardX, PackageX, Wrench, FileSearch, Inbox } from 'lucide-react';

type EmptyType = 'workorders' | 'inventory' | 'alerts' | 'reports' | 'search' | 'generic';

interface EmptyStateProps {
  type?: EmptyType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const ICONS: Record<EmptyType, React.ReactNode> = {
  workorders: <Wrench size={48} strokeWidth={1.5} />,
  inventory: <PackageX size={48} strokeWidth={1.5} />,
  alerts: <Inbox size={48} strokeWidth={1.5} />,
  reports: <ClipboardX size={48} strokeWidth={1.5} />,
  search: <FileSearch size={48} strokeWidth={1.5} />,
  generic: <Inbox size={48} strokeWidth={1.5} />,
};

export default function EmptyState({ type = 'generic', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
        {ICONS[type]}
      </div>
      <h3 className="text-lg font-semibold text-text mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-text-secondary max-w-xs mb-4">{description}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="px-5 py-2.5 bg-amber text-white rounded-xl text-sm font-medium btn-press"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
```

## File: src/components/ui/EquipmentCard.tsx
```typescript
import type { Equipment } from '../../types/equipment';
import { getNextPM } from '../../data/pm-rules';
import StatusDot from './StatusDot';

interface EquipmentCardProps {
  equipment: Equipment;
}

const STATUS_BORDER_COLOR: Record<Equipment['status'], string> = {
  operativo: '#16A34A',
  alerta: '#F59E0B',
  taller: '#DC2626',
  inactivo: '#9CA3AF',
};

function getPMBadgeClass(hoursRemaining: number): string {
  if (hoursRemaining <= 0) return 'bg-critical text-white';
  if (hoursRemaining < 50) return 'bg-warning text-white';
  return 'bg-success text-white';
}

export default function EquipmentCard({ equipment }: EquipmentCardProps) {
  const pm = getNextPM(equipment.model, equipment.current_horometro);
  const borderColor = STATUS_BORDER_COLOR[equipment.status];

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-border overflow-hidden"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="p-4 flex flex-col gap-2">
        {/* Row 1: status dot + unit_id + model */}
        <div className="flex items-center gap-2">
          <StatusDot status={equipment.status} />
          <span className="text-lg font-bold text-text leading-none">{equipment.unit_id}</span>
          <span className="text-sm text-text-secondary ml-1 leading-none">{equipment.model}</span>
        </div>

        {/* Row 2: horometro info */}
        <div className="flex flex-col gap-0.5 text-sm text-text-secondary">
          <span>Horómetro: <span className="text-text font-medium">{equipment.current_horometro} hrs</span></span>
          <span>Próximo: <span className="text-text font-medium">{equipment.next_pm_level}</span> a <span className="text-text font-medium">{equipment.next_pm_horometro} hrs</span></span>
        </div>

        {/* PM countdown badge */}
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getPMBadgeClass(pm.hours_remaining)}`}
          >
            {pm.hours_remaining <= 0
              ? `${pm.level} vencido`
              : `${pm.hours_remaining} hrs para ${pm.level}`}
          </span>
        </div>
      </div>
    </div>
  );
}
```

## File: src/components/ui/KPICard.tsx
```typescript
interface KPICardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
}

export default function KPICard({ icon, value, label, color }: KPICardProps) {
  return (
    <div className="bg-card rounded-xl shadow-sm p-4 border border-border flex items-center gap-3 flex-1">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        <span className="text-white flex items-center justify-center">{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-text leading-none">{value}</p>
        <p className="text-sm text-text-secondary mt-0.5">{label}</p>
      </div>
    </div>
  );
}
```

## File: src/components/ui/OfflineBanner.tsx
```typescript
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;
  return (
    <div className="fixed top-16 left-0 right-0 z-40 bg-gray-600 text-white text-center py-2 text-sm flex items-center justify-center gap-2">
      <WifiOff size={16} />
      Sin conexión — datos en cola
    </div>
  );
}
```

## File: src/components/ui/PhotoCapture.tsx
```typescript
import { useRef } from 'react';
import { Camera, X } from 'lucide-react';

interface PhotoItem {
  file: File;
  preview: string;
}

interface PhotoCaptureProps {
  onCapture: (file: File) => void;
  photos: PhotoItem[];
  onRemove: (index: number) => void;
  multiple?: boolean;
}

export default function PhotoCapture({ onCapture, photos, onRemove, multiple = false }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    onCapture(file);
    e.target.value = '';
  }

  const showButton = multiple || photos.length === 0;

  return (
    <div className="flex flex-col gap-2">
      {showButton && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 border border-amber text-amber rounded-xl px-4 py-2 font-medium text-sm w-fit"
        >
          <Camera size={18} />
          Agregar foto
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      {photos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {photos.map((photo, index) => (
            <div key={index} className="relative w-20 h-20">
              <img
                src={photo.preview}
                alt={`Foto ${index + 1}`}
                className="w-20 h-20 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## File: src/components/ui/PullIndicator.tsx
```typescript
import { RefreshCw } from 'lucide-react';

interface PullIndicatorProps {
  pullDistance: number;
  refreshing: boolean;
  isReady: boolean;
  style: React.CSSProperties;
}

export default function PullIndicator({ pullDistance, refreshing, isReady, style }: PullIndicatorProps) {
  if (pullDistance <= 0 && !refreshing) return null;

  return (
    <div
      className="flex items-center justify-center"
      style={style}
    >
      <RefreshCw
        size={20}
        className={`text-text-secondary transition-transform ${
          refreshing ? 'animate-spin' : ''
        }`}
        style={{
          transform: refreshing ? undefined : `rotate(${Math.min(pullDistance * 3, 360)}deg)`,
          opacity: Math.min(pullDistance / 60, 1),
        }}
      />
      {isReady && !refreshing && (
        <span className="ml-2 text-xs text-text-secondary">Soltar para actualizar</span>
      )}
      {refreshing && (
        <span className="ml-2 text-xs text-text-secondary">Actualizando...</span>
      )}
    </div>
  );
}
```

## File: src/components/ui/Skeleton.tsx
```typescript
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-border">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="flex-1">
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function SkeletonKPI() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-border">
      <Skeleton className="h-3 w-16 mb-3" />
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
```

## File: src/components/ui/StatusDot.tsx
```typescript
interface StatusDotProps {
  status: 'operativo' | 'alerta' | 'taller' | 'inactivo';
}

const STATUS_CLASSES: Record<StatusDotProps['status'], string> = {
  operativo: 'bg-success',
  alerta: 'bg-warning animate-pulse-dot',
  taller: 'bg-critical',
  inactivo: 'bg-gray-400',
};

export default function StatusDot({ status }: StatusDotProps) {
  return (
    <span
      className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${STATUS_CLASSES[status]}`}
    />
  );
}
```

## File: src/data/dvir-systems.ts
```typescript
import type { DVIRSystem } from '../types/dvir';

export const DVIR_SYSTEMS: DVIRSystem[] = [
  { id: 'motor', label: 'Motor', icon: 'Cog' },
  { id: 'transmision', label: 'Transmisión', icon: 'Settings' },
  { id: 'frenos', label: 'Frenos', icon: 'CircleStop' },
  { id: 'direccion', label: 'Dirección', icon: 'Navigation' },
  { id: 'hidraulico', label: 'Hidráulico', icon: 'Droplets' },
  { id: 'electrico', label: 'Eléctrico', icon: 'Zap' },
  { id: 'neumaticos', label: 'Neumáticos', icon: 'Circle' },
  { id: 'estructura', label: 'Estructura', icon: 'Box' },
  { id: 'luces', label: 'Luces', icon: 'Lightbulb' },
  { id: 'fluidos', label: 'Fluidos', icon: 'Beaker' },
  { id: 'cabina', label: 'Cabina', icon: 'LayoutDashboard' },
  { id: 'tren_rodaje', label: 'Tren de Rodaje', icon: 'Footprints' },
];
```

## File: src/data/equipment-catalog.ts
```typescript
import type { Equipment } from '../types/equipment';

export const EQUIPMENT_CATALOG: Equipment[] = [
  // Bulldozers - Komatsu D65EX-16
  {
    unit_id: 'EPTK-07',
    model: 'Komatsu D65EX-16',
    type: 'Bulldozer',
    client: 'GTP',
    status: 'operativo',
    current_horometro: 3240,
    next_pm_level: 'PM-2',
    next_pm_horometro: 3500,
    last_inspection_date: '2026-04-01',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Luis Mendoza',
  },

  // Bulldozers - Komatsu D155AX-6
  {
    unit_id: 'EPTK-08',
    model: 'Komatsu D155AX-6',
    type: 'Bulldozer',
    client: 'GTP',
    status: 'operativo',
    current_horometro: 5120,
    next_pm_level: 'PM-3',
    next_pm_horometro: 5500,
    last_inspection_date: '2026-04-01',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Marco Pérez',
  },
  {
    unit_id: 'EPTK-09',
    model: 'Komatsu D155AX-6',
    type: 'Bulldozer',
    client: 'GTP',
    status: 'alerta',
    current_horometro: 4875,
    next_pm_level: 'PM-3',
    next_pm_horometro: 5000,
    last_inspection_date: '2026-03-30',
    last_inspection_result: 'condicional',
    assigned_operator: 'Andrés Castillo',
  },
  {
    unit_id: 'EPTK-10',
    model: 'Komatsu D155AX-6',
    type: 'Bulldozer',
    client: 'GTP',
    status: 'operativo',
    current_horometro: 6300,
    next_pm_level: 'PM-4',
    next_pm_horometro: 6500,
    last_inspection_date: '2026-04-02',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Roberto Silva',
  },
  {
    unit_id: 'EPTK-11',
    model: 'Komatsu D155AX-6',
    type: 'Bulldozer',
    client: 'GTP',
    status: 'operativo',
    current_horometro: 2980,
    next_pm_level: 'PM-2',
    next_pm_horometro: 3000,
    last_inspection_date: '2026-04-03',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Héctor Vargas',
  },
  {
    unit_id: 'EPTK-12',
    model: 'Komatsu D155AX-6',
    type: 'Bulldozer',
    client: 'GTP',
    status: 'inactivo',
    current_horometro: 7840,
    next_pm_level: 'PM-4',
    next_pm_horometro: 8000,
    last_inspection_date: '2026-03-25',
    last_inspection_result: 'reprobado',
    assigned_operator: 'Sin asignar',
  },

  // Camiones Articulados - Komatsu HM400-3
  {
    unit_id: 'EPAK-02',
    model: 'Komatsu HM400-3',
    type: 'Camión Articulado',
    client: 'GTP',
    status: 'operativo',
    current_horometro: 9120,
    next_pm_level: 'PM-4',
    next_pm_horometro: 10000,
    last_inspection_date: '2026-04-04',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Carlos Torres',
  },

  // Camiones Articulados - CAT 740B
  {
    unit_id: 'EPAK-06',
    model: 'CAT 740B',
    type: 'Camión Articulado',
    client: 'GTP',
    status: 'operativo',
    current_horometro: 11450,
    next_pm_level: 'PM-5',
    next_pm_horometro: 12000,
    last_inspection_date: '2026-04-03',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Miguel Ángel Ruiz',
  },
  {
    unit_id: 'EPAK-07',
    model: 'CAT 740B',
    type: 'Camión Articulado',
    client: 'GTP',
    status: 'alerta',
    current_horometro: 7820,
    next_pm_level: 'PM-3',
    next_pm_horometro: 8000,
    last_inspection_date: '2026-04-03',
    last_inspection_result: 'condicional',
    assigned_operator: 'Juan Carlos Flores',
  },
  {
    unit_id: 'EPAK-08',
    model: 'CAT 740B',
    type: 'Camión Articulado',
    client: 'GTP',
    status: 'operativo',
    current_horometro: 5340,
    next_pm_level: 'PM-3',
    next_pm_horometro: 5500,
    last_inspection_date: '2026-04-02',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Fernando Medina',
  },

  // Camión Articulado - Komatsu HM400-3 (taller)
  {
    unit_id: 'EPAK-09',
    model: 'Komatsu HM400-3',
    type: 'Camión Articulado',
    client: 'GTP',
    status: 'taller',
    current_horometro: 8450,
    next_pm_level: 'PM-3',
    next_pm_horometro: 8500,
    last_inspection_date: '2026-04-04',
    last_inspection_result: 'reprobado',
    assigned_operator: 'Sin asignar',
  },

  // More CAT 740B
  {
    unit_id: 'EPAK-11',
    model: 'CAT 740B',
    type: 'Camión Articulado',
    client: 'GTP',
    status: 'operativo',
    current_horometro: 6780,
    next_pm_level: 'PM-3',
    next_pm_horometro: 7000,
    last_inspection_date: '2026-04-01',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Arturo Blanco',
  },
  {
    unit_id: 'EPAK-12',
    model: 'CAT 740B',
    type: 'Camión Articulado',
    client: 'GTP',
    status: 'operativo',
    current_horometro: 4120,
    next_pm_level: 'PM-2',
    next_pm_horometro: 4500,
    last_inspection_date: '2026-04-02',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Óscar Jiménez',
  },
  {
    unit_id: 'EPAK-13',
    model: 'CAT 740B',
    type: 'Camión Articulado',
    client: 'GTP',
    status: 'operativo',
    current_horometro: 3560,
    next_pm_level: 'PM-2',
    next_pm_horometro: 4000,
    last_inspection_date: '2026-04-03',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Ramón Espinoza',
  },

  // Cargadores - Doosan DL420A
  {
    unit_id: 'EPCF-08',
    model: 'Doosan DL420A',
    type: 'Cargador',
    client: 'GTP',
    status: 'operativo',
    current_horometro: 4230,
    next_pm_level: 'PM-3',
    next_pm_horometro: 4500,
    last_inspection_date: '2026-04-02',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Antonio Guerrero',
  },
  {
    unit_id: 'EPCF-09',
    model: 'Doosan DL420A',
    type: 'Cargador',
    client: 'GTP',
    status: 'operativo',
    current_horometro: 2890,
    next_pm_level: 'PM-2',
    next_pm_horometro: 3000,
    last_inspection_date: '2026-04-01',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Ernesto Campos',
  },
  {
    unit_id: 'EPCF-10',
    model: 'Doosan DL420A',
    type: 'Cargador',
    client: 'GTP',
    status: 'alerta',
    current_horometro: 6120,
    next_pm_level: 'PM-3',
    next_pm_horometro: 6250,
    last_inspection_date: '2026-04-03',
    last_inspection_result: 'condicional',
    assigned_operator: 'Víctor Morales',
  },

  // Excavadoras - Doosan DX340LC
  {
    unit_id: 'EPEX-27',
    model: 'Doosan DX340LC',
    type: 'Excavadora',
    client: 'GTP',
    status: 'taller',
    current_horometro: 7640,
    next_pm_level: 'PM-4',
    next_pm_horometro: 8000,
    last_inspection_date: '2026-04-04',
    last_inspection_result: 'reprobado',
    assigned_operator: 'Sin asignar',
  },
  {
    unit_id: 'EPEX-28',
    model: 'Doosan DX340LC',
    type: 'Excavadora',
    client: 'GTP',
    status: 'operativo',
    current_horometro: 5430,
    next_pm_level: 'PM-3',
    next_pm_horometro: 5500,
    last_inspection_date: '2026-04-02',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Guillermo Santos',
  },

  // Excavadoras - Doosan DX225LC
  {
    unit_id: 'EPEX-29',
    model: 'Doosan DX225LC',
    type: 'Excavadora',
    client: 'GTP',
    status: 'operativo',
    current_horometro: 3780,
    next_pm_level: 'PM-2',
    next_pm_horometro: 4000,
    last_inspection_date: '2026-04-03',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Benjamín Cruz',
  },
  {
    unit_id: 'EPEX-30',
    model: 'Doosan DX225LC',
    type: 'Excavadora',
    client: 'GTP',
    status: 'operativo',
    current_horometro: 2450,
    next_pm_level: 'PM-2',
    next_pm_horometro: 2500,
    last_inspection_date: '2026-04-01',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Salvador Romero',
  },

  // Excavadora - Doosan DX360LCA
  {
    unit_id: 'EX206',
    model: 'Doosan DX360LCA',
    type: 'Excavadora',
    client: 'GTP',
    status: 'operativo',
    current_horometro: 1890,
    next_pm_level: 'PM-1',
    next_pm_horometro: 2000,
    last_inspection_date: '2026-04-04',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Rodrigo Navarro',
  },

  // Camiones Pesados - Mack GR84B 8x4 (ULTRATK-01 through ULTRATK-10)
  {
    unit_id: 'ULTRATK-01',
    model: 'Mack GR84B 8x4',
    type: 'Camión Pesado',
    client: 'ULTRATK',
    status: 'operativo',
    current_horometro: 12450,
    next_pm_level: 'PM-4',
    next_pm_horometro: 13000,
    last_inspection_date: '2026-04-04',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Diego Herrera',
  },
  {
    unit_id: 'ULTRATK-02',
    model: 'Mack GR84B 8x4',
    type: 'Camión Pesado',
    client: 'ULTRATK',
    status: 'operativo',
    current_horometro: 9870,
    next_pm_level: 'PM-4',
    next_pm_horometro: 10000,
    last_inspection_date: '2026-04-03',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Alberto Ramos',
  },
  {
    unit_id: 'ULTRATK-03',
    model: 'Mack GR84B 8x4',
    type: 'Camión Pesado',
    client: 'ULTRATK',
    status: 'operativo',
    current_horometro: 15230,
    next_pm_level: 'PM-5',
    next_pm_horometro: 16000,
    last_inspection_date: '2026-04-02',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Ignacio Paredes',
  },
  {
    unit_id: 'ULTRATK-04',
    model: 'Mack GR84B 8x4',
    type: 'Camión Pesado',
    client: 'ULTRATK',
    status: 'alerta',
    current_horometro: 7920,
    next_pm_level: 'PM-3',
    next_pm_horometro: 8000,
    last_inspection_date: '2026-04-04',
    last_inspection_result: 'condicional',
    assigned_operator: 'Nicolás Aguilar',
  },
  {
    unit_id: 'ULTRATK-05',
    model: 'Mack GR84B 8x4',
    type: 'Camión Pesado',
    client: 'ULTRATK',
    status: 'operativo',
    current_horometro: 6340,
    next_pm_level: 'PM-3',
    next_pm_horometro: 6500,
    last_inspection_date: '2026-04-01',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Sergio Luna',
  },
  {
    unit_id: 'ULTRATK-06',
    model: 'Mack GR84B 8x4',
    type: 'Camión Pesado',
    client: 'ULTRATK',
    status: 'operativo',
    current_horometro: 11780,
    next_pm_level: 'PM-4',
    next_pm_horometro: 12000,
    last_inspection_date: '2026-04-03',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Mauricio Vega',
  },
  {
    unit_id: 'ULTRATK-07',
    model: 'Mack GR84B 8x4',
    type: 'Camión Pesado',
    client: 'ULTRATK',
    status: 'operativo',
    current_horometro: 4560,
    next_pm_level: 'PM-3',
    next_pm_horometro: 5000,
    last_inspection_date: '2026-04-02',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Cristian Delgado',
  },
  {
    unit_id: 'ULTRATK-08',
    model: 'Mack GR84B 8x4',
    type: 'Camión Pesado',
    client: 'ULTRATK',
    status: 'taller',
    current_horometro: 18340,
    next_pm_level: 'PM-5',
    next_pm_horometro: 18500,
    last_inspection_date: '2026-04-04',
    last_inspection_result: 'reprobado',
    assigned_operator: 'Sin asignar',
  },
  {
    unit_id: 'ULTRATK-09',
    model: 'Mack GR84B 8x4',
    type: 'Camión Pesado',
    client: 'ULTRATK',
    status: 'operativo',
    current_horometro: 3210,
    next_pm_level: 'PM-2',
    next_pm_horometro: 3500,
    last_inspection_date: '2026-04-01',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Javier Soto',
  },
  {
    unit_id: 'ULTRATK-10',
    model: 'Mack GR84B 8x4',
    type: 'Camión Pesado',
    client: 'ULTRATK',
    status: 'operativo',
    current_horometro: 8760,
    next_pm_level: 'PM-3',
    next_pm_horometro: 9000,
    last_inspection_date: '2026-04-03',
    last_inspection_result: 'aprobado',
    assigned_operator: 'Pablo Ríos',
  },
];

export function getEquipmentById(id: string): Equipment | undefined {
  return EQUIPMENT_CATALOG.find((e) => e.unit_id === id);
}
```

## File: src/data/pm-parts-catalog.ts
```typescript
/**
 * PM Parts Catalog — maps (brand, PM level) to required consumables.
 *
 * Each PM level is CUMULATIVE: PM-2 includes PM-1 tasks, PM-3 includes PM-1+PM-2, etc.
 * The catalog stores the INCREMENTAL parts for each level; the page accumulates them.
 *
 * Real OEM part numbers from the fleet workshop manuals.
 */

export interface PMPart {
  partNumber: string;
  description: string;
  quantity: number;
  unit: string; // 'pz', 'L', 'kg'
  category: 'Filtro' | 'Aceite' | 'Grasa' | 'Correa' | 'Refrigerante' | 'Otro';
}

export interface PMPartsKit {
  level: string;
  estimatedHours: number;
  parts: PMPart[];
}

// ─── Komatsu D65EX / D155AX ────────────────────────────────────────────────

const KOMATSU_BULLDOZER: PMPartsKit[] = [
  {
    level: 'PM-1',
    estimatedHours: 3,
    parts: [
      { partNumber: '600-211-5240', description: 'Filtro Aceite Motor', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '600-319-5610', description: 'Filtro Combustible Primario', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '600-311-3750', description: 'Filtro Combustible Secundario', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'SHELL-RIM-15W40', description: 'Aceite Motor 15W-40 (cambio)', quantity: 38, unit: 'L', category: 'Aceite' },
      { partNumber: 'GRASA-EP2-MULTI', description: 'Grasa EP2 Multipropósito', quantity: 5, unit: 'kg', category: 'Grasa' },
    ],
  },
  {
    level: 'PM-2',
    estimatedHours: 5,
    parts: [
      { partNumber: '207-60-71181', description: 'Filtro Hidráulico Principal', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '20Y-60-31171', description: 'Filtro Hidráulico Retorno', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '600-185-4100', description: 'Filtro de Aire Exterior', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'HYD-ISO46', description: 'Aceite Hidráulico ISO 46 (rellenar)', quantity: 20, unit: 'L', category: 'Aceite' },
    ],
  },
  {
    level: 'PM-3',
    estimatedHours: 8,
    parts: [
      { partNumber: '600-185-4110', description: 'Filtro de Aire Interior', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'TO30-SAE90', description: 'Aceite Transmisión SAE 90 (cambio)', quantity: 25, unit: 'L', category: 'Aceite' },
      { partNumber: 'COOL-AF-PREMIX', description: 'Refrigerante AF Premezclado', quantity: 15, unit: 'L', category: 'Refrigerante' },
    ],
  },
  {
    level: 'PM-4',
    estimatedHours: 12,
    parts: [
      { partNumber: 'FINAL-DRIVE-OIL', description: 'Aceite Mando Final SAE 90', quantity: 16, unit: 'L', category: 'Aceite' },
      { partNumber: 'HYD-ISO46-FULL', description: 'Aceite Hidráulico ISO 46 (cambio completo)', quantity: 80, unit: 'L', category: 'Aceite' },
      { partNumber: 'CORR-ALT-D155', description: 'Correa Alternador', quantity: 1, unit: 'pz', category: 'Correa' },
      { partNumber: 'CORR-AC-D155', description: 'Correa A/C', quantity: 1, unit: 'pz', category: 'Correa' },
    ],
  },
  {
    level: 'PM-5',
    estimatedHours: 16,
    parts: [
      { partNumber: 'TURBO-SEAL-KIT', description: 'Kit Sellos Turbocompresor', quantity: 1, unit: 'pz', category: 'Otro' },
      { partNumber: 'INJ-SEAL-KIT-6', description: 'Kit Sellos Inyectores (6 cil)', quantity: 1, unit: 'pz', category: 'Otro' },
      { partNumber: 'VALVE-ADJ-KIT', description: 'Kit Ajuste Válvulas', quantity: 1, unit: 'pz', category: 'Otro' },
    ],
  },
];

// ─── Komatsu HM400-3 ───────────────────────────────────────────────────────

const KOMATSU_HM400: PMPartsKit[] = [
  {
    level: 'PM-1',
    estimatedHours: 3,
    parts: [
      { partNumber: '600-211-5241', description: 'Filtro Aceite Motor', quantity: 2, unit: 'pz', category: 'Filtro' },
      { partNumber: '600-319-5611', description: 'Filtro Combustible Primario', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '600-311-3751', description: 'Filtro Combustible Secundario', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'SHELL-RIM-15W40', description: 'Aceite Motor 15W-40 (cambio)', quantity: 42, unit: 'L', category: 'Aceite' },
      { partNumber: 'GRASA-EP2-MULTI', description: 'Grasa EP2 Multipropósito', quantity: 8, unit: 'kg', category: 'Grasa' },
    ],
  },
  {
    level: 'PM-2',
    estimatedHours: 6,
    parts: [
      { partNumber: '56B-60-11430', description: 'Filtro Hidráulico de Alta Presión', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '56B-60-21410', description: 'Filtro Hidráulico de Retorno', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '600-185-5100', description: 'Filtro de Aire Exterior', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'HYD-ISO46', description: 'Aceite Hidráulico ISO 46 (rellenar)', quantity: 25, unit: 'L', category: 'Aceite' },
    ],
  },
  {
    level: 'PM-3',
    estimatedHours: 8,
    parts: [
      { partNumber: '600-185-5110', description: 'Filtro de Aire Interior', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'TRANS-OIL-HM400', description: 'Aceite Transmisión (cambio)', quantity: 30, unit: 'L', category: 'Aceite' },
      { partNumber: 'DIFF-OIL-HM400', description: 'Aceite Diferenciales (cambio)', quantity: 24, unit: 'L', category: 'Aceite' },
      { partNumber: 'COOL-AF-PREMIX', description: 'Refrigerante AF Premezclado', quantity: 20, unit: 'L', category: 'Refrigerante' },
    ],
  },
  {
    level: 'PM-4',
    estimatedHours: 14,
    parts: [
      { partNumber: 'HYD-ISO46-FULL', description: 'Aceite Hidráulico ISO 46 (cambio completo)', quantity: 110, unit: 'L', category: 'Aceite' },
      { partNumber: 'CORR-ALT-HM400', description: 'Correa Alternador', quantity: 1, unit: 'pz', category: 'Correa' },
      { partNumber: 'CORR-FAN-HM400', description: 'Correa Ventilador', quantity: 1, unit: 'pz', category: 'Correa' },
    ],
  },
  {
    level: 'PM-5',
    estimatedHours: 18,
    parts: [
      { partNumber: 'INJ-SEAL-KIT-6', description: 'Kit Sellos Inyectores (6 cil)', quantity: 1, unit: 'pz', category: 'Otro' },
      { partNumber: 'VALVE-ADJ-KIT', description: 'Kit Ajuste Válvulas', quantity: 1, unit: 'pz', category: 'Otro' },
      { partNumber: 'SUSP-BUSH-KIT', description: 'Kit Bujes Suspensión', quantity: 1, unit: 'pz', category: 'Otro' },
    ],
  },
];

// ─── CAT 740B ───────────────────────────────────────────────────────────────

const CAT_740B: PMPartsKit[] = [
  {
    level: 'PM-1',
    estimatedHours: 3,
    parts: [
      { partNumber: '1R-0739', description: 'Filtro Aceite Motor CAT', quantity: 2, unit: 'pz', category: 'Filtro' },
      { partNumber: '1R-0749', description: 'Filtro Combustible CAT', quantity: 2, unit: 'pz', category: 'Filtro' },
      { partNumber: '326-1644', description: 'Separador Agua/Combustible', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'CAT-DEO-15W40', description: 'Aceite Motor CAT DEO 15W-40', quantity: 40, unit: 'L', category: 'Aceite' },
      { partNumber: 'GRASA-EP2-MULTI', description: 'Grasa EP2 Multipropósito', quantity: 8, unit: 'kg', category: 'Grasa' },
    ],
  },
  {
    level: 'PM-2',
    estimatedHours: 6,
    parts: [
      { partNumber: '093-7521', description: 'Filtro Hidráulico CAT', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '9X-6999', description: 'Filtro Piloto Hidráulico', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '6I-2503', description: 'Filtro de Aire Primario', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'CAT-HYDO-10', description: 'Aceite Hidráulico CAT HYDO (rellenar)', quantity: 25, unit: 'L', category: 'Aceite' },
    ],
  },
  {
    level: 'PM-3',
    estimatedHours: 8,
    parts: [
      { partNumber: '6I-2504', description: 'Filtro de Aire Secundario', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'CAT-TDTO-30', description: 'Aceite Transmisión CAT TDTO (cambio)', quantity: 28, unit: 'L', category: 'Aceite' },
      { partNumber: 'CAT-FDAO', description: 'Aceite Diferenciales CAT FDAO', quantity: 22, unit: 'L', category: 'Aceite' },
      { partNumber: 'CAT-ELC-COOLANT', description: 'Refrigerante CAT ELC', quantity: 18, unit: 'L', category: 'Refrigerante' },
    ],
  },
  {
    level: 'PM-4',
    estimatedHours: 14,
    parts: [
      { partNumber: 'CAT-HYDO-FULL', description: 'Aceite Hidráulico CAT HYDO (cambio completo)', quantity: 100, unit: 'L', category: 'Aceite' },
      { partNumber: '7C-8632', description: 'Correa Alternador CAT', quantity: 1, unit: 'pz', category: 'Correa' },
      { partNumber: '7C-7838', description: 'Correa A/C CAT', quantity: 1, unit: 'pz', category: 'Correa' },
    ],
  },
  {
    level: 'PM-5',
    estimatedHours: 18,
    parts: [
      { partNumber: '10R-7225', description: 'Kit Inyectores HEUI (6 cil)', quantity: 1, unit: 'pz', category: 'Otro' },
      { partNumber: 'VALVE-ADJ-C15', description: 'Kit Ajuste Válvulas C15', quantity: 1, unit: 'pz', category: 'Otro' },
    ],
  },
];

// ─── Doosan DL420A / DX340LC / DX225LC / DX360LCA ─────────────────────────

const DOOSAN: PMPartsKit[] = [
  {
    level: 'PM-1',
    estimatedHours: 3,
    parts: [
      { partNumber: 'K9002605', description: 'Filtro Aceite Motor Doosan', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '400504-00115', description: 'Filtro Combustible Primario', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '400504-00217', description: 'Filtro Combustible Secundario', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'SHELL-RIM-15W40', description: 'Aceite Motor 15W-40 (cambio)', quantity: 28, unit: 'L', category: 'Aceite' },
      { partNumber: 'GRASA-EP2-MULTI', description: 'Grasa EP2 Multipropósito', quantity: 5, unit: 'kg', category: 'Grasa' },
    ],
  },
  {
    level: 'PM-2',
    estimatedHours: 5,
    parts: [
      { partNumber: 'K1050009', description: 'Filtro Hidráulico Alta Presión', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'K1039559', description: 'Filtro Hidráulico Retorno', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'K1028659', description: 'Filtro de Aire Exterior', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'HYD-ISO46', description: 'Aceite Hidráulico ISO 46 (rellenar)', quantity: 20, unit: 'L', category: 'Aceite' },
    ],
  },
  {
    level: 'PM-3',
    estimatedHours: 8,
    parts: [
      { partNumber: 'K1028660', description: 'Filtro de Aire Interior', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'TRANS-OIL-DOOSAN', description: 'Aceite Transmisión (cambio)', quantity: 22, unit: 'L', category: 'Aceite' },
      { partNumber: 'COOL-AF-PREMIX', description: 'Refrigerante AF Premezclado', quantity: 15, unit: 'L', category: 'Refrigerante' },
    ],
  },
  {
    level: 'PM-4',
    estimatedHours: 12,
    parts: [
      { partNumber: 'HYD-ISO46-FULL', description: 'Aceite Hidráulico ISO 46 (cambio completo)', quantity: 90, unit: 'L', category: 'Aceite' },
      { partNumber: 'K9002983', description: 'Correa Alternador Doosan', quantity: 1, unit: 'pz', category: 'Correa' },
    ],
  },
  {
    level: 'PM-5',
    estimatedHours: 16,
    parts: [
      { partNumber: 'INJ-SEAL-DOOSAN', description: 'Kit Sellos Inyectores', quantity: 1, unit: 'pz', category: 'Otro' },
      { partNumber: 'VALVE-ADJ-DOOSAN', description: 'Kit Ajuste Válvulas', quantity: 1, unit: 'pz', category: 'Otro' },
    ],
  },
];

// ─── Mack GR84B 8x4 ────────────────────────────────────────────────────────

const MACK: PMPartsKit[] = [
  {
    level: 'PM-1',
    estimatedHours: 2,
    parts: [
      { partNumber: '21893456', description: 'Filtro Aceite Motor Mack', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '22480372', description: 'Filtro Combustible Mack', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '22116209', description: 'Separador Agua/Combustible', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'MACK-EOS-15W40', description: 'Aceite Motor Mack EOS 15W-40', quantity: 36, unit: 'L', category: 'Aceite' },
      { partNumber: 'GRASA-EP2-MULTI', description: 'Grasa EP2 Multipropósito', quantity: 3, unit: 'kg', category: 'Grasa' },
    ],
  },
  {
    level: 'PM-2',
    estimatedHours: 4,
    parts: [
      { partNumber: '21879886', description: 'Filtro de Aire Primario Mack', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: '85114088', description: 'Filtro Dirección Hidráulica', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'MACK-PS-ATF', description: 'Aceite Dirección Hidráulica ATF', quantity: 4, unit: 'L', category: 'Aceite' },
    ],
  },
  {
    level: 'PM-3',
    estimatedHours: 6,
    parts: [
      { partNumber: '21879887', description: 'Filtro de Aire Secundario Mack', quantity: 1, unit: 'pz', category: 'Filtro' },
      { partNumber: 'MACK-TRANS-OIL', description: 'Aceite Transmisión Mack (cambio)', quantity: 16, unit: 'L', category: 'Aceite' },
      { partNumber: 'MACK-DIFF-OIL', description: 'Aceite Diferenciales Mack (cambio)', quantity: 20, unit: 'L', category: 'Aceite' },
      { partNumber: 'MACK-ELC-COOL', description: 'Refrigerante Mack ELC', quantity: 35, unit: 'L', category: 'Refrigerante' },
    ],
  },
  {
    level: 'PM-4',
    estimatedHours: 10,
    parts: [
      { partNumber: '21086811', description: 'Correa Serpentina Mack', quantity: 1, unit: 'pz', category: 'Correa' },
      { partNumber: '23532720', description: 'Tensor Correa Mack', quantity: 1, unit: 'pz', category: 'Otro' },
      { partNumber: '85135554', description: 'Filtro Secador Aire Mack', quantity: 1, unit: 'pz', category: 'Filtro' },
    ],
  },
  {
    level: 'PM-5',
    estimatedHours: 14,
    parts: [
      { partNumber: 'MACK-INJ-KIT-6', description: 'Kit Inyectores MDEG (6 cil)', quantity: 1, unit: 'pz', category: 'Otro' },
      { partNumber: 'MACK-VALVE-ADJ', description: 'Kit Ajuste Válvulas', quantity: 1, unit: 'pz', category: 'Otro' },
      { partNumber: 'MACK-CLUTCH-KIT', description: 'Kit Embrague (inspección)', quantity: 1, unit: 'pz', category: 'Otro' },
    ],
  },
];

// ─── Lookup ─────────────────────────────────────────────────────────────────

const MODEL_CATALOG: Record<string, PMPartsKit[]> = {
  'Komatsu D65EX-16': KOMATSU_BULLDOZER,
  'Komatsu D155AX-6': KOMATSU_BULLDOZER,
  'Komatsu HM400-3': KOMATSU_HM400,
  'CAT 740B': CAT_740B,
  'Doosan DL420A': DOOSAN,
  'Doosan DX340LC': DOOSAN,
  'Doosan DX225LC': DOOSAN,
  'Doosan DX360LCA': DOOSAN,
  'Mack GR84B 8x4': MACK,
};

/**
 * Returns the CUMULATIVE parts list for a given model and PM level.
 * PM-3 includes PM-1 + PM-2 + PM-3 parts.
 */
export function getCumulativePMParts(model: string, targetLevel: string): {
  parts: PMPart[];
  totalEstimatedHours: number;
  levelsIncluded: string[];
} {
  const kits = MODEL_CATALOG[model];
  if (!kits) return { parts: [], totalEstimatedHours: 0, levelsIncluded: [] };

  const targetIndex = kits.findIndex((k) => k.level === targetLevel);
  if (targetIndex < 0) return { parts: [], totalEstimatedHours: 0, levelsIncluded: [] };

  const accumulated: PMPart[] = [];
  const levelsIncluded: string[] = [];
  let totalHours = 0;

  for (let i = 0; i <= targetIndex; i++) {
    const kit = kits[i];
    levelsIncluded.push(kit.level);
    totalHours += kit.estimatedHours;
    accumulated.push(...kit.parts);
  }

  return { parts: accumulated, totalEstimatedHours: totalHours, levelsIncluded };
}

/**
 * Returns all available PM levels for a model.
 */
export function getAvailablePMLevels(model: string): string[] {
  const kits = MODEL_CATALOG[model];
  if (!kits) return [];
  return kits.map((k) => k.level);
}
```

## File: src/data/pm-rules.ts
```typescript
const KOMATSU_CAT_DOOSAN_THRESHOLDS: Record<string, number> = {
  'PM-1': 250,
  'PM-2': 500,
  'PM-3': 1000,
  'PM-4': 2000,
  'PM-5': 4000,
};

const MACK_THRESHOLDS: Record<string, number> = {
  'PM-1': 100,
  'PM-2': 250,
  'PM-3': 500,
  'PM-4': 1000,
  'PM-5': 2000,
};

export const PM_THRESHOLDS: Record<string, Record<string, number>> = {
  Komatsu: KOMATSU_CAT_DOOSAN_THRESHOLDS,
  CAT: KOMATSU_CAT_DOOSAN_THRESHOLDS,
  Doosan: KOMATSU_CAT_DOOSAN_THRESHOLDS,
  Mack: MACK_THRESHOLDS,
};

function getBrandThresholds(model: string): Record<string, number> {
  if (model.startsWith('Mack')) return MACK_THRESHOLDS;
  if (model.startsWith('Komatsu') || model.startsWith('CAT') || model.startsWith('Doosan')) {
    return KOMATSU_CAT_DOOSAN_THRESHOLDS;
  }
  return KOMATSU_CAT_DOOSAN_THRESHOLDS;
}

export function getNextPM(
  model: string,
  currentHours: number
): { level: string; due_at: number; hours_remaining: number } {
  const thresholds = getBrandThresholds(model);
  const levels = Object.keys(thresholds).sort(
    (a, b) => thresholds[a] - thresholds[b]
  );

  for (const level of levels) {
    const interval = thresholds[level];
    const cyclePosition = currentHours % interval;
    const due_at = currentHours - cyclePosition + interval;
    const hours_remaining = due_at - currentHours;

    if (hours_remaining <= interval * 0.2 || hours_remaining <= 50) {
      return { level, due_at, hours_remaining };
    }
  }

  const lastLevel = levels[levels.length - 1];
  const interval = thresholds[lastLevel];
  const cyclePosition = currentHours % interval;
  const due_at = currentHours - cyclePosition + interval;
  const hours_remaining = due_at - currentHours;

  return { level: lastLevel, due_at, hours_remaining };
}
```

## File: src/hooks/useOnlineStatus.ts
```typescript
import { useState, useEffect } from 'react';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

## File: src/hooks/usePullToRefresh.ts
```typescript
import { useState, useRef, useCallback } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
}

export function usePullToRefresh({ onRefresh, threshold = 80 }: UsePullToRefreshOptions) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, threshold * 1.5));
    }
  }, [pulling, threshold]);

  const onTouchEnd = useCallback(async () => {
    if (!pulling) return;
    setPulling(false);

    if (pullDistance >= threshold) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPullDistance(0);
  }, [pulling, pullDistance, threshold, onRefresh]);

  const pullIndicatorStyle: React.CSSProperties = {
    height: pullDistance > 0 || refreshing ? Math.max(pullDistance, refreshing ? 48 : 0) : 0,
    transition: pulling ? 'none' : 'height 0.2s ease',
    overflow: 'hidden',
  };

  return {
    scrollRef,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    pullDistance,
    refreshing,
    pullIndicatorStyle,
    isReady: pullDistance >= threshold,
  };
}
```

## File: src/lib/date-utils.ts
```typescript
/**
 * Date formatting utilities — forces Mexico City timezone for all sheet entries.
 * Prevents UTC/locale mismatch when devices have different timezone settings.
 */

const MEXICO_TZ = 'America/Mexico_City';
const MEXICO_LOCALE = 'es-MX';

/** Returns formatted date string: "05/04/2026" (dd/MM/yyyy) */
export function mexicoDate(date: Date = new Date()): string {
  return date.toLocaleDateString(MEXICO_LOCALE, {
    timeZone: MEXICO_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Returns formatted time string: "07:41:00" (HH:mm:ss) */
export function mexicoTime(date: Date = new Date()): string {
  return date.toLocaleTimeString(MEXICO_LOCALE, {
    timeZone: MEXICO_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** Returns ISO-style date for IDs: "20260405" */
export function mexicoDateCompact(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MEXICO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const d = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}${m}${d}`;
}

/** Returns compact time for IDs: "0741" */
export function mexicoTimeCompact(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MEXICO_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '';
  const min = parts.find((p) => p.type === 'minute')?.value ?? '';
  return `${h}${min}`;
}
```

## File: src/lib/offline-queue.ts
```typescript
const DB_NAME = 'hermes-offline';
const STORE_NAME = 'pending-submissions';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface PendingSubmission {
  id?: number;
  type: 'dvir' | 'falla' | 'fuel' | 'trip' | 'horometro';
  data: Record<string, unknown>;
  timestamp: string;
}

export async function queueSubmission(submission: Omit<PendingSubmission, 'id'>): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).add(submission);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingSubmissions(): Promise<PendingSubmission[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const request = tx.objectStore(STORE_NAME).getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearSubmission(id: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const submissions = await getPendingSubmissions();
  return submissions.length;
}
```

## File: src/lib/priority-calculator.ts
```typescript
import type { OTPriority } from '../types/workorder';

interface FallaFields {
  puede_moverse: boolean;
  cliente_afectado: string;
  tipo_falla: string;
}

export function calculatePriority(fields: FallaFields): OTPriority {
  if (!fields.puede_moverse && fields.cliente_afectado.trim().length > 0) return 'CRITICA';
  if (!fields.puede_moverse) return 'ALTA';
  if (fields.tipo_falla && fields.tipo_falla !== '') return 'MEDIA';
  return 'BAJA';
}
```

## File: src/lib/supabase.ts
```typescript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

## File: src/main.tsx
```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

## File: src/pages/DashboardPage.tsx
```typescript
import ExecutiveDashboard from '../components/dashboard/ExecutiveDashboard';

export default function DashboardPage() {
  return <ExecutiveDashboard />;
}
```

## File: src/pages/MechanicPage.tsx
```typescript
import { useState } from 'react';
import { MOCK_WORKORDERS } from '../data/mock-workorders';
import MechanicHome from '../components/mechanic/MechanicHome';
import PartsSearch from '../components/mechanic/PartsSearch';
import ManualSearch from '../components/mechanic/ManualSearch';
import DiagramViewer from '../components/mechanic/DiagramViewer';
import OTCard from '../components/ui/OTCard';

type Tab = 'inicio' | 'ordenes' | 'partes' | 'manuales' | 'diagramas';

const TABS: { id: Tab; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'ordenes', label: 'Órdenes' },
  { id: 'partes', label: 'Partes' },
  { id: 'manuales', label: 'Manuales' },
  { id: 'diagramas', label: 'Diagramas' },
];

export default function MechanicPage() {
  const [activeTab, setActiveTab] = useState<Tab>('inicio');

  return (
    <div className="flex flex-col">
      {/* Sub-tab navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1 pt-2 scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-amber text-white'
                : 'bg-white text-text-secondary border border-border hover:border-amber'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'inicio' && <MechanicHome />}

      {activeTab === 'ordenes' && (
        <div className="py-4">
          <h2 className="font-semibold text-lg text-text mb-3">Todas las Órdenes</h2>
          {MOCK_WORKORDERS.map((ot) => (
            <OTCard key={ot.ot_id} workorder={ot} />
          ))}
        </div>
      )}

      {activeTab === 'partes' && <PartsSearch />}
      {activeTab === 'manuales' && <ManualSearch />}
      {activeTab === 'diagramas' && <DiagramViewer />}
    </div>
  );
}
```

## File: src/pages/SupervisorHomePage.tsx
```typescript
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  MapPin,
  AlertTriangle,
  Activity,
  Wrench,
  ShieldAlert,
  ShieldOff,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import KPICard from '../components/ui/KPICard';
import EquipmentCard from '../components/ui/EquipmentCard';

interface ActionCard {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const ACTION_CARDS: ActionCard[] = [
  { label: 'Equipos', icon: <Truck size={32} className="text-amber" />, path: '/fleet' },
  { label: 'Viajes Peña', icon: <MapPin size={32} className="text-amber" />, path: '/viajes-pena' },
  { label: 'Alertas', icon: <AlertTriangle size={32} className="text-amber" />, path: '/alerts' },
];

export default function SupervisorHomePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const total = EQUIPMENT_CATALOG.length;
  const operativo = EQUIPMENT_CATALOG.filter((e) => e.status === 'operativo').length;
  const alerta = EQUIPMENT_CATALOG.filter((e) => e.status === 'alerta').length;
  const taller = EQUIPMENT_CATALOG.filter((e) => e.status === 'taller').length;
  const inactivo = EQUIPMENT_CATALOG.filter((e) => e.status === 'inactivo').length;
  const disponibilidad = total > 0 ? Math.round(((operativo + alerta) / total) * 100) : 0;

  const equiposTaller = EQUIPMENT_CATALOG.filter((e) => e.status === 'taller');
  const equiposAlerta = EQUIPMENT_CATALOG.filter((e) => e.status === 'alerta');

  const greeting =
    new Date().getHours() < 12
      ? 'Buenos días'
      : new Date().getHours() < 18
        ? 'Buenas tardes'
        : 'Buenas noches';

  return (
    <div className="flex flex-col py-4 animate-fade-up">
      {/* Greeting */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-text">{greeting}, {userName}</h1>
        <p className="text-text-secondary text-sm mt-0.5">Supervisor de Producción</p>
      </div>

      {/* KPI grid 2x2 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <KPICard
          icon={<Activity size={20} />}
          value={`${disponibilidad}%`}
          label="Disponibilidad"
          color="#16A34A"
        />
        <KPICard
          icon={<Wrench size={20} />}
          value={taller}
          label="En Taller"
          color="#DC2626"
        />
        <KPICard
          icon={<ShieldAlert size={20} />}
          value={alerta}
          label="Alertas"
          color="#F59E0B"
        />
        <KPICard
          icon={<ShieldOff size={20} />}
          value={inactivo}
          label="Inactivos"
          color="#9CA3AF"
        />
      </div>

      {/* Quick actions 2-column grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {ACTION_CARDS.map(({ label, icon, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center justify-center gap-2 bg-white rounded-xl p-4 shadow-sm border border-border btn-press"
            style={{ minHeight: 100 }}
          >
            {icon}
            <span className="text-sm font-medium text-center text-text">{label}</span>
          </button>
        ))}
      </div>

      {/* Equipos en Taller */}
      <h2 className="font-semibold text-text mt-2 mb-3">Equipos en Taller</h2>
      <div className="flex flex-col gap-3 mb-6">
        {equiposTaller.length > 0 ? (
          equiposTaller.map((equipment) => (
            <EquipmentCard key={equipment.unit_id} equipment={equipment} />
          ))
        ) : (
          <div className="bg-green-50 border border-success rounded-lg p-3">
            <p className="text-sm font-medium text-success text-center">
              Todos los equipos operativos ✓
            </p>
          </div>
        )}
      </div>

      {/* Equipos en Alerta */}
      <h2 className="font-semibold text-text mt-2 mb-3">Equipos en Alerta</h2>
      <div className="flex flex-col gap-3">
        {equiposAlerta.length > 0 ? (
          equiposAlerta.map((equipment) => (
            <EquipmentCard key={equipment.unit_id} equipment={equipment} />
          ))
        ) : (
          <div className="bg-green-50 border border-success rounded-lg p-3">
            <p className="text-sm font-medium text-success text-center">
              Sin alertas activas ✓
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

## File: src/pages/ViajesPenaPage.tsx
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { mexicoDate, mexicoTime } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { useAuthStore } from '../stores/auth-store';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

const MATERIAL_OPTIONS = ['Tierra', 'Roca', 'Grava', 'Mineral', 'Caliza', 'Otro'];

export default function ViajesPenaPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const [unidad, setUnidad] = useState('');
  const [rutaOrigen, setRutaOrigen] = useState('');
  const [rutaDestino, setRutaDestino] = useState('');
  const [kmCargado, setKmCargado] = useState('');
  const [kmVacio, setKmVacio] = useState('');
  const [material, setMaterial] = useState('');
  const [tonelaje, setTonelaje] = useState('');
  const [numViajes, setNumViajes] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const kmTotal =
    kmCargado !== '' && kmVacio !== ''
      ? (parseFloat(kmCargado) || 0) + (parseFloat(kmVacio) || 0)
      : null;

  const canSubmit =
    unidad !== '' &&
    rutaOrigen.trim() !== '' &&
    rutaDestino.trim() !== '' &&
    kmCargado !== '' &&
    kmVacio !== '';

  function handleSubmitIntent() {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  async function handleConfirm() {
    setShowConfirm(false);

    const kmCargadoNum = parseFloat(kmCargado) || 0;
    const kmVacioNum = parseFloat(kmVacio) || 0;

    try {
      await appendRow(SHEET_TABS.VIAJES, [
        String(Date.now()),
        mexicoDate(),
        mexicoTime(),
        unidad,
        userName,
        rutaOrigen,
        rutaDestino,
        String(kmCargadoNum),
        String(kmVacioNum),
        String(kmCargadoNum + kmVacioNum),
        material,
        String(parseFloat(tonelaje) || 0),
        observaciones,
      ]);
    } catch (err) {
      console.error('Sheets append failed (Viajes Peña):', err);
    }

    setToastMessage('Viaje Peña registrado ✓');
    setToastVisible(true);
  }

  function handleToastDismiss() {
    setToastVisible(false);
    navigate(-1);
  }

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <SuccessToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={handleToastDismiss}
      />

      <ConfirmModal
        open={showConfirm}
        title="Confirmar viaje Peña"
        message={`¿Registrar viaje de ${rutaOrigen} → ${rutaDestino} para ${unidad || 'la unidad'}?`}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-text">Viajes Peña Colorada</h1>
          <p className="text-xs text-text-secondary">Reporte de fin de turno</p>
        </div>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-4">
        {/* Unidad */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Camión Articulado</label>
          <select
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar unidad...</option>
            {EQUIPMENT_CATALOG.filter(
              (eq) => eq.type === 'Camión Articulado'
            ).map((eq) => (
              <option key={eq.unit_id} value={eq.unit_id}>
                {eq.unit_id} — {eq.model}
              </option>
            ))}
          </select>
        </div>

        {/* Ruta origen */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Ruta Origen</label>
          <input
            type="text"
            value={rutaOrigen}
            onChange={(e) => setRutaOrigen(e.target.value)}
            placeholder="Frente 3"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* Ruta destino */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Ruta Destino</label>
          <input
            type="text"
            value={rutaDestino}
            onChange={(e) => setRutaDestino(e.target.value)}
            placeholder="Patio de acopio"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* Num viajes del turno */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Número de Viajes (turno)</label>
          <input
            type="number"
            value={numViajes}
            onChange={(e) => setNumViajes(e.target.value)}
            placeholder="Ej: 8"
            className="w-full rounded-xl border border-border p-4 text-2xl font-semibold text-text bg-white text-center"
          />
        </div>

        {/* KM grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">KM Cargado</label>
            <input
              type="number"
              value={kmCargado}
              onChange={(e) => setKmCargado(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">KM Vacío</label>
            <input
              type="number"
              value={kmVacio}
              onChange={(e) => setKmVacio(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
        </div>

        {/* KM total */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">KM Total</label>
          <div className="w-full rounded-xl border border-border p-3 bg-gray-50 text-text font-semibold">
            {kmTotal !== null ? `${kmTotal} km` : '—'}
          </div>
        </div>

        {/* Material */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Material</label>
          <select
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar material...</option>
            {MATERIAL_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Tonelaje */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Tonelaje Total</label>
          <input
            type="number"
            value={tonelaje}
            onChange={(e) => setTonelaje(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* Observaciones */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones del turno..."
            rows={3}
            className="w-full rounded-xl border border-border p-3 text-sm text-text resize-none bg-white"
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmitIntent}
        disabled={!canSubmit}
        className="mt-4 w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
        style={{ minHeight: 52 }}
      >
        Registrar Viajes del Turno
      </button>
    </div>
  );
}
```

## File: src/stores/cart-store.ts
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  cartId: string;
  part_number: string;
  description: string;
  quantity: number;
  unit_price: number;
  equipment: string;         // machine the part is for
  urgencia: 'Normal' | 'Urgente' | 'Crítico';
  notes: string;
  isManual: boolean;         // true = added manually (not from catalog)
  source: string;            // e.g. "Catálogo Komatsu D155AX-6"
}

interface CartStore {
  items: CartItem[];
  addItem: (part: Omit<CartItem, 'cartId'>) => void;
  removeItem: (cartId: string) => void;
  updateItem: (cartId: string, updates: Partial<CartItem>) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],

      addItem: (part) =>
        set((state) => {
          // If same part_number already in cart (catalog parts), bump qty
          if (!part.isManual) {
            const existing = state.items.find((i) => i.part_number === part.part_number && !i.isManual);
            if (existing) {
              return {
                items: state.items.map((i) =>
                  i.cartId === existing.cartId ? { ...i, quantity: i.quantity + 1 } : i
                ),
              };
            }
          }
          const cartId = `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          return { items: [...state.items, { ...part, cartId }] };
        }),

      removeItem: (cartId) =>
        set((state) => ({ items: state.items.filter((i) => i.cartId !== cartId) })),

      updateItem: (cartId, updates) =>
        set((state) => ({
          items: state.items.map((i) => (i.cartId === cartId ? { ...i, ...updates } : i)),
        })),

      clearCart: () => set({ items: [] }),
    }),
    { name: 'hermes-cart-v1' }
  )
);
```

## File: src/types/chat.ts
```typescript
export interface ChatMessage {
  id: string;
  role: 'user' | 'hermes';
  content: string;
  photo_url?: string;
  timestamp: Date;
  loading?: boolean;
}

export interface DiagnoseResponse {
  causas_probables: string[];
  checklist_diagnostico: string[];
  partes_probables: string[];
  prioridad: string;
}

export interface PhotoAnalysisResponse {
  componente_probable: string;
  tipo_de_dano: string;
  severidad: string;
  recomendacion_inicial: string;
}
```

## File: src/types/dvir.ts
```typescript
export type CheckStatus = 'ok' | 'alerta' | 'falla' | null;
export type DVIRResult = 'aprobado' | 'condicional' | 'reprobado';
export type DVIRType = 'pre-operacion' | 'post-operacion';

export interface DVIRSystem {
  id: string;
  label: string;
  icon: string;
}

export interface DVIRCheck {
  system_id: string;
  status: CheckStatus;
  photo_url?: string;
  notes?: string;
}

export interface DVIRInspection {
  unit_id: string;
  type: DVIRType;
  operator: string;
  horometro: number;
  fecha: string;
  hora: string;
  checks: DVIRCheck[];
  result: DVIRResult;
  score: number;
  observations: string;
  ot_generated?: string;
}
```

## File: src/types/equipment.ts
```typescript
export interface Equipment {
  unit_id: string;
  model: string;
  type: 'Bulldozer' | 'Camión Articulado' | 'Cargador' | 'Excavadora' | 'Camión Pesado';
  client: string;
  status: 'operativo' | 'alerta' | 'taller' | 'inactivo';
  current_horometro: number;
  next_pm_level: string;
  next_pm_horometro: number;
  last_inspection_date: string;
  last_inspection_result: 'aprobado' | 'condicional' | 'reprobado';
  assigned_operator: string;
}
```

## File: src/types/fuel.ts
```typescript
export interface FuelLog {
  id: string;
  fecha: string;
  hora: string;
  unidad: string;
  operador: string;
  tipo_combustible: 'ULSD' | 'Diesel' | 'Gasolina';
  litros: number;
  costo: number;
  horometro: number;
  km: number;
  rendimiento: number;
  estacion: string;
  observaciones: string;
  anomaly_flag: boolean;
}
```

## File: src/types/trip.ts
```typescript
export interface TripLog {
  id: string;
  fecha: string;
  hora: string;
  camion: string;
  conductor: string;
  ruta_origen: string;
  ruta_destino: string;
  km_cargado: number;
  km_vacio: number;
  km_total: number;
  material: 'Tierra' | 'Roca' | 'Grava' | 'Mineral' | 'Caliza' | 'Otro';
  tonelaje: number;
  observaciones: string;
}
```

## File: tsconfig.json
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

## File: src/components/chat/ChatInput.tsx
```typescript
import { useState, useRef } from 'react';
import { Camera, Send, X } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string, photo?: File) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    e.target.value = '';
  }

  function handleRemovePhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
  }

  function handleSend() {
    if (!text.trim() && !photo) return;
    onSend(text.trim(), photo ?? undefined);
    setText('');
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const canSend = (text.trim().length > 0 || photo !== null) && !disabled;

  return (
    <div
      className="bg-white border-t px-4 py-3"
      style={{ borderColor: '#E5E7EB' }}
    >
      {photoPreview && (
        <div className="flex items-center gap-2 mb-2">
          <div className="relative">
            <img
              src={photoPreview}
              alt="Foto seleccionada"
              className="w-12 h-12 rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#DC2626' }}
            >
              <X size={10} color="white" />
            </button>
          </div>
          <span className="text-xs" style={{ color: '#6B7280' }}>
            {photo?.name ?? 'foto.jpg'}
          </span>
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40"
          style={{ backgroundColor: '#2563EB' }}
        >
          <Camera size={18} color="white" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Escribe tu consulta..."
          rows={1}
          className="flex-1 rounded-xl px-4 py-3 text-sm resize-none outline-none disabled:opacity-40"
          style={{
            backgroundColor: '#F9FAFB',
            color: '#1A2B2B',
            border: '1px solid #E5E7EB',
            maxHeight: 120,
            overflowY: 'auto',
          }}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-40"
          style={{ backgroundColor: '#2563EB' }}
        >
          <Send size={18} color="white" />
        </button>
      </div>
    </div>
  );
}
```

## File: src/components/chat/TypingIndicator.tsx
```typescript
export default function TypingIndicator() {
  return (
    <div className="flex flex-col items-start gap-1 max-w-[80%] mr-auto">
      <div className="flex items-end gap-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#2563EB' }}
        >
          <span className="text-white text-xs font-bold">H</span>
        </div>
        <div className="bg-white rounded-2xl rounded-bl-md p-3 shadow-sm">
          <div className="flex items-center gap-1 py-1">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{
                backgroundColor: '#6B7280',
                opacity: 0.5,
                animation: 'bounce-dot 1.4s infinite ease-in-out',
                animationDelay: '0s',
              }}
            />
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{
                backgroundColor: '#6B7280',
                opacity: 0.5,
                animation: 'bounce-dot 1.4s infinite ease-in-out',
                animationDelay: '0.2s',
              }}
            />
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{
                backgroundColor: '#6B7280',
                opacity: 0.5,
                animation: 'bounce-dot 1.4s infinite ease-in-out',
                animationDelay: '0.4s',
              }}
            />
          </div>
        </div>
      </div>
      <p className="text-xs ml-8" style={{ color: '#6B7280' }}>
        Hermes está analizando...
      </p>
    </div>
  );
}
```

## File: src/components/dashboard/AccionesDelDia.tsx
```typescript
import { FileText, Clock, AlertTriangle, Package, Shield } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';

interface Accion {
  icon: ComponentType<LucideProps>;
  text: string;
  color: string;
}

const acciones: Accion[] = [
  { icon: FileText, text: 'Briefing enviado a CEO y Gerencia', color: '#16A34A' },
  { icon: Clock, text: 'PM programado para EPAK-05 y EPAK-08', color: '#F59E0B' },
  { icon: AlertTriangle, text: 'OT crítica abierta para EPAK-09', color: '#DC2626' },
  { icon: Package, text: 'Reorden sugerido: filtros D155', color: '#2563EB' },
  { icon: Shield, text: 'Certificación STPS vence en 26 días', color: '#F59E0B' },
  { icon: FileText, text: 'Reporte semanal disponible en PDF', color: '#3B82F6' },
];

export default function AccionesDelDia() {
  return (
    <div className="bg-card rounded-xl shadow-sm p-4 border border-border">
      <h3 className="font-semibold text-text mb-3">Acciones del Día</h3>
      <div className="flex flex-col gap-2.5">
        {acciones.map((accion, i) => {
          const Icon = accion.icon;
          return (
            <div key={i} className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: accion.color + '1A' }}
              >
                <Icon size={16} style={{ color: accion.color }} />
              </div>
              <p className="text-sm text-text">{accion.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

## File: src/components/dashboard/AvailabilityChart.tsx
```typescript
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ChartPoint {
  day: string;
  pct: number;
}

const DEFAULT_DATA: ChartPoint[] = [
  { day: 'Lun', pct: 88 },
  { day: 'Mar', pct: 91 },
  { day: 'Mié', pct: 88 },
  { day: 'Jue', pct: 85 },
  { day: 'Vie', pct: 91 },
  { day: 'Sáb', pct: 92 },
  { day: 'Dom', pct: 88 },
];

interface AvailabilityChartProps {
  data?: ChartPoint[];
}

export default function AvailabilityChart({ data = DEFAULT_DATA }: AvailabilityChartProps) {
  return (
    <div className="bg-card rounded-xl shadow-sm p-4 border border-border">
      <h3 className="font-semibold text-text mb-4">
        Tendencia de Disponibilidad — 7 días
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="day"
            tick={{ fill: '#6B7280', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[75, 100]}
            tick={{ fill: '#6B7280', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => [`${value}%`, 'Disponibilidad']}
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid #E5E7EB',
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="pct"
            stroke="#16A34A"
            strokeWidth={2}
            dot={{ r: 4, fill: '#16A34A', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

## File: src/components/dashboard/BriefingCard.tsx
```typescript
export default function BriefingCard() {
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4" style={{ backgroundColor: '#162252' }}>
        <p className="font-bold text-white text-sm tracking-wide">BRIEFING FLOTA GTP</p>
        <p className="text-white text-xs mt-0.5 opacity-80">4 Abril 2026 · 06:00 hrs</p>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Disponibilidad */}
        <div>
          <p className="font-semibold text-text text-sm">
            DISPONIBILIDAD: 88% (27/30 equipos)
          </p>
          <p className="text-text-secondary text-sm mt-0.5">
            EN TALLER: EPAK-09 (fuga motor), EPEX-27 (eléctrico)
          </p>
        </div>

        {/* Alertas PM */}
        <div>
          <p className="font-semibold text-text text-sm">ALERTAS PM:</p>
          <p className="text-sm mt-1" style={{ color: '#DC2626' }}>
            ⚠️ EPTK-08 — PM-3 VENCIDO (38 hrs sobre límite)
          </p>
          <p className="text-sm mt-0.5" style={{ color: '#F59E0B' }}>
            ⚠️ EPAK-06 — PM-2 en 23 hrs
          </p>
        </div>

        {/* Combustible */}
        <div>
          <p className="font-semibold text-text text-sm">COMBUSTIBLE (semana):</p>
          <p className="text-sm mt-1" style={{ color: '#F59E0B' }}>
            EPAK-09: 1.15 L/hr ⚠️ (+18% sobre benchmark)
          </p>
          <p className="text-sm mt-0.5" style={{ color: '#16A34A' }}>
            D155AX-6 promedio: 0.97 L/hr ✅
          </p>
        </div>

        {/* DVIR Compliance */}
        <div>
          <p className="font-semibold text-text text-sm">
            DVIR COMPLIANCE: 87% (13/15 operadores)
          </p>
          <p className="text-sm mt-0.5" style={{ color: '#F59E0B' }}>
            ⚠️ Faltaron: Carlos M., Juan A.
          </p>
        </div>

        {/* Partes Críticas */}
        <div>
          <p className="font-semibold text-text text-sm">PARTES CRÍTICAS:</p>
          <p className="text-sm mt-1" style={{ color: '#DC2626' }}>
            🔴 600-319-3750 — AGOTADO (HM400-3 filter)
          </p>
          <p className="text-sm mt-0.5" style={{ color: '#F59E0B' }}>
            🟡 P559000 — BAJO STOCK (1 ud, mín 2)
          </p>
        </div>
      </div>
    </div>
  );
}
```

## File: src/components/layout/AppShell.tsx
```typescript
import { Outlet } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';

export default function AppShell() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main
        className="flex-1 overflow-y-auto px-4"
        style={{
          paddingTop: 80,
          paddingBottom: 80,
          backgroundColor: '#F1F5F9',
        }}
      >
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
```

## File: src/components/layout/BottomNav.tsx
```typescript
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import type { NavItem } from '../../types/roles';
import { NAV_CONFIG } from '../../types/roles';
import MoreTray from './MoreTray';

function LucideIcon({ name, ...props }: { name: string } & Icons.LucideProps) {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon | undefined>)[name];
  return Icon ? <Icon {...props} /> : null;
}

export default function BottomNav() {
  const [showMoreTray, setShowMoreTray] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const role = useAuthStore((s) => s.role);

  if (!role) return null;

  const { visible, overflow } = NAV_CONFIG[role];

  const isActive = (item: NavItem) => {
    if (!item.path) return false;
    return location.pathname.startsWith(item.path);
  };

  const handleItemClick = (item: NavItem) => {
    if (item.id === 'mas') {
      setShowMoreTray(true);
    } else {
      navigate(item.path);
    }
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 pb-safe"
        style={{ height: 64, backgroundColor: '#162252' }}
      >
        {visible.map((item) => {
          const active = isActive(item);
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className="flex flex-col items-center gap-1 flex-1 py-2"
              aria-label={item.label}
            >
              <LucideIcon
                name={item.icon}
                size={22}
                color={active ? '#2563EB' : 'rgba(255,255,255,0.6)'}
              />
              <span
                className="text-xs leading-none"
                style={{ color: active ? '#2563EB' : 'rgba(255,255,255,0.6)' }}
              >
                {item.label}
              </span>
              {active && (
                <span
                  className="w-1 h-1 rounded-full"
                  style={{ backgroundColor: '#2563EB' }}
                />
              )}
            </button>
          );
        })}
      </nav>

      <MoreTray
        open={showMoreTray}
        onClose={() => setShowMoreTray(false)}
        items={overflow}
      />
    </>
  );
}
```

## File: src/components/layout/MoreTray.tsx
```typescript
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import type { NavItem } from '../../types/roles';

function LucideIcon({ name, ...props }: { name: string } & Icons.LucideProps) {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon | undefined>)[name];
  return Icon ? <Icon {...props} /> : null;
}

interface MoreTrayProps {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
}

export default function MoreTray({ open, onClose, items }: MoreTrayProps) {
  const navigate = useNavigate();

  if (!open) return null;

  const handleItemClick = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex flex-col justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      {/* Tray */}
      <div
        className="relative rounded-t-2xl w-full py-4 px-4 flex flex-col gap-1"
        style={{ backgroundColor: '#FFFFFF', zIndex: 1 }}
      >
        <div
          className="w-10 h-1 rounded-full mx-auto mb-3"
          style={{ backgroundColor: '#E5E7EB' }}
        />
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => handleItemClick(item.path)}
            className="flex items-center gap-4 py-3 px-3 rounded-xl active:opacity-70 transition-opacity"
            style={{ backgroundColor: 'transparent' }}
          >
            <LucideIcon name={item.icon} size={22} color="#162252" />
            <span className="text-text text-base font-medium">{item.label}</span>
          </button>
        ))}
        <div className="h-4" />
      </div>
    </div>
  );
}
```

## File: src/components/ui/SuccessToast.tsx
```typescript
import { useEffect } from 'react';

interface SuccessToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
}

function AnimatedCheck() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0">
      <circle
        cx="12" cy="12" r="10"
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="2"
      />
      <circle
        cx="12" cy="12" r="10"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeDasharray="63"
        strokeDashoffset="63"
        style={{
          animation: 'check-circle-draw 0.4s ease-out 0.1s forwards',
        }}
      />
      <path
        d="M7 13l3 3 7-7"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="24"
        strokeDashoffset="24"
        style={{
          animation: 'check-draw 0.3s ease-out 0.5s forwards',
        }}
      />
    </svg>
  );
}

export default function SuccessToast({ message, visible, onDismiss }: SuccessToastProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  return (
    <div
      className="fixed top-4 left-4 right-4 z-50 bg-success text-white rounded-xl p-4 shadow-lg flex items-center gap-3 transition-all duration-300"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(-16px) scale(0.95)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {visible && <AnimatedCheck />}
      <span className="font-medium text-sm">{message}</span>
    </div>
  );
}
```

## File: src/data/fuel-benchmarks.ts
```typescript
export const FUEL_BENCHMARKS: Record<string, { min: number; max: number; unit: string }> = {
  'Komatsu HM400-3': { min: 0.95, max: 1.1, unit: 'L/hr' },
  'Komatsu D155AX-6': { min: 0.9, max: 1.0, unit: 'L/hr' },
  'Komatsu D65EX-16': { min: 0.7, max: 0.85, unit: 'L/hr' },
  'CAT 740B': { min: 0.8, max: 0.9, unit: 'L/hr' },
  'Mack GR84B 8x4': { min: 28, max: 32, unit: 'L/100km' },
  'Doosan DL420A': { min: 0.85, max: 1.0, unit: 'L/hr' },
  'Doosan DX340LC': { min: 0.8, max: 0.95, unit: 'L/hr' },
  'Doosan DX225LC': { min: 0.65, max: 0.8, unit: 'L/hr' },
  'Doosan DX360LCA': { min: 0.85, max: 1.0, unit: 'L/hr' },
};

export function isAnomalous(_model: string, _consumption: number): boolean {
  // Anomaly detection requires horómetro delta to compute L/hr rate.
  // A single fueling event (total liters) cannot be compared against rate benchmarks.
  // TODO: implement when sheet provides previous horómetro reading for delta calculation.
  return false;
}
```

## File: src/data/mock-workorders.ts
```typescript
import type { WorkOrder } from '../types/workorder';

export const MOCK_WORKORDERS: WorkOrder[] = [
  {
    ot_id: 'OT-20260404-0847',
    fecha: '2026-04-04',
    unidad: 'EPAK-09',
    tipo_averia: 'Hidráulica',
    descripcion: 'Fuga de aceite hidráulico en cilindro de dirección. Presión baja, operación inestable.',
    severidad: 'Alta',
    prioridad: 'CRITICA',
    mecanico_asignado: 'Jorge Ramírez',
    estado: 'En Proceso',
    foto_url: '',
    averia_ref: 'FALLA-20260404-0840',
    partes_necesarias: 'Sello hidráulico 85mm, O-ring kit, Manguera retorno',
    costo_estimado: 850,
    fecha_cierre: '',
    observaciones: 'Unidad detenida en taller. Se requiere reemplazo de sello principal.',
    progreso: 0,
  },
  {
    ot_id: 'OT-20260404-0915',
    fecha: '2026-04-04',
    unidad: 'EPTK-09',
    tipo_averia: 'Mecánica',
    descripcion: 'Ruido anormal en tren de rodaje lado derecho. Posible falla en cadena de traslación.',
    severidad: 'Media',
    prioridad: 'ALTA',
    mecanico_asignado: 'Sin asignar',
    estado: 'Nuevo',
    foto_url: '',
    averia_ref: 'FALLA-20260404-0910',
    partes_necesarias: 'Eslabón de cadena, Pin de cadena, Rodillo portador',
    costo_estimado: 1200,
    fecha_cierre: '',
    observaciones: 'Pendiente de asignación a mecánico disponible.',
    progreso: 0,
  },
  {
    ot_id: 'OT-20260403-1645',
    fecha: '2026-04-03',
    unidad: 'EPAK-07',
    tipo_averia: 'Eléctrica',
    descripcion: 'Falla en sistema de luces traseras. Corto circuito detectado en tablero. Luces de freno no funcionan.',
    severidad: 'Media',
    prioridad: 'MEDIA',
    mecanico_asignado: 'Carlos López',
    estado: 'Esperando Pieza',
    foto_url: '',
    averia_ref: 'FALLA-20260403-1630',
    partes_necesarias: 'Relay 24V, Fusible 30A, Arnés eléctrico trasero',
    costo_estimado: 320,
    fecha_cierre: '',
    observaciones: 'Arnés eléctrico solicitado a proveedor. ETA: 2-3 días.',
    progreso: 0,
  },
  {
    ot_id: 'OT-20260403-1030',
    fecha: '2026-04-03',
    unidad: 'EPCF-08',
    tipo_averia: 'Motor',
    descripcion: 'Consumo excesivo de aceite de motor. Humo azul en escape. Probable falla en anillos de pistón.',
    severidad: 'Alta',
    prioridad: 'ALTA',
    mecanico_asignado: 'Jorge Ramírez',
    estado: 'Asignado',
    foto_url: '',
    averia_ref: 'FALLA-20260403-1020',
    partes_necesarias: 'Kit anillos de pistón, Junta de culata, Aceite motor 15W-40 x20L',
    costo_estimado: 2400,
    fecha_cierre: '',
    observaciones: 'Se programa inspección para el 2026-04-05 por la mañana.',
    progreso: 0,
  },
  {
    ot_id: 'OT-20260402-0800',
    fecha: '2026-04-02',
    unidad: 'EPEX-27',
    tipo_averia: 'Estructura',
    descripcion: 'Fisura detectada en boom principal cerca de pin de articulación superior. Inspección reveló crack de 8cm.',
    severidad: 'Baja',
    prioridad: 'BAJA',
    mecanico_asignado: 'Pedro García',
    estado: 'Completado',
    foto_url: '',
    averia_ref: 'FALLA-20260401-1545',
    partes_necesarias: 'Electrodo soldadura E7018, Disco de amolado, Pintura anticorrosiva',
    costo_estimado: 180,
    fecha_cierre: '2026-04-03',
    observaciones: 'Reparación completada. Soldadura inspeccionada y aprobada. Unidad lista para retorno a operaciones pendiente revisión final.',
    progreso: 100,
  },
];
```

## File: src/hooks/useDashboardData.ts
```typescript
import { useState, useEffect, useCallback } from 'react';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { mexicoDate } from '../lib/date-utils';

export interface DashboardData {
  availability: number;
  criticalOTs: number;
  avgConsumption: string;
  alertsToday: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function computeAvailability(): number {
  const available = EQUIPMENT_CATALOG.filter(
    (e) => e.status === 'operativo' || e.status === 'alerta'
  ).length;
  return Math.round((available / EQUIPMENT_CATALOG.length) * 100);
}

async function fetchCriticalOTs(): Promise<number> {
  const rows = await readRange(SHEET_TABS.ORDENES_TRABAJO);
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const priority = (row[7] ?? '').toLowerCase();
    const status = (row[9] ?? '').toLowerCase();
    if (
      priority === 'critica' &&
      status !== 'completado'
    ) {
      count++;
    }
  }
  return count;
}

async function fetchAvgConsumption(): Promise<string> {
  const rows = await readRange(SHEET_TABS.COMBUSTIBLE);
  let total = 0;
  let count = 0;
  for (let i = 2; i < rows.length; i++) {
    const raw = rows[i][6] ?? '';
    const litros = parseFloat(raw.replace(',', '.'));
    if (!isNaN(litros) && litros > 0) {
      total += litros;
      count++;
    }
  }
  if (count === 0) return '--';
  return `${(total / count).toFixed(2)} L/avg`;
}

async function fetchAlertsToday(): Promise<number> {
  const rows = await readRange(SHEET_TABS.AVERIAS);
  const today = mexicoDate();
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const dateCell = (rows[i][0] ?? '').trim();
    if (dateCell === today) {
      count++;
    }
  }
  return count;
}

export function useDashboardData(): DashboardData {
  const [criticalOTs, setCriticalOTs] = useState(0);
  const [avgConsumption, setAvgConsumption] = useState('--');
  const [alertsToday, setAlertsToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const availability = computeAvailability();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const results = await Promise.allSettled([
      fetchCriticalOTs(),
      fetchAvgConsumption(),
      fetchAlertsToday(),
    ]);

    const [otsResult, consumptionResult, alertsResult] = results;

    if (otsResult.status === 'fulfilled') {
      setCriticalOTs(otsResult.value);
    } else {
      setCriticalOTs(0);
    }

    if (consumptionResult.status === 'fulfilled') {
      setAvgConsumption(consumptionResult.value);
    } else {
      setAvgConsumption('--');
    }

    if (alertsResult.status === 'fulfilled') {
      setAlertsToday(alertsResult.value);
    } else {
      setAlertsToday(0);
    }

    const anyFailed = results.some((r) => r.status === 'rejected');
    if (anyFailed) {
      setError('Algunos datos no pudieron cargarse');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    availability,
    criticalOTs,
    avgConsumption,
    alertsToday,
    loading,
    error,
    refresh: fetchAll,
  };
}
```

## File: src/lib/ot-generator.ts
```typescript
import { mexicoDateCompact, mexicoTimeCompact } from './date-utils';

export function generateOTId(): string {
  const now = new Date();
  return `OT-${mexicoDateCompact(now)}-${mexicoTimeCompact(now)}`;
}
```

## File: src/lib/photo-upload-safe.ts
```typescript
import { uploadPhoto, isSupabaseConfigured } from './photo-upload';

export { isSupabaseConfigured };

/**
 * Tries to upload a photo to Supabase Storage.
 * Returns the public URL if Supabase is configured and upload succeeds.
 * Returns empty string if Supabase is not configured or upload fails.
 * (Blob URLs are session-only and must NOT be written to Google Sheets.)
 */
export async function tryUploadPhoto(file: File, bucket: string, path?: string): Promise<string> {
  if (!isSupabaseConfigured()) {
    return '';
  }
  try {
    return await uploadPhoto(file, bucket, path);
  } catch {
    return '';
  }
}

export async function tryUploadPhotos(files: File[], bucket: string): Promise<string[]> {
  const results = await Promise.all(
    files.map((f, i) => tryUploadPhoto(f, bucket, `${Date.now()}-${i}`))
  );
  // Filter out empty strings (failed/unconfigured uploads)
  return results.filter((url) => url !== '');
}
```

## File: src/lib/photo-upload.ts
```typescript
import { supabase } from './supabase';

export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  return !!url && url !== 'https://placeholder.supabase.co' && url !== '';
}

export async function compressImage(file: File, maxWidth = 1200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('Canvas not supported')); return; }
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => { if (blob) resolve(blob); else reject(new Error('Compression failed')); },
        'image/jpeg',
        0.85
      );
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = URL.createObjectURL(file);
  });
}

export async function uploadPhoto(file: File, bucket: string, path?: string): Promise<string> {
  const compressed = await compressImage(file);
  const fileName = path ? `${path}.jpg` : `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { data, error } = await supabase.storage.from(bucket).upload(fileName, compressed, {
    contentType: 'image/jpeg',
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}
```

## File: src/pages/AlertsPage.tsx
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Package, Clock, CheckCircle, Wrench, TrendingUp } from 'lucide-react';

interface Alert {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  unread: boolean;
}

const MOCK_ALERTS: Alert[] = [
  {
    id: '1',
    title: 'D155-02 Fuera de Servicio',
    description: 'Unidad reportada fuera de servicio. Requiere atención inmediata del taller.',
    timestamp: 'Hace 15 min',
    type: 'critical',
    unread: true,
  },
  {
    id: '2',
    title: 'Stock Bajo: Pastillas de Freno',
    description: 'Inventario por debajo del mínimo. Stock actual: 2 juegos. Mínimo: 5.',
    timestamp: 'Hace 42 min',
    type: 'warning',
    unread: true,
  },
  {
    id: '3',
    title: 'PM Vencido: MACK-07',
    description: 'MACK-07 tiene mantenimiento preventivo vencido desde hace 85 hrs.',
    timestamp: 'Hace 2 hrs',
    type: 'warning',
    unread: false,
  },
  {
    id: '4',
    title: 'DVIR Completado: EPAK-09',
    description: 'Inspección pre-operación completada con resultado aprobado. Operador: Carlos M.',
    timestamp: 'Hace 4 hrs',
    type: 'info',
    unread: false,
  },
  {
    id: '5',
    title: 'OT Completada: OT-20260402-0800',
    description: 'Orden de trabajo completada. Cambio de aceite y filtros en EPAK-07.',
    timestamp: 'Ayer 16:30',
    type: 'success',
    unread: false,
  },
  {
    id: '6',
    title: 'Consumo Anómalo: EPAK-09',
    description: 'Consumo de combustible 38% sobre el benchmark. Revisar posibles fugas.',
    timestamp: 'Ayer 08:15',
    type: 'warning',
    unread: false,
  },
];

const BORDER_COLORS: Record<Alert['type'], string> = {
  critical: 'border-l-critical',
  warning: 'border-l-amber',
  info: 'border-l-blue-500',
  success: 'border-l-success',
};

const ICON_BG_COLORS: Record<Alert['type'], string> = {
  critical: 'bg-red-100',
  warning: 'bg-amber-100',
  info: 'bg-blue-100',
  success: 'bg-green-100',
};

const ICON_COLORS: Record<Alert['type'], string> = {
  critical: 'text-critical',
  warning: 'text-amber',
  info: 'text-blue-600',
  success: 'text-success',
};

function AlertIcon({ type, title }: { type: Alert['type']; title: string }) {
  const iconClass = `${ICON_COLORS[type]}`;
  const size = 18;

  if (type === 'critical') return <AlertCircle size={size} className={iconClass} />;
  if (title.toLowerCase().includes('stock') || title.toLowerCase().includes('inventario')) {
    return <Package size={size} className={iconClass} />;
  }
  if (title.toLowerCase().includes('pm') || title.toLowerCase().includes('mantenimiento')) {
    return <Clock size={size} className={iconClass} />;
  }
  if (title.toLowerCase().includes('ot') || title.toLowerCase().includes('completada')) {
    return <Wrench size={size} className={iconClass} />;
  }
  if (title.toLowerCase().includes('dvir')) {
    return <CheckCircle size={size} className={iconClass} />;
  }
  return <TrendingUp size={size} className={iconClass} />;
}

export default function AlertsPage() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState(MOCK_ALERTS);

  function markAsRead(id: string) {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, unread: false } : a))
    );
  }

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Alertas</h1>
        <div className="ml-auto bg-amber text-white text-xs font-bold px-2 py-1 rounded-full">
          {alerts.filter((a) => a.unread).length}
        </div>
      </div>

      {/* Alert feed */}
      <div className="flex flex-col gap-3">
        {alerts.map((alert) => (
          <button
            key={alert.id}
            type="button"
            onClick={() => markAsRead(alert.id)}
            className={`bg-white rounded-xl shadow-sm border border-border border-l-4 ${BORDER_COLORS[alert.type]} p-4 flex items-start gap-3 text-left w-full transition-opacity`}
          >
            {/* Icon */}
            <div className={`${ICON_BG_COLORS[alert.type]} rounded-full p-2 shrink-0 mt-0.5`}>
              <AlertIcon type={alert.type} title={alert.title} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-text text-sm leading-tight">{alert.title}</p>
              <p className="text-text-secondary text-xs mt-1 leading-relaxed">{alert.description}</p>
              <p className="text-text-secondary text-xs mt-2">{alert.timestamp}</p>
            </div>

            {/* Unread dot */}
            {alert.unread && (
              <div className="w-2.5 h-2.5 rounded-full bg-amber shrink-0 mt-1.5" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
```

## File: src/pages/ChatPage.tsx
```typescript
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import HermesChat from '../components/chat/HermesChat';

export default function ChatPage() {
  const navigate = useNavigate();

  return (
    <div
      className="flex flex-col"
      style={{ height: '100dvh', backgroundColor: '#F1F5F9' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ backgroundColor: '#162252' }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1 rounded-lg"
          style={{ color: 'rgba(255,255,255,0.8)' }}
        >
          <ArrowLeft size={22} />
        </button>

        <div className="flex-1">
          <p className="text-white font-semibold text-base leading-tight">
            Hermes — Asistente IA
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Diagnóstico inteligente de flota
          </p>
        </div>

        <div
          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg"
          style={{ backgroundColor: '#2563EB', color: 'white' }}
        >
          H
        </div>
      </div>

      {/* Chat area fills remaining height */}
      <div className="flex-1 min-h-0 flex flex-col">
        <HermesChat />
      </div>
    </div>
  );
}
```

## File: src/pages/CoordinatorHomePage.tsx
```typescript
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  CalendarCheck,
  Package,
  Clock,
  ShoppingCart,
  AlertTriangle,
  ClipboardList,
  Flame,
  Timer,
  Archive,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { MOCK_WORKORDERS } from '../data/mock-workorders';
import { getNextPM } from '../data/pm-rules';
import KPICard from '../components/ui/KPICard';
import OTCard from '../components/ui/OTCard';

interface ActionCard {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const ACTION_CARDS: ActionCard[] = [
  { label: 'Órdenes', icon: <Wrench size={32} className="text-amber" />, path: '/workorders' },
  { label: 'Orden PM', icon: <CalendarCheck size={32} className="text-amber" />, path: '/pm-order' },
  { label: 'Inventario', icon: <Package size={32} className="text-amber" />, path: '/inventory' },
  { label: 'Programa PM', icon: <Clock size={32} className="text-amber" />, path: '/pm' },
  { label: 'Pedidos', icon: <ShoppingCart size={32} className="text-amber" />, path: '/pedidos' },
  { label: 'Alertas', icon: <AlertTriangle size={32} className="text-amber" />, path: '/alerts' },
];

export default function CoordinatorHomePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const openOTs = MOCK_WORKORDERS.filter(
    (ot) => ot.estado !== 'Completado'
  );
  const criticalOTs = MOCK_WORKORDERS.filter((ot) => ot.prioridad === 'CRITICA');

  const pmProximos = EQUIPMENT_CATALOG.filter((e) => {
    const pm = getNextPM(e.model, e.current_horometro);
    return pm.hours_remaining <= 50;
  }).length;

  const stockCritico = 2;

  const greeting =
    new Date().getHours() < 12
      ? 'Buenos días'
      : new Date().getHours() < 18
        ? 'Buenas tardes'
        : 'Buenas noches';

  return (
    <div className="flex flex-col py-4 animate-fade-up">
      {/* Greeting */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-text">{greeting}, {userName}</h1>
        <p className="text-text-secondary text-sm mt-0.5">Coordinador de Mantenimiento</p>
      </div>

      {/* KPI grid 2x2 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <KPICard
          icon={<ClipboardList size={20} />}
          value={openOTs.length}
          label="OTs Abiertas"
          color="#2563EB"
        />
        <KPICard
          icon={<Flame size={20} />}
          value={criticalOTs.length}
          label="OTs Críticas"
          color="#DC2626"
        />
        <KPICard
          icon={<Timer size={20} />}
          value={pmProximos}
          label="PM Próximos"
          color="#F59E0B"
        />
        <KPICard
          icon={<Archive size={20} />}
          value={stockCritico}
          label="Stock Crítico"
          color="#EA580C"
        />
      </div>

      {/* Quick actions 2x3 grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {ACTION_CARDS.map(({ label, icon, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center justify-center gap-2 bg-white rounded-xl p-4 shadow-sm border border-border btn-press"
            style={{ minHeight: 100 }}
          >
            {icon}
            <span className="text-sm font-medium text-center text-text">{label}</span>
          </button>
        ))}
      </div>

      {/* OTs Pendientes */}
      <h2 className="font-semibold text-text mt-2 mb-3">OTs Pendientes</h2>
      <div className="flex flex-col">
        {openOTs.length > 0 ? (
          openOTs.map((ot) => (
            <OTCard
              key={ot.ot_id}
              workorder={ot}
              onClick={() => navigate(`/workorders/${ot.ot_id}`)}
            />
          ))
        ) : (
          <div className="bg-green-50 border border-success rounded-lg p-3">
            <p className="text-sm font-medium text-success text-center">
              Sin órdenes pendientes ✓
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

## File: src/pages/FleetPage.tsx
```typescript
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import FleetGrid from '../components/dashboard/FleetGrid';

export default function FleetPage() {
  const navigate = useNavigate();

  const operativo = EQUIPMENT_CATALOG.filter((e) => e.status === 'operativo').length;
  const total = EQUIPMENT_CATALOG.length;

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Equipos</h1>
        <span className="ml-auto text-sm font-semibold text-success">
          {operativo}/{total} operativos
        </span>
      </div>

      <FleetGrid equipment={EQUIPMENT_CATALOG} />
    </div>
  );
}
```

## File: src/pages/InventoryPage.tsx
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface StockItem {
  partNumber: string;
  description: string;
  oemRef: string;
  stock: number;
  minimum: number;
  status: 'critical' | 'low' | 'ok';
}

const STOCK_ITEMS: StockItem[] = [
  {
    partNumber: 'FLT-HYD-001',
    description: 'Filtro Hidráulico Komatsu',
    oemRef: 'KOM-207-60-71181',
    stock: 0,
    minimum: 4,
    status: 'critical',
  },
  {
    partNumber: 'FREIN-001',
    description: 'Pastillas de Freno CAT 740B',
    oemRef: 'CAT-9W-2620',
    stock: 2,
    minimum: 5,
    status: 'critical',
  },
  {
    partNumber: 'FLT-ACE-002',
    description: 'Filtro Aceite Motor D155',
    oemRef: 'KOM-600-211-5240',
    stock: 3,
    minimum: 6,
    status: 'low',
  },
  {
    partNumber: 'EMP-001',
    description: 'Empaque Cabeza Motor',
    oemRef: 'MACK-21893456',
    stock: 1,
    minimum: 3,
    status: 'low',
  },
  {
    partNumber: 'COR-HYD-003',
    description: 'Correa Alternador Doosan',
    oemRef: 'DOO-K9002983',
    stock: 4,
    minimum: 6,
    status: 'low',
  },
  {
    partNumber: 'NEU-CAM-001',
    description: 'Neumático 23.5R25',
    oemRef: 'BRI-OTR-23525',
    stock: 2,
    minimum: 4,
    status: 'low',
  },
  {
    partNumber: 'ACE-MOT-001',
    description: 'Aceite Motor 15W40 (bidón 5L)',
    oemRef: 'SHELL-RIM-X-15W40',
    stock: 5,
    minimum: 8,
    status: 'low',
  },
  {
    partNumber: 'BAT-24V-001',
    description: 'Batería 24V 170Ah',
    oemRef: 'BOSCH-S5-A08',
    stock: 6,
    minimum: 4,
    status: 'ok',
  },
  {
    partNumber: 'FLT-COM-001',
    description: 'Filtro Combustible Komatsu',
    oemRef: 'KOM-600-311-3750',
    stock: 12,
    minimum: 6,
    status: 'ok',
  },
  {
    partNumber: 'SEL-HYD-001',
    description: 'Sello Cilindro Hidráulico',
    oemRef: 'KOM-707-99-01340',
    stock: 8,
    minimum: 4,
    status: 'ok',
  },
];

type FilterType = 'all' | 'critical' | 'low' | 'ok';

const STATUS_BORDER: Record<StockItem['status'], string> = {
  critical: 'border-l-critical',
  low: 'border-l-amber',
  ok: 'border-l-transparent',
};

const STATUS_BADGE: Record<StockItem['status'], string> = {
  critical: 'bg-red-100 text-critical',
  low: 'bg-amber-100 text-amber',
  ok: 'bg-green-100 text-success',
};

const STATUS_LABEL: Record<StockItem['status'], string> = {
  critical: 'CRÍTICO',
  low: 'BAJO',
  ok: 'OK',
};

export default function InventoryPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>('all');

  const criticalCount = STOCK_ITEMS.filter((i) => i.status === 'critical').length;
  const lowCount = STOCK_ITEMS.filter((i) => i.status === 'low').length;
  const okCount = STOCK_ITEMS.filter((i) => i.status === 'ok').length;

  const filtered =
    filter === 'all'
      ? STOCK_ITEMS
      : STOCK_ITEMS.filter((i) => i.status === filter);

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Inventario Repuestos</h1>
      </div>

      {/* Summary pills */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setFilter(filter === 'critical' ? 'all' : 'critical')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border ${
            filter === 'critical'
              ? 'bg-red-100 border-critical text-critical'
              : 'bg-white border-border text-text-secondary'
          }`}
        >
          <span className="text-base">🔴</span>
          CRÍTICO {criticalCount}
        </button>
        <button
          type="button"
          onClick={() => setFilter(filter === 'low' ? 'all' : 'low')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border ${
            filter === 'low'
              ? 'bg-amber-100 border-amber text-amber'
              : 'bg-white border-border text-text-secondary'
          }`}
        >
          <span className="text-base">🟡</span>
          BAJO {lowCount}
        </button>
        <button
          type="button"
          onClick={() => setFilter(filter === 'ok' ? 'all' : 'ok')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border ${
            filter === 'ok'
              ? 'bg-green-100 border-success text-success'
              : 'bg-white border-border text-text-secondary'
          }`}
        >
          <span className="text-base">✅</span>
          OK {okCount}
        </button>
      </div>

      {/* Stock items */}
      <div className="flex flex-col gap-3">
        {filtered.map((item) => (
          <div
            key={item.partNumber}
            className={`bg-white rounded-xl shadow-sm border border-border border-l-4 ${STATUS_BORDER[item.status]} p-4 flex items-center gap-3`}
          >
            {/* Left: part info */}
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs font-semibold text-amber">{item.partNumber}</p>
              <p className="font-medium text-text text-sm mt-0.5">{item.description}</p>
              <p className="text-text-secondary text-xs mt-0.5">{item.oemRef}</p>
            </div>

            {/* Right: stock info */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[item.status]}`}>
                {STATUS_LABEL[item.status]}
              </span>
              <span className="text-xl font-bold text-text">{item.stock}</span>
              <span className="text-xs text-text-secondary">Mín: {item.minimum}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## File: src/pages/MyReportsPage.tsx
```typescript
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Fuel, Clock, FileText } from 'lucide-react';
import EmptyState from '../components/ui/EmptyState';

interface Report {
  id: string;
  title: string;
  unit: string;
  time: string;
  badge?: string;
  badgeType?: 'success' | 'info' | 'neutral';
  value?: string;
  icon: 'dvir' | 'fuel' | 'horometro' | 'report';
}

const MOCK_REPORTS: Report[] = [
  {
    id: '1',
    title: 'DVIR Pre-Operación',
    unit: 'EPAK-09',
    time: '06:15',
    badge: 'Aprobado',
    badgeType: 'success',
    icon: 'dvir',
  },
  {
    id: '2',
    title: 'Combustible',
    unit: 'EPAK-09',
    time: '07:30',
    value: '150 L',
    icon: 'fuel',
  },
  {
    id: '3',
    title: 'Horómetro Inicio',
    unit: 'EPAK-09',
    time: '06:00',
    value: '8,450 hrs',
    icon: 'horometro',
  },
];

const BADGE_STYLES: Record<string, string> = {
  success: 'bg-green-100 text-success',
  info: 'bg-blue-100 text-blue-600',
  neutral: 'bg-gray-100 text-text-secondary',
};

function ReportIcon({ icon }: { icon: Report['icon'] }) {
  const cls = 'text-amber';
  const size = 20;
  if (icon === 'dvir') return <ClipboardList size={size} className={cls} />;
  if (icon === 'fuel') return <Fuel size={size} className={cls} />;
  if (icon === 'horometro') return <Clock size={size} className={cls} />;
  return <FileText size={size} className={cls} />;
}

export default function MyReportsPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Mis Reportes de Hoy</h1>
      </div>

      {MOCK_REPORTS.length === 0 ? (
        <EmptyState
          type="reports"
          title="Sin reportes hoy"
          description="No has enviado reportes de operación por hoy"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {MOCK_REPORTS.map((report) => (
            <div
              key={report.id}
              className="bg-white rounded-xl p-4 shadow-sm border border-border flex items-center gap-3"
            >
              {/* Icon */}
              <div className="bg-amber/10 rounded-xl p-3 shrink-0">
                <ReportIcon icon={report.icon} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text text-sm">{report.title}</p>
                <p className="text-text-secondary text-xs mt-0.5">{report.unit}</p>
              </div>

              {/* Time + badge/value */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="text-text-secondary text-xs font-mono">{report.time}</span>
                {report.badge && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      BADGE_STYLES[report.badgeType ?? 'neutral']
                    }`}
                  >
                    {report.badge}
                  </span>
                )}
                {report.value && (
                  <span className="text-text-secondary text-xs">{report.value}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## File: vite.config.ts
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/hermes-api': {
        target: 'http://5.78.204.80:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hermes-api/, ''),
      },
    },
  },
})
```

## File: src/components/mechanic/MechanicHome.tsx
```typescript
import { useNavigate } from 'react-router-dom';
import { Wrench, Package, BookOpen, MessageCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { MOCK_WORKORDERS } from '../../data/mock-workorders';
import KPICard from '../ui/KPICard';
import OTCard from '../ui/OTCard';

export default function MechanicHome() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const activeStatuses = ['Completado'] as const;
  const myOTs = MOCK_WORKORDERS.filter(
    (ot) => ot.mecanico_asignado === userName && !activeStatuses.includes(ot.estado as typeof activeStatuses[number])
  );
  const waitingParts = MOCK_WORKORDERS.filter((ot) => ot.estado === 'Esperando Pieza').length;

  return (
    <div className="flex flex-col py-4">
      {/* KPI strip */}
      <div className="flex gap-3 mb-2">
        <KPICard
          icon={<Wrench size={20} />}
          value={myOTs.length}
          label="OTs Asignadas"
          color="#2563EB"
        />
        <KPICard
          icon={<Package size={20} />}
          value={waitingParts}
          label="Esperando Pieza"
          color="#EA580C"
        />
      </div>

      {/* Mis Órdenes Activas */}
      <h2 className="font-semibold text-lg text-text mt-6 mb-3">Mis Órdenes Activas</h2>
      {myOTs.length > 0 ? (
        myOTs.map((ot) => (
          <OTCard key={ot.ot_id} workorder={ot} />
        ))
      ) : (
        <p className="text-center text-text-secondary py-8">No tienes órdenes asignadas</p>
      )}

      {/* Acciones Rápidas */}
      <h2 className="font-semibold text-lg text-text mt-6 mb-3">Acciones Rápidas</h2>
      <div className="flex gap-3">
        <button
          onClick={() => navigate('/parts')}
          className="flex-1 bg-card rounded-xl p-4 text-center shadow-sm border border-border flex flex-col items-center gap-2 hover:bg-gray-50 transition-colors"
        >
          <Package size={24} className="text-amber" />
          <span className="text-xs font-medium text-text">Buscar Parte</span>
        </button>
        <button
          onClick={() => navigate('/manuals')}
          className="flex-1 bg-card rounded-xl p-4 text-center shadow-sm border border-border flex flex-col items-center gap-2 hover:bg-gray-50 transition-colors"
        >
          <BookOpen size={24} className="text-amber" />
          <span className="text-xs font-medium text-text">Manual Técnico</span>
        </button>
        <button
          onClick={() => navigate('/chat')}
          className="flex-1 bg-card rounded-xl p-4 text-center shadow-sm border border-border flex flex-col items-center gap-2 hover:bg-gray-50 transition-colors"
        >
          <MessageCircle size={24} className="text-amber" />
          <span className="text-xs font-medium text-text">Preguntar a Hermes</span>
        </button>
      </div>
    </div>
  );
}
```

## File: src/components/mechanic/PartCard.tsx
```typescript
import { ShoppingCart, Check } from 'lucide-react';
import { useState } from 'react';
import type { PartResult } from '../../lib/hermes-api';
import { useCartStore } from '../../stores/cart-store';
import { useAuthStore } from '../../stores/auth-store';

interface PartCardProps {
  part: PartResult;
}

export default function PartCard({ part }: PartCardProps) {
  const role = useAuthStore((s) => s.role);
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const [added, setAdded] = useState(false);

  const canOrder = role === 'jefe_taller';
  const alreadyInCart = cartItems.some((i) => i.part_number === part.part_number && !i.isManual);

  const needsOrder =
    part.stock_quantity === 0 || part.stock_quantity <= part.stock_minimum;

  const stockStatus =
    part.stock_quantity === 0
      ? { label: 'Agotado', color: '#DC2626', bg: '#FEE2E2' }
      : part.stock_quantity <= part.stock_minimum
        ? { label: `Bajo: ${part.stock_quantity}`, color: '#D97706', bg: '#FEF3C7' }
        : { label: `En stock: ${part.stock_quantity}`, color: '#16A34A', bg: '#DCFCE7' };

  function handleAddToCart() {
    addItem({
      part_number: part.part_number,
      description: part.description,
      quantity: 1,
      unit_price: part.unit_price,
      equipment: part.compatible_units[0] ?? '',
      urgencia: part.stock_quantity === 0 ? 'Urgente' : 'Normal',
      notes: '',
      isManual: false,
      source: part.oem_ref ? `OEM ${part.oem_ref}` : 'Catálogo',
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-4 mb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Row 1: part number + description */}
          <div className="flex items-baseline gap-2 flex-wrap mb-1">
            <span className="font-mono font-semibold text-amber text-sm">{part.part_number}</span>
            <span className="text-sm font-medium text-text">{part.description}</span>
          </div>

          {/* Row 2: OEM ref + location */}
          <div className="flex gap-3 text-xs text-text-secondary mb-1 flex-wrap">
            <span>OEM: {part.oem_ref}</span>
            <span>Ubicación: {part.location}</span>
          </div>

          {/* Row 3: alternatives */}
          {part.alternatives.length > 0 && (
            <p className="text-xs text-amber">
              Alternativas: {part.alternatives.join(', ')}
            </p>
          )}
        </div>

        {/* Right: stock badge + price */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ color: stockStatus.color, backgroundColor: stockStatus.bg }}
          >
            {stockStatus.label}
          </span>
          <span className="text-sm font-bold text-text">${part.unit_price.toFixed(2)}</span>
        </div>
      </div>

      {/* Add to cart button — only for jefe_taller when stock is low/out */}
      {canOrder && needsOrder && (
        <div className="mt-3 pt-3 border-t border-border">
          <button
            onClick={handleAddToCart}
            disabled={alreadyInCart || added}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              backgroundColor: alreadyInCart || added ? '#DCFCE7' : '#162252',
              color: alreadyInCart || added ? '#16A34A' : '#FFFFFF',
            }}
          >
            {alreadyInCart || added ? (
              <>
                <Check size={15} />
                {alreadyInCart ? 'En el carrito' : 'Agregado ✓'}
              </>
            ) : (
              <>
                <ShoppingCart size={15} />
                Agregar al Pedido
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
```

## File: src/lib/print-pm-order.ts
```typescript
import type { PMPart } from '../data/pm-parts-catalog';

interface PrintPMOrderData {
  otId: string;
  date: string;
  unidad: string;
  model: string;
  pmLevel: string;
  levelsIncluded: string[];
  horometro: number;
  estimatedHours: number;
  mecanico: string;
  autorizadoPor: string;
  observaciones: string;
  parts: PMPart[];
}

export function printPMOrder(data: PrintPMOrderData): void {
  const partsRows = data.parts
    .map(
      (p, i) =>
        `<tr>
          <td style="padding:6px 8px;border:1px solid #ccc;text-align:center">${i + 1}</td>
          <td style="padding:6px 8px;border:1px solid #ccc;font-family:monospace;font-size:12px">${p.partNumber}</td>
          <td style="padding:6px 8px;border:1px solid #ccc">${p.description}</td>
          <td style="padding:6px 8px;border:1px solid #ccc;text-align:center">${p.quantity}</td>
          <td style="padding:6px 8px;border:1px solid #ccc;text-align:center">${p.unit}</td>
          <td style="padding:6px 8px;border:1px solid #ccc;text-align:center">${p.category}</td>
          <td style="padding:6px 8px;border:1px solid #ccc;text-align:center">☐</td>
        </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>OT ${data.otId} — PM ${data.pmLevel}</title>
  <style>
    @media print { body { margin: 0; } @page { margin: 1cm; } }
    body { font-family: Arial, sans-serif; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #162252; padding-bottom: 12px; margin-bottom: 16px; }
    .logo { font-size: 24px; font-weight: 900; color: #162252; }
    .logo-sub { font-size: 11px; color: #666; }
    .ot-id { font-size: 20px; font-weight: 700; color: #162252; text-align: right; }
    .ot-type { font-size: 13px; color: #2563EB; font-weight: 600; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 20px; font-size: 13px; }
    .info-grid dt { color: #666; font-weight: 500; }
    .info-grid dd { margin: 0; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
    thead { background: #162252; color: white; }
    thead th { padding: 8px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; }
    tbody tr:nth-child(even) { background: #f8f9fa; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 40px; }
    .sig-box { border-top: 2px solid #1a1a1a; padding-top: 6px; text-align: center; font-size: 11px; color: #666; }
    .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 10px; color: #999; text-align: center; }
    .obs { background: #f8f9fa; border: 1px solid #ddd; border-radius: 6px; padding: 10px; font-size: 12px; min-height: 40px; margin-bottom: 16px; }
    .badge { display: inline-block; background: #2563EB; color: white; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .print-btn { position: fixed; bottom: 20px; right: 20px; background: #2563EB; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    @media print { .print-btn { display: none; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimir PDF</button>

  <div class="header">
    <div>
      <div class="logo">TRANS PLUS</div>
      <div class="logo-sub">Grupo Trans Plus • Mantenimiento de Flota</div>
    </div>
    <div>
      <div class="ot-id">${data.otId}</div>
      <div class="ot-type">ORDEN DE MANTENIMIENTO PREVENTIVO</div>
    </div>
  </div>

  <dl class="info-grid">
    <dt>Fecha</dt><dd>${data.date}</dd>
    <dt>Nivel PM</dt><dd><span class="badge">${data.pmLevel} (${data.levelsIncluded.join(' + ')})</span></dd>
    <dt>Unidad</dt><dd>${data.unidad}</dd>
    <dt>Modelo</dt><dd>${data.model}</dd>
    <dt>Horómetro Actual</dt><dd>${data.horometro.toLocaleString()} hrs</dd>
    <dt>Horas Estimadas</dt><dd>${data.estimatedHours} hrs</dd>
    <dt>Mecánico Asignado</dt><dd>${data.mecanico || 'Por asignar'}</dd>
    <dt>Autorizado Por</dt><dd>${data.autorizadoPor}</dd>
  </dl>

  <h3 style="color:#162252;font-size:14px;margin-bottom:8px">Refacciones Requeridas (${data.parts.length} ítems)</h3>
  <table>
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th>No. Parte</th>
        <th>Descripción</th>
        <th style="width:40px">Cant.</th>
        <th style="width:40px">Unid.</th>
        <th style="width:60px">Tipo</th>
        <th style="width:50px">Listo</th>
      </tr>
    </thead>
    <tbody>
      ${partsRows}
    </tbody>
  </table>

  <h3 style="color:#162252;font-size:14px;margin-bottom:8px">Observaciones</h3>
  <div class="obs">${data.observaciones || '—'}</div>

  <div class="signatures">
    <div class="sig-box">Coordinador de Mantenimiento</div>
    <div class="sig-box">Mecánico Asignado</div>
    <div class="sig-box">Jefe de Taller</div>
  </div>

  <div class="footer">
    Hermes Fleet App • Grupo Trans Plus • ${data.date} • ${data.otId}
  </div>
</body>
</html>`;

  // Open print window — must be triggered by direct user click to avoid popup blocker
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
```

## File: src/pages/WorkshopHomePage.tsx
```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Clock,
  Package,
  CalendarCheck,
  BookOpen,
  FileImage,
  HardHat,
  ClipboardList,
  Users,
  PackageSearch,
  Disc3,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useWorkOrderStore } from '../stores/workorder-store';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import KPICard from '../components/ui/KPICard';
import EquipmentCard from '../components/ui/EquipmentCard';
import OTCard from '../components/ui/OTCard';

const MECANICOS_HEADCOUNT = 12;

interface ActionCard {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const ACTION_CARDS: ActionCard[] = [
  { label: 'Órdenes',  icon: <Wrench       size={32} className="text-amber" />, path: '/workorders' },
  { label: 'PM',       icon: <Clock        size={32} className="text-amber" />, path: '/pm' },
  { label: 'Partes',   icon: <Package      size={32} className="text-amber" />, path: '/parts' },
  { label: 'Orden PM', icon: <CalendarCheck size={32} className="text-amber" />, path: '/pm-order' },
  { label: 'Manuales', icon: <BookOpen     size={32} className="text-amber" />, path: '/manuals' },
  { label: 'Diagramas',icon: <FileImage    size={32} className="text-amber" />, path: '/diagrams' },
  { label: 'Neumáticos',icon: <Disc3       size={32} className="text-amber" />, path: '/neumaticos' },
];

export default function WorkshopHomePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  // ── Real OT data ────────────────────────────────────────────────────────
  const { workorders, fetched, fetchWorkOrders, loading: otLoading } = useWorkOrderStore();

  useEffect(() => {
    if (!fetched) fetchWorkOrders();
  }, [fetched, fetchWorkOrders]);

  const otsActivas   = workorders.filter((ot) => ot.estado !== 'Completado');
  const otsEnProceso = workorders.filter((ot) => ot.estado === 'En Proceso');

  // ── En Taller: unique units with active OTs, resolved from catalog ──────
  const unitsEnTaller = [...new Set(otsActivas.map((ot) => ot.unidad).filter(Boolean))];
  const equiposTaller = unitsEnTaller
    .map((uid) => EQUIPMENT_CATALOG.find((e) => e.unit_id === uid))
    .filter((e): e is (typeof EQUIPMENT_CATALOG)[0] => e !== undefined);

  // ── Partes Pendientes from Cotizaciones_Pendientes ──────────────────────
  const [partesPendientes, setPartesPendientes] = useState<number | null>(null);

  useEffect(() => {
    readRange(SHEET_TABS.COTIZACIONES)
      .then((rows) => {
        const count = rows.slice(1).filter((r) => (r[6] ?? '').trim() === 'Pendiente').length;
        setPartesPendientes(count);
      })
      .catch(() => setPartesPendientes(0));
  }, []);

  // ── Refresh all ─────────────────────────────────────────────────────────
  function handleRefresh() {
    useWorkOrderStore.setState({ fetched: false });
    fetchWorkOrders();
    setPartesPendientes(null);
    readRange(SHEET_TABS.COTIZACIONES)
      .then((rows) => {
        const count = rows.slice(1).filter((r) => (r[6] ?? '').trim() === 'Pendiente').length;
        setPartesPendientes(count);
      })
      .catch(() => setPartesPendientes(0));
  }

  // ── Greeting ────────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

  const isLoading = otLoading || partesPendientes === null;

  return (
    <div className="flex flex-col py-4 animate-fade-up">
      {/* Greeting */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-text">{greeting}, {userName}</h1>
          <p className="text-text-secondary text-sm mt-0.5">Jefe de Taller</p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 rounded-full"
          style={{ color: '#162252' }}
          aria-label="Actualizar"
        >
          <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* KPI grid 2×2 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <KPICard
          icon={<HardHat size={20} />}
          value={otLoading ? '…' : equiposTaller.length}
          label="En Taller"
          color="#DC2626"
        />
        <KPICard
          icon={<ClipboardList size={20} />}
          value={otLoading ? '…' : otsActivas.length}
          label="OTs Activas"
          color="#2563EB"
        />
        <KPICard
          icon={<Users size={20} />}
          value={MECANICOS_HEADCOUNT}
          label="Mecánicos"
          color="#16A34A"
        />
        <KPICard
          icon={<PackageSearch size={20} />}
          value={partesPendientes === null ? '…' : partesPendientes}
          label="Partes Pendientes"
          color="#F59E0B"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {ACTION_CARDS.map(({ label, icon, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center justify-center gap-2 bg-white rounded-xl p-4 shadow-sm border border-border btn-press"
            style={{ minHeight: 100 }}
          >
            {icon}
            <span className="text-sm font-medium text-center text-text">{label}</span>
          </button>
        ))}
      </div>

      {/* En el Taller Ahora */}
      <h2 className="font-semibold text-text mt-2 mb-3">En el Taller Ahora</h2>
      <div className="flex flex-col gap-3 mb-6">
        {otLoading ? (
          <div className="text-center py-6 text-text-secondary text-sm">Cargando…</div>
        ) : equiposTaller.length > 0 ? (
          equiposTaller.map((equipment) => (
            <EquipmentCard key={equipment.unit_id} equipment={equipment} />
          ))
        ) : (
          <div className="bg-green-50 border border-success rounded-lg p-3">
            <p className="text-sm font-medium text-success text-center">Taller vacío ✓</p>
          </div>
        )}
      </div>

      {/* OTs en Proceso */}
      <h2 className="font-semibold text-text mt-2 mb-3">OTs en Proceso</h2>
      <div className="flex flex-col">
        {otLoading ? (
          <div className="text-center py-6 text-text-secondary text-sm">Cargando…</div>
        ) : otsEnProceso.length > 0 ? (
          otsEnProceso.map((ot) => (
            <OTCard
              key={ot.ot_id}
              workorder={ot}
              onClick={() => navigate(`/workorders/${ot.ot_id}`)}
            />
          ))
        ) : (
          <div className="bg-green-50 border border-success rounded-lg p-3">
            <p className="text-sm font-medium text-success text-center">Sin órdenes en proceso ✓</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

## File: src/stores/auth-store.ts
```typescript
import { create } from 'zustand';
import type { AppRole } from '../types/roles';

interface AuthState {
  role: AppRole | null;
  userName: string;
  assignedUnits: string[];
  isAuthenticated: boolean;
  login: (role: AppRole, pin: string) => boolean;
  logout: () => void;
}

const MOCK_USERS: Record<AppRole, { userName: string; assignedUnits: string[]; pin: string }> = {
  operador:    { userName: 'Operador',       assignedUnits: ['EPAK-09'], pin: '2026' },
  mecanico:    { userName: 'Mecánico',       assignedUnits: [], pin: '2015' },
  jefe_taller: { userName: 'Jefe de Taller', assignedUnits: [], pin: '1995' },
  coordinador: { userName: 'Coordinador',    assignedUnits: [], pin: '2001' },
  supervisor:  { userName: 'Supervisor',     assignedUnits: ['EPAK-09', 'EPTK-08', 'EPCF-08'], pin: '2008' },
  gerencia:    { userName: 'Gerencia',       assignedUnits: [], pin: '1963' },
};

export const useAuthStore = create<AuthState>((set) => ({
  role: null,
  userName: '',
  assignedUnits: [],
  isAuthenticated: false,

  login: (role: AppRole, pin: string): boolean => {
    if (pin.length !== 4) return false;
    const user = MOCK_USERS[role];
    if (pin !== user.pin) return false;
    set({
      role,
      userName: user.userName,
      assignedUnits: user.assignedUnits,
      isAuthenticated: true,
    });
    return true;
  },

  logout: () => {
    set({
      role: null,
      userName: '',
      assignedUnits: [],
      isAuthenticated: false,
    });
  },
}));
```

## File: src/components/chat/ChatBubble.tsx
```typescript
import type { ChatMessage } from '../../types/chat';

interface ChatBubbleProps {
  message: ChatMessage;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

/** Renders text with **bold** and ![img](url) markdown */
function RichText({ text, className }: { text: string; className?: string }) {
  // Split by images first, then bold
  const segments = text.split(/(!\[[^\]]*\]\([^)]+\))/g);
  return (
    <div className={`text-sm whitespace-pre-wrap ${className ?? ''}`}>
      {segments.map((segment, i) => {
        // Check for image: ![alt](url)
        const imgMatch = segment.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (imgMatch) {
          return (
            <img
              key={i}
              src={imgMatch[2]}
              alt={imgMatch[1] || 'Diagrama'}
              className="rounded-lg max-w-full mt-2 mb-1 border border-border shadow-sm"
              loading="lazy"
            />
          );
        }
        // Handle bold within text segments
        const boldParts = segment.split(/(\*\*[^*]+\*\*)/g);
        return (
          <span key={i}>
            {boldParts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>;
              }
              return <span key={j}>{part}</span>;
            })}
          </span>
        );
      })}
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span
        className="w-2 h-2 rounded-full bg-text-secondary/40 inline-block"
        style={{ animation: 'bounce-dot 1.4s infinite ease-in-out', animationDelay: '0s' }}
      />
      <span
        className="w-2 h-2 rounded-full bg-text-secondary/40 inline-block"
        style={{ animation: 'bounce-dot 1.4s infinite ease-in-out', animationDelay: '0.2s' }}
      />
      <span
        className="w-2 h-2 rounded-full bg-text-secondary/40 inline-block"
        style={{ animation: 'bounce-dot 1.4s infinite ease-in-out', animationDelay: '0.4s' }}
      />
    </div>
  );
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex flex-col items-end max-w-[80%] ml-auto">
        <div
          className="rounded-2xl rounded-br-md p-3"
          style={{ backgroundColor: '#2563EB' }}
        >
          {message.photo_url && (
            <img
              src={message.photo_url}
              alt="Foto adjunta"
              className="rounded-lg max-h-48 object-cover mb-2 w-full"
            />
          )}
          {message.loading ? (
            <LoadingDots />
          ) : (
            <RichText text={message.content} className="text-white" />
          )}
        </div>
        <span className="text-xs mt-1" style={{ color: 'rgba(107, 114, 128, 0.6)' }}>
          {formatTimestamp(message.timestamp)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 max-w-[80%] mr-auto">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mb-5"
        style={{ backgroundColor: '#2563EB' }}
      >
        <span className="text-white text-xs font-bold">H</span>
      </div>
      <div className="flex flex-col items-start">
        <div className="bg-white rounded-2xl rounded-bl-md p-3 shadow-sm">
          {message.photo_url && (
            <img
              src={message.photo_url}
              alt="Foto adjunta"
              className="rounded-lg max-h-48 object-cover mb-2 w-full"
            />
          )}
          {message.loading ? (
            <LoadingDots />
          ) : (
            <RichText text={message.content} className="text-text" />
          )}
        </div>
        <span className="text-xs mt-1" style={{ color: 'rgba(107, 114, 128, 0.6)' }}>
          {formatTimestamp(message.timestamp)}
        </span>
      </div>
    </div>
  );
}
```

## File: src/components/dashboard/ExecutiveDashboard.tsx
```typescript
import { useState, useCallback } from 'react';
import { Activity, AlertTriangle, Fuel, Bell, RefreshCw } from 'lucide-react';
import { EQUIPMENT_CATALOG } from '../../data/equipment-catalog';
import { useDashboardData } from '../../hooks/useDashboardData';
import KPICard from '../ui/KPICard';
import { SkeletonKPI } from '../ui/Skeleton';
import FleetGrid from './FleetGrid';
import AvailabilityChart from './AvailabilityChart';
import AccionesDelDia from './AccionesDelDia';
import BriefingCard from './BriefingCard';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import PullIndicator from '../ui/PullIndicator';

type Tab = 'general' | 'briefing' | 'pedidos';

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'briefing', label: 'Briefing' },
  { id: 'pedidos', label: 'Pedidos' },
];

export default function ExecutiveDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const data = useDashboardData();

  const handleRefresh = useCallback(async () => {
    data.refresh();
  }, [data]);

  const { scrollRef, onTouchStart, onTouchMove, onTouchEnd, pullDistance, refreshing, pullIndicatorStyle, isReady } =
    usePullToRefresh({ onRefresh: handleRefresh });

  return (
    <div
      ref={scrollRef}
      className={`flex flex-col py-4 overflow-y-auto transition-opacity ${data.loading ? 'opacity-60' : 'opacity-100'}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <PullIndicator
        pullDistance={pullDistance}
        refreshing={refreshing}
        isReady={isReady}
        style={pullIndicatorStyle}
      />
      {/* Tab pills */}
      <div className="flex items-center gap-2 mb-5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-white'
                : 'bg-card border border-border text-text-secondary hover:text-text'
            }`}
            style={activeTab === tab.id ? { backgroundColor: '#162252' } : undefined}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={data.refresh}
          disabled={data.loading}
          className="ml-auto p-1.5 rounded-full text-text-secondary hover:text-text hover:bg-card border border-transparent hover:border-border transition-colors disabled:opacity-40"
          aria-label="Actualizar datos"
        >
          <RefreshCw size={16} className={data.loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* General tab */}
      {activeTab === 'general' && (
        <div className="flex flex-col gap-4">
          {/* KPI row */}
          {data.loading ? (
            <div className="grid grid-cols-2 gap-3">
              <SkeletonKPI />
              <SkeletonKPI />
              <SkeletonKPI />
              <SkeletonKPI />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <KPICard
                icon={<Activity size={20} />}
                value={`${data.availability}%`}
                label="Disponibilidad"
                color="#16A34A"
              />
              <KPICard
                icon={<AlertTriangle size={20} />}
                value={data.criticalOTs}
                label="OTs Críticas"
                color="#DC2626"
              />
              <KPICard
                icon={<Fuel size={20} />}
                value={data.avgConsumption}
                label="Consumo Promedio"
                color="#2563EB"
              />
              <KPICard
                icon={<Bell size={20} />}
                value={String(data.alertsToday)}
                label="Alertas Hoy"
                color="#F59E0B"
              />
            </div>
          )}

          {/* Fleet grid */}
          <FleetGrid equipment={EQUIPMENT_CATALOG} />

          {/* Availability chart */}
          <AvailabilityChart />

          {/* Daily actions */}
          <AccionesDelDia />
        </div>
      )}

      {/* Briefing tab */}
      {activeTab === 'briefing' && <BriefingCard />}

      {/* Pedidos tab */}
      {activeTab === 'pedidos' && (
        <div className="flex items-center justify-center py-16">
          <p className="text-text-secondary">Pedidos de Repuestos — Próximamente</p>
        </div>
      )}
    </div>
  );
}
```

## File: src/components/layout/Header.tsx
```typescript
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, ShoppingCart } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useCartStore } from '../../stores/cart-store';
import { ROLE_LABELS } from '../../types/roles';

export default function Header() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const cartCount = useCartStore((s) => s.items.length);

  const canSeeCart = role === 'jefe_taller' || role === 'gerencia';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
      style={{ height: 64, backgroundColor: '#162252' }}
    >
      {/* Left: avatar + user info */}
      <div className="flex items-center gap-3">
        <img
          src="/logo-transplus.svg"
          alt="Trans Plus"
          className="shrink-0 rounded"
          style={{ width: 36, height: 36 }}
        />
        <div className="flex flex-col leading-tight">
          <span className="text-white font-semibold text-sm">{userName}</span>
          {role && (
            <span className="text-white/60 text-xs">{ROLE_LABELS[role]}</span>
          )}
        </div>
      </div>

      {/* Right: cart (JT only) + bell + logout */}
      <div className="flex items-center gap-4">
        {canSeeCart && (
          <button
            onClick={() => navigate('/pedidos')}
            className="relative text-white/80 hover:text-white transition-colors"
            aria-label="Pedidos"
          >
            <ShoppingCart size={22} />
            {cartCount > 0 && (
              <span
                className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white font-bold"
                style={{ width: 16, height: 16, fontSize: 9, backgroundColor: '#F59E0B' }}
              >
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => navigate('/alerts')}
          className="relative text-white/80 hover:text-white transition-colors"
          aria-label="Alertas"
        >
          <Bell size={22} />
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white"
            style={{ width: 16, height: 16, fontSize: 9, backgroundColor: '#DC2626' }}
          >
            2
          </span>
        </button>

        <button
          onClick={handleLogout}
          className="text-white/80 hover:text-white transition-colors"
          aria-label="Cerrar sesión"
        >
          <LogOut size={22} />
        </button>
      </div>
    </header>
  );
}
```

## File: src/components/ui/OTCard.tsx
```typescript
import { Wrench, Clock, ChevronRight } from 'lucide-react';
import type { WorkOrder } from '../../types/workorder';
import { PRIORITY_CONFIG, ESTADO_CONFIG } from '../../types/workorder';
import { getEquipmentById } from '../../data/equipment-catalog';

interface OTCardProps {
  workorder: WorkOrder;
  onClick?: () => void;
}

const PRIORITY_BORDER: Record<string, string> = {
  CRITICA: '#DC2626',
  ALTA: '#EA580C',
  MEDIA: '#F59E0B',
  BAJA: '#3B82F6',
};

function timeSince(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Hace menos de 1h';
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays}d`;
}

export default function OTCard({ workorder, onClick }: OTCardProps) {
  const equipment = getEquipmentById(workorder.unidad);
  const DEFAULT_PRIORITY = { color: '#6B7280', bg: '#F3F4F6', label: workorder.prioridad, time: '' };
  const DEFAULT_ESTADO = { color: '#6B7280', bg: '#F3F4F6' };

  // Normalize priority lookup (sheet may have 'Alta' vs 'ALTA')
  const prioKey = workorder.prioridad?.toUpperCase() as keyof typeof PRIORITY_CONFIG;
  const priorityConfig = PRIORITY_CONFIG[prioKey] ?? DEFAULT_PRIORITY;
  const estadoConfig = ESTADO_CONFIG[workorder.estado as keyof typeof ESTADO_CONFIG] ?? DEFAULT_ESTADO;
  const borderColor = PRIORITY_BORDER[prioKey] ?? '#9CA3AF';

  return (
    <div
      className={`bg-card rounded-xl shadow-sm border border-border mb-3 overflow-hidden${onClick ? ' cursor-pointer hover:bg-gray-50 transition-colors card-lift' : ''}`}
      style={{ borderLeft: `4px solid ${borderColor}` }}
      onClick={onClick}
    >
      <div className="p-4">
        {/* Row 1: OT ID + priority pill + estado pill */}
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="font-mono font-semibold text-amber text-sm">{workorder.ot_id}</span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ color: priorityConfig.color, backgroundColor: priorityConfig.bg }}
          >
            {priorityConfig.label}
          </span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ color: estadoConfig.color, backgroundColor: estadoConfig.bg }}
          >
            {workorder.estado}
          </span>
        </div>

        {/* Row 2: unit_id + model */}
        <p className="text-sm font-bold text-text mb-1">
          {workorder.unidad}
          {equipment && (
            <span className="font-normal"> — {equipment.model}</span>
          )}
        </p>

        {/* Row 3: descripcion truncated */}
        <p className="text-sm text-text-secondary truncate mb-2">{workorder.descripcion}</p>

        {/* Row 4: mechanic + time + chevron */}
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <div className="flex items-center gap-1">
            <Wrench size={12} />
            {workorder.mecanico_asignado && workorder.mecanico_asignado !== 'Sin asignar' ? (
              <span>{workorder.mecanico_asignado}</span>
            ) : (
              <span className="italic">Sin asignar</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span>{timeSince(workorder.fecha)}</span>
            {onClick && <ChevronRight size={14} className="text-text-secondary ml-1" />}
          </div>
        </div>
      </div>
    </div>
  );
}
```

## File: src/index.css
```css
@import "tailwindcss";
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

@theme {
  --color-teal: #162252;
  --color-teal-light: #1E3A8A;
  --color-cream: #F1F5F9;
  --color-amber: #2563EB;
  --color-amber-light: #3B82F6;
  --color-critical: #DC2626;
  --color-alta: #EA580C;
  --color-warning: #F59E0B;
  --color-success: #16A34A;
  --color-text: #1A2B2B;
  --color-text-secondary: #6B7280;
  --color-border: #E5E7EB;
  --color-card: #FFFFFF;
  --color-primary: #14b8a6;
  --color-primary-dark: #0f766e;
  --color-surface: #f8fafc;
  --font-sans: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

body {
  font-family: var(--font-sans);
  background-color: var(--color-cream);
  color: var(--color-text);
  margin: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#root {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.animate-pulse-dot {
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

@keyframes bounce-dot {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-8px); }
}

@keyframes check-circle-draw {
  from { stroke-dashoffset: 63; }
  to { stroke-dashoffset: 0; }
}

@keyframes check-draw {
  from { stroke-dashoffset: 24; }
  to { stroke-dashoffset: 0; }
}

/* Page enter animation */
@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-up {
  animation: fade-up 0.3s ease-out both;
}

/* Staggered children */
.animate-fade-up > :nth-child(1) { animation-delay: 0ms; }
.animate-fade-up > :nth-child(2) { animation-delay: 50ms; }
.animate-fade-up > :nth-child(3) { animation-delay: 100ms; }
.animate-fade-up > :nth-child(4) { animation-delay: 150ms; }
.animate-fade-up > :nth-child(5) { animation-delay: 200ms; }
.animate-fade-up > :nth-child(6) { animation-delay: 250ms; }

/* Skeleton shimmer */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 0.75rem;
}

/* Success checkmark */
@keyframes check-circle-fill {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* Button press feedback */
.btn-press {
  transition: transform 0.1s ease, opacity 0.1s ease;
}

.btn-press:active {
  transform: scale(0.97);
  opacity: 0.9;
}

/* Card hover lift */
.card-lift {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.card-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.card-lift:active {
  transform: translateY(0);
}

/* Pull to refresh indicator */
@keyframes spin-smooth {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

## File: src/pages/NeumaticosPage.tsx
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Disc3,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Gauge,
  Ruler,
  Loader2,
} from 'lucide-react';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { mexicoDate } from '../lib/date-utils';

// ── Column order matches Sheet "13 Neumáticos" cols A→S ─────────────────────
// A  #
// B  CÓDIGO UNIDAD
// C  MODELO
// D  POSICIÓN
// E  MARCA NEUMÁTICO
// F  MODELO NEUMÁTICO
// G  MEDIDA
// H  N° SERIE
// I  FECHA INSTALACIÓN        (blank — filled when tire is installed)
// J  HORÓMETRO INSTALACIÓN    (blank — filled when tire is installed)
// K  HORÓMETRO ACTUAL
// L  HORAS USO                (blank — sheet calculates K-J)
// M  PROFUNDIDAD ORIGINAL(mm)
// N  PROFUNDIDAD ACTUAL (mm)
// O  DESGASTE %               (blank — sheet calculates (M-N)/M*100)
// P  PRESIÓN RECOMENDADA(PSI)
// Q  ÚLTIMA PRESIÓN (PSI)
// R  FECHA ÚLT. INSPECCIÓN
// S  ESTADO

// ── Positions by equipment type ──────────────────────────────────────────────
// Camión Articulado (CAT 740B, HM400-3): 6 llantas
//   I1 D2 — Delanteras
//   I3 D4 — Trasera eje 2
//   I5 D6 — Trasera eje 3
// Camión Pesado Mack GR84B 8x4: 12 llantas
//   I1 D2 — Delanteras
//   I3 D4 — Eje 2 simples
//   DE5 DI6 — Eje 3 duales derecha (Exterior / Interior)
//   LI7 LE8 — Eje 3 duales izquierda (Interior / Exterior)
//   DE9 DI10 — Eje 4 duales derecha
//   LI11 LE12 — Eje 4 duales izquierda
// Cargador DL420A: 4 llantas
//   I1 D2 — Delanteras
//   I3 D4 — Traseras
const POSITIONS_BY_TYPE: Record<string, string[]> = {
  'Camión Articulado': ['I1', 'D2', 'I3', 'D4', 'I5', 'D6'],
  Cargador:            ['I1', 'D2', 'I3', 'D4'],
  'Camión Pesado':     ['I1', 'D2', 'I3', 'D4', 'DE5', 'DI6', 'LI7', 'LE8', 'DE9', 'DI10', 'LI11', 'LE12'],
  default:             ['I1', 'D2', 'I3', 'D4'],
};

// ── Recommended PSI by type + position ──────────────────────────────────────
function getPresionRecomendada(tipo: string, posicion: string): string {
  const esFrontal = posicion.startsWith('F');
  if (tipo === 'Camión Pesado') return esFrontal ? '120' : '115';
  if (tipo === 'Camión Articulado') return esFrontal ? '115' : '110';
  if (tipo === 'Cargador') return '80';
  return '115';
}

// ── Auto-calculate ESTADO from form values ───────────────────────────────────
function calcEstado(condicion: string, profActual: string, presion: string): string {
  const d = parseFloat(profActual);
  const p = parseFloat(presion);
  if (condicion === 'Cambio Urgente' || (!isNaN(d) && d < 5)) return 'Cambio Urgente';
  if (condicion === 'Dañada') return 'Dañada';
  if (!isNaN(p) && (p < 70 || p > 135)) return 'Desgaste Irregular';
  if (condicion === 'Desgaste Irregular' || (!isNaN(d) && d < 10)) return 'Desgaste Irregular';
  if (condicion === 'Desgaste Normal') return 'Desgaste Normal';
  return 'Buena';
}

// ── Visual helpers ───────────────────────────────────────────────────────────
const CONDICIONES = [
  { value: 'Buena',              color: '#16A34A', bg: '#F0FDF4' },
  { value: 'Desgaste Normal',    color: '#2563EB', bg: '#EFF6FF' },
  { value: 'Desgaste Irregular', color: '#F59E0B', bg: '#FFFBEB' },
  { value: 'Dañada',             color: '#DC2626', bg: '#FEF2F2' },
  { value: 'Cambio Urgente',     color: '#9B1C1C', bg: '#FEF2F2' },
];

const MARCAS = ['Bridgestone', 'Michelin', 'Goodyear', 'Continental', 'Hankook', 'Firestone', 'Otra'];

function depthColor(mm: string) {
  const v = parseFloat(mm);
  if (isNaN(v)) return '#9CA3AF';
  if (v >= 10) return '#16A34A';
  if (v >= 5) return '#F59E0B';
  return '#DC2626';
}

function psiColor(psi: string) {
  const v = parseFloat(psi);
  if (isNaN(v)) return '#9CA3AF';
  if (v >= 80 && v <= 130) return '#16A34A';
  if (v >= 65) return '#F59E0B';
  return '#DC2626';
}

// ── Types ────────────────────────────────────────────────────────────────────
interface LlantaForm {
  posicion: string;
  marca: string;
  modeloLlanta: string;   // F: MODELO NEUMÁTICO  (e.g. M729, R297, XDN2)
  medida: string;         // G: MEDIDA
  serie: string;          // H: N° SERIE / DOT
  profundidadOrig: string;// M: PROFUNDIDAD ORIGINAL (mm)
  profundidad: string;    // N: PROFUNDIDAD ACTUAL (mm)
  presionRec: string;     // P: PRESIÓN RECOMENDADA — auto-filled, editable
  presion: string;        // Q: ÚLTIMA PRESIÓN (PSI)
  condicion: string;      // drives S: ESTADO
  observaciones: string;
}

const emptyLlanta = (tipo = '', posicion = ''): LlantaForm => ({
  posicion,
  marca: '',
  modeloLlanta: '',
  medida: '',
  serie: '',
  profundidadOrig: '',
  profundidad: '',
  presionRec: getPresionRecomendada(tipo, posicion),
  presion: '',
  condicion: '',
  observaciones: '',
});

type Step = 'equipo' | 'llanta' | 'success';

let _seq = 1;
function nextSeq() { return String(_seq++); }

// ════════════════════════════════════════════════════════════════════════════
export default function NeumaticosPage() {
  const navigate = useNavigate();

  const [step, setStep]             = useState<Step>('equipo');
  const [selectedUnit, setSelected] = useState('');
  const [horometro, setHorometro]   = useState('');
  const [llanta, setLlanta]         = useState<LlantaForm>(emptyLlanta());
  const [submitting, setSubmitting] = useState(false);
  const [registradas, setRegistradas] = useState<string[]>([]);
  const [errors, setErrors]         = useState<Partial<Record<keyof LlantaForm, string>>>({});

  const equipment       = EQUIPMENT_CATALOG.find((e) => e.unit_id === selectedUnit);
  const positions       = equipment ? (POSITIONS_BY_TYPE[equipment.type] ?? POSITIONS_BY_TYPE.default) : [];
  const available       = positions.filter((p) => !registradas.includes(p));
  const autoEstado      = calcEstado(llanta.condicion, llanta.profundidad, llanta.presion);
  const estadoMeta      = CONDICIONES.find((c) => c.value === llanta.condicion);

  // Set presionRec whenever position changes
  function handlePosicion(pos: string) {
    setLlanta((f) => ({
      ...f,
      posicion: pos,
      presionRec: getPresionRecomendada(equipment?.type ?? '', pos),
    }));
  }

  // ── Validation ─────────────────────────────────────────────────────────
  function validate(): boolean {
    const e: Partial<Record<keyof LlantaForm, string>> = {};
    if (!llanta.posicion)        e.posicion        = 'Requerido';
    if (!llanta.profundidadOrig) e.profundidadOrig = 'Requerido';
    if (!llanta.profundidad)     e.profundidad     = 'Requerido';
    if (!llanta.presion)         e.presion         = 'Requerido';
    if (!llanta.condicion)       e.condicion       = 'Requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit — writes cols A→S (19 values) ───────────────────────────────
  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);

    const fecha = mexicoDate();

    const values: string[] = [
      nextSeq(),                  // A  #
      selectedUnit,               // B  CÓDIGO UNIDAD
      equipment?.model ?? '',     // C  MODELO
      llanta.posicion,            // D  POSICIÓN
      llanta.marca,               // E  MARCA NEUMÁTICO
      llanta.modeloLlanta,        // F  MODELO NEUMÁTICO
      llanta.medida,              // G  MEDIDA
      llanta.serie,               // H  N° SERIE
      '',                         // I  FECHA INSTALACIÓN  (blank)
      '',                         // J  HORÓMETRO INSTALACIÓN (blank)
      horometro,                  // K  HORÓMETRO ACTUAL
      '',                         // L  HORAS USO  (sheet calculates)
      llanta.profundidadOrig,     // M  PROFUNDIDAD ORIGINAL (mm)
      llanta.profundidad,         // N  PROFUNDIDAD ACTUAL (mm)
      '',                         // O  DESGASTE %  (sheet calculates)
      llanta.presionRec,          // P  PRESIÓN RECOMENDADA (PSI)
      llanta.presion,             // Q  ÚLTIMA PRESIÓN (PSI)
      fecha,                      // R  FECHA ÚLT. INSPECCIÓN
      autoEstado,                 // S  ESTADO
    ];

    // Append observaciones as extra col if needed
    if (llanta.observaciones) values.push(llanta.observaciones);

    try {
      await appendRow(SHEET_TABS.NEUMATICOS, values);
      setRegistradas((prev) => [...prev, llanta.posicion]);
      setLlanta(emptyLlanta(equipment?.type ?? '', ''));
      setErrors({});
    } catch {
      // offline-queue will retry
    } finally {
      setSubmitting(false);
    }
  }

  // ── STEP 1: Equipment ──────────────────────────────────────────────────
  if (step === 'equipo') {
    const wheeled = EQUIPMENT_CATALOG.filter(
      (e) => e.type !== 'Bulldozer' && e.type !== 'Excavadora'
    );

    return (
      <div className="flex flex-col py-4 animate-fade-up">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-1">
            <ChevronLeft size={24} color="#162252" />
          </button>
          <Disc3 size={24} color="#162252" />
          <h1 className="text-xl font-bold text-text">Reporte de Neumáticos</h1>
        </div>

        <p className="text-sm text-text-secondary mb-4">Selecciona la unidad a inspeccionar</p>

        <div className="flex flex-col gap-2 mb-6">
          {wheeled.map((eq) => (
            <button
              key={eq.unit_id}
              onClick={() => setSelected(eq.unit_id)}
              className="flex items-center justify-between p-4 rounded-xl border transition-all btn-press"
              style={{
                backgroundColor: selectedUnit === eq.unit_id ? '#EFF6FF' : '#FFFFFF',
                borderColor:     selectedUnit === eq.unit_id ? '#2563EB' : '#E5E7EB',
              }}
            >
              <div className="text-left">
                <p className="font-semibold text-text">{eq.unit_id}</p>
                <p className="text-xs text-text-secondary">{eq.model} · {eq.type}</p>
              </div>
              <span
                className="text-xs font-medium px-2 py-1 rounded-full"
                style={{
                  backgroundColor: eq.status === 'operativo' ? '#DCFCE7' : eq.status === 'alerta' ? '#FEF9C3' : '#FEE2E2',
                  color:           eq.status === 'operativo' ? '#16A34A' : eq.status === 'alerta' ? '#92400E' : '#DC2626',
                }}
              >
                {eq.status}
              </span>
            </button>
          ))}
        </div>

        {selectedUnit && (
          <div className="mb-6 animate-fade-up">
            <label className="block text-sm font-semibold text-text mb-1">
              Horómetro actual (hrs)
            </label>
            <input
              type="number"
              value={horometro}
              onChange={(e) => setHorometro(e.target.value)}
              placeholder={String(equipment?.current_horometro ?? '')}
              className="w-full border border-border rounded-xl px-4 py-3 text-text bg-white"
            />
            <p className="text-xs text-text-secondary mt-1">
              Se registra como "Horómetro Actual" en el Sheet
            </p>
          </div>
        )}

        <button
          disabled={!selectedUnit}
          onClick={() => setStep('llanta')}
          className="w-full py-3 rounded-xl font-semibold text-white"
          style={{ backgroundColor: selectedUnit ? '#162252' : '#9CA3AF' }}
        >
          Continuar → {selectedUnit && `(${positions.length} posiciones)`}
        </button>
      </div>
    );
  }

  // ── SUCCESS ────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-fade-up gap-6">
        <CheckCircle2 size={64} color="#16A34A" />
        <h2 className="text-2xl font-bold text-text text-center">Reporte Completado</h2>
        <p className="text-text-secondary text-center">
          {registradas.length} llanta{registradas.length !== 1 ? 's' : ''} guardada{registradas.length !== 1 ? 's' : ''} en el Sheet
        </p>
        <div className="w-full bg-white rounded-xl p-4 border border-border">
          {registradas.map((pos) => (
            <div key={pos} className="flex items-center gap-2 py-1">
              <CheckCircle2 size={16} color="#16A34A" />
              <span className="text-sm text-text">{pos}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => navigate('/workshop')}
          className="w-full py-3 rounded-xl font-semibold text-white"
          style={{ backgroundColor: '#162252' }}
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  // ── STEP 2: Per-tire form ──────────────────────────────────────────────
  return (
    <div className="flex flex-col py-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setStep('equipo')} className="p-1">
            <ChevronLeft size={24} color="#162252" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-text">{selectedUnit} · Neumáticos</h1>
            <p className="text-xs text-text-secondary">{equipment?.model}</p>
          </div>
        </div>
        <span
          className="text-xs font-semibold px-2 py-1 rounded-full"
          style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}
        >
          {registradas.length}/{positions.length}
        </span>
      </div>

      {/* Registered summary */}
      {registradas.length > 0 && (
        <div className="mb-3 p-3 rounded-xl border" style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}>
          <p className="text-xs font-medium text-success mb-1">Registradas:</p>
          <div className="flex flex-wrap gap-1">
            {registradas.map((p) => (
              <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-white border border-success text-success">{p}</span>
            ))}
          </div>
        </div>
      )}

      {available.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <CheckCircle2 size={48} color="#16A34A" />
          <p className="font-semibold text-text text-center">Todas las posiciones registradas</p>
          <button onClick={() => setStep('success')} className="w-full py-3 rounded-xl font-semibold text-white" style={{ backgroundColor: '#162252' }}>
            Finalizar Reporte
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">

          {/* ─ D: POSICIÓN ─ */}
          <div>
            <label className="block text-sm font-semibold text-text mb-1">
              Posición (col D) *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {available.map((pos) => (
                <button
                  key={pos}
                  onClick={() => handlePosicion(pos)}
                  className="text-sm px-2 py-2.5 rounded-xl border transition-all font-mono"
                  style={{
                    backgroundColor: llanta.posicion === pos ? '#162252' : '#FFFFFF',
                    borderColor:     llanta.posicion === pos ? '#162252' : '#E5E7EB',
                    color:           llanta.posicion === pos ? '#FFFFFF'  : '#374151',
                    fontWeight:      llanta.posicion === pos ? '700' : '400',
                  }}
                >
                  {pos}
                </button>
              ))}
            </div>
            {errors.posicion && <p className="text-xs text-red-500 mt-1">{errors.posicion}</p>}
          </div>

          {/* ─ E + F: MARCA + MODELO NEUMÁTICO ─ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                E · Marca Neumático
              </label>
              <select
                value={llanta.marca}
                onChange={(e) => setLlanta((f) => ({ ...f, marca: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
              >
                <option value="">Seleccionar</option>
                {MARCAS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                F · Modelo Neumático
              </label>
              <input
                type="text"
                value={llanta.modeloLlanta}
                onChange={(e) => setLlanta((f) => ({ ...f, modeloLlanta: e.target.value }))}
                placeholder="M729, R297, XDN2..."
                className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
              />
            </div>
          </div>

          {/* ─ G + H: MEDIDA + N° SERIE ─ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                G · Medida
              </label>
              <input
                type="text"
                value={llanta.medida}
                onChange={(e) => setLlanta((f) => ({ ...f, medida: e.target.value }))}
                placeholder="26.5R25 / 11R22.5"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                H · N° Serie / DOT
              </label>
              <input
                type="text"
                value={llanta.serie}
                onChange={(e) => setLlanta((f) => ({ ...f, serie: e.target.value }))}
                placeholder="DOT 4320"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
              />
            </div>
          </div>

          {/* ─ M + N: PROFUNDIDAD ORIGINAL + ACTUAL ─ */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Ruler size={14} color="#162252" />
              <span className="text-sm font-semibold text-text">Profundidad de Banda *</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  M · Original (mm)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={llanta.profundidadOrig}
                  onChange={(e) => setLlanta((f) => ({ ...f, profundidadOrig: e.target.value }))}
                  placeholder="18"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
                />
                {errors.profundidadOrig && <p className="text-xs text-red-500 mt-0.5">{errors.profundidadOrig}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  N · Actual (mm)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    value={llanta.profundidad}
                    onChange={(e) => setLlanta((f) => ({ ...f, profundidad: e.target.value }))}
                    placeholder="12"
                    className="w-full border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
                    style={{ borderColor: llanta.profundidad ? depthColor(llanta.profundidad) : '#E5E7EB' }}
                  />
                  {llanta.profundidad && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: depthColor(llanta.profundidad) }}>mm</span>
                  )}
                </div>
                {errors.profundidad && <p className="text-xs text-red-500 mt-0.5">{errors.profundidad}</p>}
              </div>
            </div>

            {/* Visual depth bar */}
            {llanta.profundidad && (
              <div className="mt-2">
                <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min((parseFloat(llanta.profundidad) / 20) * 100, 100)}%`,
                      backgroundColor: depthColor(llanta.profundidad),
                    }}
                  />
                </div>
                <p className="text-xs mt-0.5" style={{ color: depthColor(llanta.profundidad) }}>
                  {parseFloat(llanta.profundidad) < 5 ? '⚠️ Crítico — Cambio inmediato'
                    : parseFloat(llanta.profundidad) < 10 ? '⚠️ Advertencia — Programar cambio'
                    : '✓ En rango aceptable'}
                </p>

                {/* Desgaste % preview */}
                {llanta.profundidadOrig && (
                  <p className="text-xs text-text-secondary mt-0.5">
                    Desgaste:{' '}
                    <strong>
                      {Math.round(
                        ((parseFloat(llanta.profundidadOrig) - parseFloat(llanta.profundidad)) /
                          parseFloat(llanta.profundidadOrig)) * 100
                      )}%
                    </strong>
                    {' '}(col O — el Sheet lo calcula automáticamente)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ─ P + Q: PRESIÓN RECOMENDADA + ÚLTIMA PRESIÓN ─ */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Gauge size={14} color="#162252" />
              <span className="text-sm font-semibold text-text">Presión (PSI) *</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  P · Recomendada (PSI)
                </label>
                <input
                  type="number"
                  value={llanta.presionRec}
                  onChange={(e) => setLlanta((f) => ({ ...f, presionRec: e.target.value }))}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-gray-50 text-sm"
                />
                <p className="text-xs text-text-secondary mt-0.5">Auto por tipo/posición</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Q · Medida hoy (PSI)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={llanta.presion}
                    onChange={(e) => setLlanta((f) => ({ ...f, presion: e.target.value }))}
                    placeholder="115"
                    className="w-full border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
                    style={{ borderColor: llanta.presion ? psiColor(llanta.presion) : '#E5E7EB' }}
                  />
                  {llanta.presion && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: psiColor(llanta.presion) }}>PSI</span>
                  )}
                </div>
                {errors.presion && <p className="text-xs text-red-500 mt-0.5">{errors.presion}</p>}
                {llanta.presion && (
                  <p className="text-xs mt-0.5" style={{ color: psiColor(llanta.presion) }}>
                    {parseFloat(llanta.presion) < 70 ? '⚠️ Muy baja — Riesgo reventón'
                      : parseFloat(llanta.presion) < 80 ? '⚠️ Baja — Revisar'
                      : parseFloat(llanta.presion) > 130 ? '⚠️ Alta — Liberar presión'
                      : '✓ Rango normal'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ─ S: ESTADO — auto-calculated, shown as preview ─ */}
          <div>
            <label className="block text-sm font-semibold text-text mb-1">
              Condición Visual → <span style={{ color: '#2563EB' }}>col S ESTADO</span> *
            </label>
            <div className="flex flex-col gap-2">
              {CONDICIONES.map(({ value, color, bg }) => (
                <button
                  key={value}
                  onClick={() => setLlanta((f) => ({ ...f, condicion: value }))}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-sm font-medium"
                  style={{
                    backgroundColor: llanta.condicion === value ? bg : '#FFFFFF',
                    borderColor:     llanta.condicion === value ? color : '#E5E7EB',
                    color:           llanta.condicion === value ? color : '#374151',
                  }}
                >
                  {value}
                  {llanta.condicion === value && <CheckCircle2 size={16} color={color} />}
                </button>
              ))}
            </div>
            {errors.condicion && <p className="text-xs text-red-500 mt-1">{errors.condicion}</p>}

            {/* ESTADO preview */}
            {llanta.condicion && (
              <div
                className="mt-2 flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold"
                style={{
                  backgroundColor: estadoMeta?.bg ?? '#F9FAFB',
                  borderColor: estadoMeta?.color ?? '#E5E7EB',
                  border: '1px solid',
                }}
              >
                <span style={{ color: '#6B7280' }}>Columna S → ESTADO:</span>
                <span style={{ color: estadoMeta?.color ?? '#374151' }}>{autoEstado}</span>
              </div>
            )}
          </div>

          {/* ─ Observaciones ─ */}
          <div>
            <label className="block text-sm font-semibold text-text mb-1">Observaciones</label>
            <textarea
              value={llanta.observaciones}
              onChange={(e) => setLlanta((f) => ({ ...f, observaciones: e.target.value }))}
              placeholder="Cortes, bultos, mordidas, desgaste irregular, hora de reencauche..."
              rows={3}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm resize-none"
            />
          </div>

          {/* ─ Critical warning ─ */}
          {(parseFloat(llanta.profundidad) < 5 || parseFloat(llanta.presion) < 70 || llanta.condicion === 'Cambio Urgente') && (
            <div className="flex items-start gap-2 p-3 rounded-xl" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <AlertTriangle size={18} color="#DC2626" className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Atención crítica</p>
                <p className="text-xs text-red-600">Notifica al Supervisor inmediatamente. No operar la unidad hasta revisión.</p>
              </div>
            </div>
          )}

          {/* ─ Buttons ─ */}
          <div className="flex gap-3 mt-1 pb-8">
            <button
              disabled={submitting}
              onClick={handleSubmit}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white"
              style={{ backgroundColor: '#162252' }}
            >
              {submitting
                ? <Loader2 size={18} className="animate-spin" />
                : <><Disc3 size={18} /> Registrar Llanta</>}
            </button>
            {registradas.length > 0 && (
              <button
                onClick={() => setStep('success')}
                className="px-5 py-3 rounded-xl font-semibold border"
                style={{ borderColor: '#162252', color: '#162252', backgroundColor: '#FFFFFF' }}
              >
                Finalizar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

## File: src/pages/PedidosPage.tsx
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  Loader2,
  PackageSearch,
  AlertCircle,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useCartStore, type CartItem } from '../stores/cart-store';
import { appendRow, readRange, updateCell, SHEET_TABS } from '../lib/sheets-api';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { mexicoDate, mexicoTime } from '../lib/date-utils';

// ── Sheet columns for Cotizaciones_Pendientes (matching actual Sheet headers) ─
// A(0)  Fecha
// B(1)  Part_Number
// C(2)  Descripcion
// D(3)  Equipo
// E(4)  Qty
// F(5)  Dealer          ← source / OEM / Manual
// G(6)  Status          ← Pendiente / Pedido / Completado
// H(7)  Precio_Recibido ← blank on submit; supplier fills later
// I(8)  Fecha_Respuesta ← blank on submit; supplier fills later
// J(9)  PEDIDO_ID       ← tracking reference
// K(10) Hora
// L(11) Solicitante
// M(12) Urgencia
// N(13) Notas
// O(14) Total

const URGENCIA_CONFIG = {
  Normal:  { color: '#16A34A', bg: '#F0FDF4' },
  Urgente: { color: '#D97706', bg: '#FFFBEB' },
  Crítico: { color: '#DC2626', bg: '#FEF2F2' },
} as const;

const EQUIPMENT_OPTIONS = EQUIPMENT_CATALOG.map((e) => e.unit_id);

let _pedidoSeq = 1;
function newPedidoId(): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `PED-${d}-${String(_pedidoSeq++).padStart(3, '0')}`;
}

// ── Manual part form ─────────────────────────────────────────────────────────
interface ManualForm {
  part_number: string;
  description: string;
  quantity: string;
  unit_price: string;
  equipment: string;
  urgencia: 'Normal' | 'Urgente' | 'Crítico';
  notes: string;
}

const emptyManual = (): ManualForm => ({
  part_number: '',
  description: '',
  quantity: '1',
  unit_price: '0',
  equipment: '',
  urgencia: 'Normal',
  notes: '',
});

// ── Submitted order row (read from sheet) ────────────────────────────────────
interface PedidoRow {
  id: string;
  pedidoId: string;
  fecha: string;
  hora: string;
  solicitante: string;
  partNum: string;
  descripcion: string;
  equipo: string;
  cantidad: string;
  precioUnit: string;
  total: string;
  urgencia: string;
  fuente: string;
  notas: string;
  estado: string;
}

type Tab = 'carrito' | 'historial';

// ════════════════════════════════════════════════════════════════════════════
export default function PedidosPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const userName = useAuthStore((s) => s.userName);
  const { items, removeItem, updateItem, clearCart } = useCartStore();

  const isJT = role === 'jefe_taller';
  const isGerencia = role === 'gerencia';

  const [tab, setTab] = useState<Tab>(isGerencia ? 'historial' : 'carrito');
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState<ManualForm>(emptyManual());
  const [manualErrors, setManualErrors] = useState<Partial<ManualForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [historial, setHistorial] = useState<PedidoRow[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [historialLoaded, setHistorialLoaded] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  // ── Load historial ────────────────────────────────────────────────────────
  async function loadHistorial() {
    if (historialLoaded) return;
    setLoadingHistorial(true);
    try {
      const rows = await readRange(SHEET_TABS.COTIZACIONES);
      // rows[0] = headers, rows[1..] = data
      const data = rows.slice(1).map((r, idx) => ({
        id:          String(idx),
        pedidoId:    r[9]  ?? '',   // J: PEDIDO_ID
        fecha:       r[0]  ?? '',   // A: Fecha
        hora:        r[10] ?? '',   // K: Hora
        solicitante: r[11] ?? '',   // L: Solicitante
        partNum:     r[1]  ?? '',   // B: Part_Number
        descripcion: r[2]  ?? '',   // C: Descripcion
        equipo:      r[3]  ?? '',   // D: Equipo
        cantidad:    r[4]  ?? '',   // E: Qty
        precioUnit:  r[7]  ?? '',   // H: Precio_Recibido
        total:       r[14] ?? '',   // O: Total
        urgencia:    r[12] ?? '',   // M: Urgencia
        fuente:      r[5]  ?? '',   // F: Dealer
        notas:       r[13] ?? '',   // N: Notas
        estado:      r[6]  ?? 'Pendiente', // G: Status
      }));
      setHistorial(data.reverse()); // newest first
      setHistorialLoaded(true);
    } catch {
      setHistorial([]);
    } finally {
      setLoadingHistorial(false);
    }
  }

  function handleTabChange(t: Tab) {
    setTab(t);
    if (t === 'historial' && !historialLoaded) loadHistorial();
  }

  // ── Status change (Gerencia only) ─────────────────────────────────────────
  function handleStatusChange(rowId: string, newStatus: string) {
    setHistorial((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, estado: newStatus } : r))
    );
  }

  // ── Manual part validation ────────────────────────────────────────────────
  function validateManual(): boolean {
    const e: Partial<ManualForm> = {};
    if (!manual.part_number.trim()) e.part_number = 'Requerido';
    if (!manual.description.trim()) e.description = 'Requerido';
    if (!manual.quantity || isNaN(Number(manual.quantity)) || Number(manual.quantity) < 1) e.quantity = 'Mín 1';
    setManualErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleAddManual() {
    if (!validateManual()) return;
    useCartStore.getState().addItem({
      part_number: manual.part_number.trim().toUpperCase(),
      description: manual.description.trim(),
      quantity: Number(manual.quantity),
      unit_price: Number(manual.unit_price) || 0,
      equipment: manual.equipment,
      urgencia: manual.urgencia,
      notes: manual.notes,
      isManual: true,
      source: 'Manual',
    });
    setManual(emptyManual());
    setManualErrors({});
    setShowManual(false);
  }

  // ── Submit cart → Sheet ───────────────────────────────────────────────────
  async function handleSubmit() {
    if (items.length === 0) return;
    setSubmitting(true);
    const fecha = mexicoDate();
    const hora = mexicoTime();
    const pedidoId = newPedidoId();

    try {
      await Promise.all(
        items.map((item) =>
          appendRow(SHEET_TABS.COTIZACIONES, [
            fecha,                                              // A: Fecha
            item.part_number,                                   // B: Part_Number
            item.description,                                   // C: Descripcion
            item.equipment,                                     // D: Equipo
            String(item.quantity),                              // E: Qty
            item.isManual ? 'Manual' : item.source,             // F: Dealer
            'Pendiente',                                        // G: Status
            '',                                                 // H: Precio_Recibido (proveedor llena)
            '',                                                 // I: Fecha_Respuesta (proveedor llena)
            pedidoId,                                           // J: PEDIDO_ID
            hora,                                               // K: Hora
            userName,                                           // L: Solicitante
            item.urgencia,                                      // M: Urgencia
            item.notes,                                         // N: Notas
            (item.quantity * item.unit_price).toFixed(2),       // O: Total
          ])
        )
      );
      clearCart();
      setSubmitted(true);
      setHistorialLoaded(false); // force reload next time
    } catch {
      // silent — offline queue retries
    } finally {
      setSubmitting(false);
    }
  }

  // ── SUCCESS screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6 animate-fade-up">
        <CheckCircle2 size={64} color="#16A34A" />
        <h2 className="text-2xl font-bold text-text text-center">Pedido Enviado</h2>
        <p className="text-text-secondary text-center text-sm">
          El pedido fue registrado en el Sheet.<br />Gerencia recibirá la notificación.
        </p>
        <button
          onClick={() => { setSubmitted(false); navigate('/workshop'); }}
          className="w-full py-3 rounded-xl font-semibold text-white"
          style={{ backgroundColor: '#162252' }}
        >
          Volver al Inicio
        </button>
        <button
          onClick={() => { setSubmitted(false); handleTabChange('historial'); }}
          className="w-full py-3 rounded-xl font-semibold border"
          style={{ borderColor: '#162252', color: '#162252' }}
        >
          Ver Historial
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col py-4 animate-fade-up">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <ShoppingCart size={24} color="#162252" />
        <h1 className="text-xl font-bold text-text">Pedidos de Refacciones</h1>
      </div>

      {/* ── Tabs ── */}
      <div className="flex mb-5 rounded-xl overflow-hidden border border-border">
        {isJT && (
          <button
            onClick={() => handleTabChange('carrito')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: tab === 'carrito' ? '#162252' : '#FFFFFF',
              color: tab === 'carrito' ? '#FFFFFF' : '#6B7280',
            }}
          >
            <ShoppingCart size={15} />
            Carrito
            {items.length > 0 && (
              <span
                className="rounded-full text-xs px-1.5 py-0.5 font-bold"
                style={{
                  backgroundColor: tab === 'carrito' ? '#F59E0B' : '#162252',
                  color: '#FFFFFF',
                }}
              >
                {items.length}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => handleTabChange('historial')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors"
          style={{
            backgroundColor: tab === 'historial' ? '#162252' : '#FFFFFF',
            color: tab === 'historial' ? '#FFFFFF' : '#6B7280',
          }}
        >
          <ClipboardList size={15} />
          {isGerencia ? 'Pedidos Pendientes' : 'Historial'}
        </button>
      </div>

      {/* ════════════════════ CARRITO TAB ════════════════════ */}
      {tab === 'carrito' && isJT && (
        <div className="flex flex-col gap-4">

          {/* Empty carrito */}
          {items.length === 0 && !showManual && (
            <div className="flex flex-col items-center gap-4 py-10">
              <PackageSearch size={48} color="#9CA3AF" />
              <p className="text-text-secondary text-center">
                Tu carrito está vacío.<br />
                Busca refacciones en <strong>Partes</strong> y agrega las que necesitas.
              </p>
              <button
                onClick={() => navigate('/parts')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white"
                style={{ backgroundColor: '#162252' }}
              >
                <Search size={16} />
                Ir a Partes
              </button>
              <button
                onClick={() => setShowManual(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold border"
                style={{ borderColor: '#162252', color: '#162252' }}
              >
                <Plus size={16} />
                Agregar parte manual
              </button>
            </div>
          )}

          {/* Cart items */}
          {items.map((item) => (
            <CartItemCard
              key={item.cartId}
              item={item}
              expanded={expandedItem === item.cartId}
              onToggle={() => setExpandedItem(expandedItem === item.cartId ? null : item.cartId)}
              onUpdate={(updates) => updateItem(item.cartId, updates)}
              onRemove={() => removeItem(item.cartId)}
            />
          ))}

          {/* Add manual part toggle */}
          {items.length > 0 && !showManual && (
            <button
              onClick={() => setShowManual(true)}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border-dashed border-2 text-sm font-medium transition-colors"
              style={{ borderColor: '#162252', color: '#162252' }}
            >
              <Plus size={16} />
              Agregar parte manual
            </button>
          )}

          {/* Manual entry form */}
          {showManual && (
            <ManualPartForm
              form={manual}
              errors={manualErrors}
              onChange={(f) => setManual(f)}
              onAdd={handleAddManual}
              onCancel={() => { setShowManual(false); setManual(emptyManual()); setManualErrors({}); }}
            />
          )}

          {/* Order summary + submit */}
          {items.length > 0 && (
            <div className="mt-2">
              {/* Summary */}
              <div
                className="rounded-xl p-4 mb-3"
                style={{ backgroundColor: '#F1F5F9', border: '1px solid #E5E7EB' }}
              >
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-secondary">Total partes:</span>
                  <span className="font-semibold text-text">{totalItems} piezas</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-secondary">Líneas:</span>
                  <span className="font-semibold text-text">{items.length}</span>
                </div>
                <div className="flex justify-between text-base font-bold mt-2 pt-2 border-t border-border">
                  <span className="text-text">Total estimado:</span>
                  <span style={{ color: '#162252' }}>${totalPrice.toFixed(2)}</span>
                </div>
              </div>

              {/* Crítico warning */}
              {items.some((i) => i.urgencia === 'Crítico') && (
                <div
                  className="flex items-center gap-2 p-3 rounded-xl mb-3"
                  style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
                >
                  <AlertCircle size={16} color="#DC2626" />
                  <p className="text-xs text-red-700 font-medium">
                    Hay partes marcadas como Crítico — notifica al Supervisor inmediatamente.
                  </p>
                </div>
              )}

              <button
                disabled={submitting}
                onClick={handleSubmit}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white text-base"
                style={{ backgroundColor: '#162252' }}
              >
                {submitting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <Send size={18} />
                    Enviar Pedido ({items.length} {items.length === 1 ? 'parte' : 'partes'})
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════ HISTORIAL TAB ════════════════════ */}
      {tab === 'historial' && (
        <div className="flex flex-col gap-3">
          {loadingHistorial && (
            <div className="flex justify-center py-10">
              <Loader2 size={28} className="animate-spin" style={{ color: '#162252' }} />
            </div>
          )}

          {!loadingHistorial && historial.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-10">
              <ClipboardList size={48} color="#9CA3AF" />
              <p className="text-text-secondary text-center text-sm">
                No hay pedidos registrados aún.
              </p>
            </div>
          )}

          {historial.map((row) => (
            <PedidoRowCard
              key={row.id}
              row={row}
              isGerencia={isGerencia}
              onStatusChange={handleStatusChange}
            />
          ))}

          {!loadingHistorial && historial.length > 0 && (
            <button
              onClick={() => { setHistorialLoaded(false); loadHistorial(); }}
              className="text-center text-sm py-2"
              style={{ color: '#2563EB' }}
            >
              ↺ Actualizar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── CartItemCard ─────────────────────────────────────────────────────────────
function CartItemCard({
  item,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
}: {
  item: CartItem;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (u: Partial<CartItem>) => void;
  onRemove: () => void;
}) {
  const urgCfg = URGENCIA_CONFIG[item.urgencia] ?? URGENCIA_CONFIG.Normal;

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Collapsed header */}
      <div className="flex items-center gap-3 p-3">
        {/* Urgencia dot */}
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: urgCfg.color }}
        />
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-semibold text-amber truncate">{item.part_number}</p>
          <p className="text-xs text-text-secondary truncate">{item.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-bold text-text">×{item.quantity}</span>
          <button onClick={onToggle} className="p-1">
            {expanded ? <ChevronUp size={16} color="#6B7280" /> : <ChevronDown size={16} color="#6B7280" />}
          </button>
          <button onClick={onRemove} className="p-1">
            <Trash2 size={16} color="#DC2626" />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2 flex flex-col gap-3">
          {/* Equipo */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Equipo / Unidad</label>
            <select
              value={item.equipment}
              onChange={(e) => onUpdate({ equipment: e.target.value })}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text bg-white"
            >
              <option value="">Sin asignar</option>
              {EQUIPMENT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {/* Qty + Urgencia */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Cantidad</label>
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => onUpdate({ quantity: Math.max(1, Number(e.target.value)) })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Urgencia</label>
              <select
                value={item.urgencia}
                onChange={(e) => onUpdate({ urgencia: e.target.value as CartItem['urgencia'] })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text bg-white"
              >
                <option>Normal</option>
                <option>Urgente</option>
                <option>Crítico</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Notas</label>
            <input
              type="text"
              value={item.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="Número de avería, referencia, etc."
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text bg-white"
            />
          </div>

          {/* Price row */}
          <div className="flex justify-between text-sm pt-1 border-t border-border">
            <span className="text-text-secondary">
              {item.isManual ? '📝 Parte manual' : `📦 ${item.source}`}
            </span>
            <span className="font-bold text-text">
              ${(item.quantity * item.unit_price).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ManualPartForm ───────────────────────────────────────────────────────────
function ManualPartForm({
  form,
  errors,
  onChange,
  onAdd,
  onCancel,
}: {
  form: ManualForm;
  errors: Partial<ManualForm>;
  onChange: (f: ManualForm) => void;
  onAdd: () => void;
  onCancel: () => void;
}) {
  const f = (field: keyof ManualForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...form, [field]: e.target.value });

  return (
    <div
      className="rounded-xl border-2 p-4 flex flex-col gap-3 animate-fade-up"
      style={{ borderColor: '#2563EB', backgroundColor: '#EFF6FF' }}
    >
      <p className="font-semibold text-sm" style={{ color: '#1E3A8A' }}>
        ➕ Agregar parte manualmente
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">N° de Parte *</label>
          <input
            type="text"
            value={form.part_number}
            onChange={f('part_number')}
            placeholder="Ej: 6745-11-3102"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          />
          {errors.part_number && <p className="text-xs text-red-500 mt-0.5">{errors.part_number}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Cantidad *</label>
          <input
            type="number"
            min={1}
            value={form.quantity}
            onChange={f('quantity')}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          />
          {errors.quantity && <p className="text-xs text-red-500 mt-0.5">{errors.quantity}</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">Descripción *</label>
        <input
          type="text"
          value={form.description}
          onChange={f('description')}
          placeholder="Nombre o descripción de la parte"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
        />
        {errors.description && <p className="text-xs text-red-500 mt-0.5">{errors.description}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Precio Unit. ($)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.unit_price}
            onChange={f('unit_price')}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Urgencia</label>
          <select
            value={form.urgencia}
            onChange={f('urgencia')}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          >
            <option>Normal</option>
            <option>Urgente</option>
            <option>Crítico</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">Equipo / Unidad</label>
        <select
          value={form.equipment}
          onChange={f('equipment')}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
        >
          <option value="">Sin asignar</option>
          {EQUIPMENT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">Notas</label>
        <input
          type="text"
          value={form.notes}
          onChange={f('notes')}
          placeholder="Referencia, avería relacionada..."
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onAdd}
          className="flex-1 py-2.5 rounded-xl font-semibold text-white text-sm"
          style={{ backgroundColor: '#162252' }}
        >
          Agregar al carrito
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl font-semibold text-sm border"
          style={{ borderColor: '#D1D5DB', color: '#6B7280' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Status flow config ────────────────────────────────────────────────────────
const STATUS_NEXT: Record<string, string | null> = {
  Pendiente:  'Pedido',
  Pedido:     'Completado',
  Completado: null,
};

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  Pendiente:  { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  Pedido:     { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  Completado: { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
};

const STATUS_LABEL: Record<string, string> = {
  Pendiente:  'Marcar como Pedido',
  Pedido:     'Marcar Completado',
  Completado: '',
};

// ── PedidoRowCard (Historial / Gerencia view) ────────────────────────────────
function PedidoRowCard({
  row,
  isGerencia,
  onStatusChange,
}: {
  row: PedidoRow;
  isGerencia: boolean;
  onStatusChange: (id: string, newStatus: string) => void;
}) {
  const [updating, setUpdating] = useState(false);
  const urgCfg = (URGENCIA_CONFIG as Record<string, { color: string; bg: string }>)[row.urgencia] ?? URGENCIA_CONFIG.Normal;
  const sCfg = STATUS_STYLE[row.estado] ?? STATUS_STYLE.Pendiente;
  const nextStatus = STATUS_NEXT[row.estado] ?? null;

  async function handleAdvance() {
    if (!nextStatus || updating) return;
    setUpdating(true);
    try {
      // Column J (index 9) = PEDIDO_ID, Column G (index 6) = Status
      await updateCell(SHEET_TABS.COTIZACIONES, 9, row.pedidoId, 6, nextStatus);
      onStatusChange(row.id, nextStatus);
    } catch {
      // silently fail — state not updated
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div
      className="bg-white rounded-xl shadow-sm overflow-hidden"
      style={{ border: `1.5px solid ${sCfg.border}` }}
    >
      {/* Status bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ backgroundColor: sCfg.bg }}
      >
        <span className="text-xs font-bold" style={{ color: sCfg.color }}>
          {row.estado}
        </span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: urgCfg.color, backgroundColor: urgCfg.bg }}>
          {row.urgencia}
        </span>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="mb-2">
          <p className="font-mono text-sm font-semibold text-amber">{row.partNum}</p>
          <p className="text-sm text-text font-medium">{row.descripcion}</p>
          <p className="text-xs text-text-secondary mt-0.5">
            {row.pedidoId} · {row.fecha} · {row.solicitante}
          </p>
        </div>
        <div className="flex gap-4 text-xs text-text-secondary mb-3">
          {row.equipo && <span>📍 {row.equipo}</span>}
          <span>×{row.cantidad}</span>
          {row.total && <span className="font-semibold text-text">${row.total}</span>}
          {row.fuente && <span>{row.fuente}</span>}
        </div>
        {row.notas && <p className="text-xs text-text-secondary mb-3 italic">{row.notas}</p>}

        {/* Gerencia status action */}
        {isGerencia && nextStatus && (
          <button
            onClick={handleAdvance}
            disabled={updating}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-opacity"
            style={{
              backgroundColor: STATUS_STYLE[nextStatus]?.bg ?? '#F1F5F9',
              color: STATUS_STYLE[nextStatus]?.color ?? '#162252',
              border: `1.5px solid ${STATUS_STYLE[nextStatus]?.border ?? '#E5E7EB'}`,
              opacity: updating ? 0.6 : 1,
            }}
          >
            {updating ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <>
                <ArrowRight size={15} />
                {STATUS_LABEL[row.estado]}
              </>
            )}
          </button>
        )}

        {/* Completado — no further action */}
        {isGerencia && row.estado === 'Completado' && (
          <div className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold" style={{ color: '#16A34A' }}>
            <CheckCircle2 size={14} />
            Pedido completado
          </div>
        )}
      </div>
    </div>
  );
}
```

## File: src/pages/PerfilPage.tsx
```typescript
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { ROLE_LABELS } from '../types/roles';

interface ScoreCategory {
  label: string;
  score: number;
  max: number;
}

interface Certification {
  name: string;
  expiry: string;
  status: 'vigente' | 'vencido';
}

const SCORE_CATEGORIES: ScoreCategory[] = [
  { label: 'Inspecciones', score: 18, max: 20 },
  { label: 'Condición Equipo', score: 22, max: 25 },
  { label: 'Combustible', score: 13, max: 15 },
  { label: 'Horas', score: 19, max: 20 },
  { label: 'Seguridad', score: 6, max: 20 },
];

const CERTIFICATIONS: Certification[] = [
  { name: 'DC-3 STPS', expiry: '15 Sep 2026', status: 'vigente' },
  { name: 'Operación Equipo Pesado', expiry: '3 Mar 2027', status: 'vigente' },
];

const totalScore = SCORE_CATEGORIES.reduce((sum, c) => sum + c.score, 0);
const totalMax = SCORE_CATEGORIES.reduce((sum, c) => sum + c.max, 0);

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-amber' : 'bg-critical';

  return (
    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function PerfilPage() {
  const navigate = useNavigate();

  const userName = useAuthStore((s) => s.userName);
  const role = useAuthStore((s) => s.role);
  const assignedUnits = useAuthStore((s) => s.assignedUnits);

  const roleLabel = role ? ROLE_LABELS[role] : 'Sin rol';
  const initials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const unitLabel = assignedUnits.length > 0 ? assignedUnits[0] : '';

  const overallPct = Math.round((totalScore / totalMax) * 100);
  const arcColor = overallPct >= 80 ? '#16A34A' : overallPct >= 50 ? '#2563EB' : '#DC2626';

  return (
    <div className="flex flex-col pb-4 gap-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Mi Perfil</h1>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-border flex flex-col items-center gap-3">
        {/* Avatar */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md"
          style={{ backgroundColor: '#2563EB' }}
        >
          {initials}
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-text">{userName}</h2>
          <p className="text-text-secondary mt-0.5">{roleLabel}</p>
          {unitLabel && (
            <p className="text-sm text-amber font-medium mt-1">{unitLabel}</p>
          )}
        </div>
      </div>

      {/* Score card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border">
        <h3 className="font-semibold text-text mb-4">Desempeño</h3>

        {/* Total score with arc */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="32" fill="none" stroke="#E5E7EB" strokeWidth="8" />
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke={arcColor}
                strokeWidth="8"
                strokeDasharray={`${overallPct * 2.01} 201`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-text" style={{ transform: 'rotate(90deg) translateX(2px)' }}>
                {overallPct}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-text">{totalScore}/{totalMax}</p>
            <p className="text-text-secondary text-sm">Puntuación total</p>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="flex flex-col gap-3">
          {SCORE_CATEGORIES.map((cat) => (
            <div key={cat.label} className="flex items-center gap-3">
              <span className="text-sm text-text w-36 shrink-0">{cat.label}</span>
              <ScoreBar score={cat.score} max={cat.max} />
              <span className="text-sm font-semibold text-text w-12 text-right shrink-0">
                {cat.score}/{cat.max}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Ranking */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex items-center gap-3">
        <div className="bg-amber/10 rounded-full p-3">
          <Trophy size={24} className="text-amber" />
        </div>
        <div>
          <p className="font-semibold text-text">Posición en ranking</p>
          <p className="text-text-secondary text-sm">3° de 15 operadores</p>
        </div>
        <div className="ml-auto text-3xl font-bold text-amber">#3</div>
      </div>

      {/* Certifications */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border">
        <h3 className="font-semibold text-text mb-3">Certificaciones</h3>
        <div className="flex flex-col gap-3">
          {CERTIFICATIONS.map((cert) => (
            <div
              key={cert.name}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
            >
              <div>
                <p className="font-medium text-text text-sm">{cert.name}</p>
                <p className="text-text-secondary text-xs mt-0.5">Vence: {cert.expiry}</p>
              </div>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  cert.status === 'vigente'
                    ? 'bg-green-100 text-success'
                    : 'bg-red-100 text-critical'
                }`}
              >
                {cert.status === 'vigente' ? 'Vigente' : 'Vencido'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## File: src/pages/WorkOrdersPage.tsx
```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkOrderStore } from '../stores/workorder-store';
import OTCard from '../components/ui/OTCard';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import PullIndicator from '../components/ui/PullIndicator';

type FilterKey = 'Todas' | 'CRITICA' | 'ALTA' | 'MEDIA' | 'Nuevo' | 'En Proceso' | 'Esperando Pieza';

const FILTER_OPTIONS: FilterKey[] = ['Todas', 'CRITICA', 'ALTA', 'MEDIA', 'Nuevo', 'En Proceso', 'Esperando Pieza'];

const FILTER_LABELS: Record<FilterKey, string> = {
  Todas: 'Todas',
  CRITICA: 'Critica',
  ALTA: 'Alta',
  MEDIA: 'Media',
  Nuevo: 'Nuevo',
  'En Proceso': 'En Proceso',
  'Esperando Pieza': 'Esperando Pieza',
};

export default function WorkOrdersPage() {
  const navigate = useNavigate();
  const { workorders, loading, error, fetched, fetchWorkOrders } = useWorkOrderStore();
  const [filter, setFilter] = useState<FilterKey>('Todas');

  const { scrollRef, onTouchStart, onTouchMove, onTouchEnd, pullDistance, refreshing, pullIndicatorStyle, isReady } =
    usePullToRefresh({ onRefresh: fetchWorkOrders });

  useEffect(() => {
    if (!fetched) {
      fetchWorkOrders();
    }
  }, [fetched, fetchWorkOrders]);

  // Hide completed OTs by default — only show them if specifically filtered
  const active = workorders.filter((ot) => ot.estado !== 'Completado');
  const filtered = filter === 'Todas'
    ? active
    : workorders.filter((ot) =>
        ot.prioridad === filter || ot.prioridad?.toUpperCase() === filter || ot.estado === filter
      );

  if (loading && !fetched) {
    return (
      <div className="py-4">
        <h2 className="font-semibold text-lg text-text mb-3">Órdenes de Trabajo</h2>
        <SkeletonList count={4} />
      </div>
    );
  }

  if (error && workorders.length === 0) {
    return (
      <div className="py-4">
        <h2 className="font-semibold text-lg text-text mb-3">Ordenes de Trabajo</h2>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-border text-center">
          <p className="text-red-600 text-sm mb-2">Error al cargar ordenes</p>
          <p className="text-xs text-text-secondary mb-3">{error}</p>
          <button
            type="button"
            onClick={() => fetchWorkOrders()}
            className="px-4 py-2 bg-amber text-white rounded-xl text-sm font-medium"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="py-4 animate-fade-up overflow-y-auto"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <PullIndicator
        pullDistance={pullDistance}
        refreshing={refreshing}
        isReady={isReady}
        style={pullIndicatorStyle}
      />

      <h2 className="font-semibold text-lg text-text mb-3">Órdenes de Trabajo</h2>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 mb-2">
        {FILTER_OPTIONS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-colors ${
              filter === key
                ? 'bg-amber text-white'
                : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
            }`}
          >
            {FILTER_LABELS[key]}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          type="workorders"
          title="Sin órdenes"
          description="No hay órdenes de trabajo con este filtro"
        />
      ) : (
        filtered.map((ot) => (
          <OTCard
            key={ot.ot_id}
            workorder={ot}
            onClick={() => navigate(`/workorders/${ot.ot_id}`)}
          />
        ))
      )}
    </div>
  );
}
```

## File: src/stores/workorder-store.ts
```typescript
import { create } from 'zustand';
import { readRange, appendRow, updateCell, SHEET_TABS } from '../lib/sheets-api';
import { MOCK_WORKORDERS } from '../data/mock-workorders';
import type { WorkOrder, StatusLogEntry, OTStatusField, OTEstado, OTPriority } from '../types/workorder';
import { mexicoDate, mexicoTime } from '../lib/date-utils';

/** Wrap a promise with a timeout. Rejects if not resolved in ms. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    ),
  ]);
}

interface WorkOrderState {
  workorders: WorkOrder[];
  statusLog: StatusLogEntry[];
  loading: boolean;
  error: string | null;
  fetched: boolean;
  fetchWorkOrders: () => Promise<void>;
  updateOTField: (
    otId: string,
    field: OTStatusField,
    newValue: string,
    changedBy: string,
    role: string,
  ) => Promise<void>;
  getWorkOrderById: (otId: string) => WorkOrder | undefined;
}

function parseWorkOrderRow(row: string[]): WorkOrder | null {
  if (!row[1] || !row[1].startsWith('OT-')) return null;
  return {
    ot_id: row[1] ?? '',
    fecha: row[2] ?? '',
    unidad: row[3] ?? '',
    tipo_averia: row[4] ?? '',
    descripcion: row[5] ?? '',
    severidad: row[6] ?? '',
    prioridad: (row[7] ?? 'MEDIA') as OTPriority,
    mecanico_asignado: row[8] ?? '',
    estado: (row[9] ?? 'Nuevo') as OTEstado,
    foto_url: row[10] ?? '',
    averia_ref: row[11] ?? '',
    partes_necesarias: row[12] ?? '',
    costo_estimado: Number(row[13]) || 0,
    fecha_cierre: row[14] ?? '',
    observaciones: row[15] ?? '',
    progreso: 0,
  };
}

function parseStatusLogRow(row: string[]): StatusLogEntry | null {
  if (!row[1] || !row[1].startsWith('OT-')) return null;
  return {
    timestamp: row[0] ?? '',
    ot_id: row[1] ?? '',
    field: (row[2] ?? 'estado') as OTStatusField,
    old_value: row[3] ?? '',
    new_value: row[4] ?? '',
    changed_by: row[5] ?? '',
    role: row[6] ?? '',
  };
}

function applyStatusLog(workorders: WorkOrder[], log: StatusLogEntry[]): WorkOrder[] {
  const sorted = [...log].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const woMap = new Map<string, WorkOrder>();
  for (const wo of workorders) {
    woMap.set(wo.ot_id, { ...wo });
  }
  for (const entry of sorted) {
    const wo = woMap.get(entry.ot_id);
    if (!wo) continue;
    switch (entry.field) {
      case 'estado':
        wo.estado = entry.new_value as OTEstado;
        break;
      case 'mecanico_asignado':
        wo.mecanico_asignado = entry.new_value;
        break;
      case 'progreso':
        wo.progreso = Number(entry.new_value) || 0;
        break;
      case 'observaciones':
        wo.observaciones = entry.new_value;
        break;
      case 'costo_estimado':
        wo.costo_estimado = Number(entry.new_value) || 0;
        break;
      case 'prioridad':
        wo.prioridad = entry.new_value as OTPriority;
        break;
    }
    woMap.set(wo.ot_id, wo);
  }
  return Array.from(woMap.values());
}

export const useWorkOrderStore = create<WorkOrderState>((set, get) => ({
  workorders: [],
  statusLog: [],
  loading: false,
  error: null,
  fetched: false,

  fetchWorkOrders: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const [otResult, logResult] = await Promise.allSettled([
        withTimeout(readRange(SHEET_TABS.ORDENES_TRABAJO), 10000),
        withTimeout(readRange(SHEET_TABS.OT_STATUS_LOG), 10000),
      ]);

      const otRows = otResult.status === 'fulfilled' ? otResult.value : [];
      const logRows = logResult.status === 'fulfilled' ? logResult.value : [];

      const baseWorkorders: WorkOrder[] = [];
      for (const row of otRows) {
        const wo = parseWorkOrderRow(row);
        if (wo) baseWorkorders.push(wo);
      }

      // If no sheet data found, use mock data as fallback
      if (baseWorkorders.length === 0) {
        set({ workorders: MOCK_WORKORDERS, statusLog: [], loading: false, fetched: true });
        return;
      }

      const statusLog: StatusLogEntry[] = [];
      for (const row of logRows) {
        const entry = parseStatusLogRow(row);
        if (entry) statusLog.push(entry);
      }

      const workorders = applyStatusLog(baseWorkorders, statusLog);
      set({ workorders, statusLog, loading: false, fetched: true });
    } catch (err: unknown) {
      // On error, fall back to mock data so the page isn't blank
      set({ workorders: MOCK_WORKORDERS, statusLog: [], error: null, loading: false, fetched: true });
    }
  },

  updateOTField: async (otId, field, newValue, changedBy, role) => {
    const wo = get().workorders.find((w) => w.ot_id === otId);
    if (!wo) return;

    const oldValue = String(wo[field] ?? '');
    const timestamp = `${mexicoDate()} ${mexicoTime()}`;

    const entry: StatusLogEntry = {
      timestamp,
      ot_id: otId,
      field,
      old_value: oldValue,
      new_value: newValue,
      changed_by: changedBy,
      role,
    };

    // Optimistic update
    set((state) => {
      const updatedLog = [...state.statusLog, entry];
      const updatedWOs = state.workorders.map((w) => {
        if (w.ot_id !== otId) return w;
        const updated = { ...w };
        switch (field) {
          case 'estado':
            updated.estado = newValue as OTEstado;
            break;
          case 'mecanico_asignado':
            updated.mecanico_asignado = newValue;
            break;
          case 'progreso':
            updated.progreso = Number(newValue) || 0;
            break;
          case 'observaciones':
            updated.observaciones = newValue;
            break;
          case 'costo_estimado':
            updated.costo_estimado = Number(newValue) || 0;
            break;
          case 'prioridad':
            updated.prioridad = newValue as OTPriority;
            break;
        }
        return updated;
      });
      return { workorders: updatedWOs, statusLog: updatedLog };
    });

    try {
      // 1. Write to status log (audit trail)
      await appendRow(SHEET_TABS.OT_STATUS_LOG, [
        timestamp,
        otId,
        field,
        oldValue,
        newValue,
        changedBy,
        role,
      ]);

      // 2. Also update the ORDENES_TRABAJO sheet directly
      // Column mapping: OT_ID=1, ESTADO=9, MECANICO=8, PRIORIDAD=7
      const FIELD_TO_COLUMN: Record<string, number> = {
        estado: 9,
        mecanico_asignado: 8,
        prioridad: 7,
        observaciones: 15,
      };
      const col = FIELD_TO_COLUMN[field];
      if (col !== undefined) {
        try {
          await updateCell(SHEET_TABS.ORDENES_TRABAJO, 1, otId, col, newValue);
        } catch {
          // Non-critical — the log is the source of truth
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar';
      set({ error: message });
    }
  },

  getWorkOrderById: (otId) => {
    return get().workorders.find((w) => w.ot_id === otId);
  },
}));
```

## File: src/types/workorder.ts
```typescript
export type OTPriority = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';
export type OTEstado = 'Nuevo' | 'Asignado' | 'En Proceso' | 'Esperando Pieza' | 'Completado';

export const OT_STATUS_FLOW: OTEstado[] = ['Nuevo', 'Asignado', 'En Proceso', 'Esperando Pieza', 'Completado'];

export type OTStatusField = 'estado' | 'mecanico_asignado' | 'progreso' | 'observaciones' | 'costo_estimado' | 'prioridad';

export interface StatusLogEntry {
  timestamp: string;
  ot_id: string;
  field: OTStatusField;
  old_value: string;
  new_value: string;
  changed_by: string;
  role: string;
}

export function getNextStatuses(current: OTEstado): OTEstado[] {
  const idx = OT_STATUS_FLOW.indexOf(current);
  if (idx < 0) return OT_STATUS_FLOW;
  return OT_STATUS_FLOW.slice(idx);
}

export interface WorkOrder {
  ot_id: string;
  fecha: string;
  unidad: string;
  tipo_averia: string;
  descripcion: string;
  severidad: string;
  prioridad: OTPriority;
  mecanico_asignado: string;
  estado: OTEstado;
  foto_url: string;
  averia_ref: string;
  partes_necesarias: string;
  costo_estimado: number;
  fecha_cierre: string;
  observaciones: string;
  progreso: number;
}

export const PRIORITY_CONFIG: Record<OTPriority, { color: string; bg: string; label: string; time: string }> = {
  CRITICA: { color: '#DC2626', bg: '#FEE2E2', label: 'CRÍTICA', time: '< 4 horas' },
  ALTA: { color: '#EA580C', bg: '#FFEDD5', label: 'ALTA', time: '< 8 horas' },
  MEDIA: { color: '#F59E0B', bg: '#FEF3C7', label: 'MEDIA', time: '< 24 horas' },
  BAJA: { color: '#3B82F6', bg: '#DBEAFE', label: 'BAJA', time: '< 1 semana' },
};

export const ESTADO_CONFIG: Record<OTEstado, { color: string; bg: string }> = {
  'Nuevo': { color: '#3B82F6', bg: '#DBEAFE' },
  'Asignado': { color: '#8B5CF6', bg: '#EDE9FE' },
  'En Proceso': { color: '#2563EB', bg: '#FEF3C7' },
  'Esperando Pieza': { color: '#EA580C', bg: '#FFEDD5' },
  'Completado': { color: '#16A34A', bg: '#DCFCE7' },
};
```

## File: src/components/mechanic/DiagramViewer.tsx
```typescript
import { useState, useEffect } from 'react';
import { Search, FileText, ExternalLink } from 'lucide-react';

const HERMES_API = '/hermes-api';

interface DiagramEntry {
  filename: string;
  name: string;
  url: string;
}

const EQUIPMENT_FILTERS = ['Todos', 'Komatsu', 'CAT', 'Doosan', 'Mack'];

const BRAND_MAP: Record<string, string[]> = {
  'Komatsu': ['D155', 'HM400', 'PC', 'WA', 'HD'],
  'CAT': ['CAT', '740B', '336', '320', '980', '966', '140M', 'D8', 'D9', '3412'],
  'Doosan': ['DX', 'DL'],
  'Mack': ['MACK', 'Pinnacle', 'Granite', 'Anthem'],
};

function matchesBrand(diagramName: string, brand: string): boolean {
  const prefixes = BRAND_MAP[brand];
  if (!prefixes) return false;
  const name = diagramName.toUpperCase();
  return prefixes.some(p => name.includes(p.toUpperCase()));
}

export default function DiagramViewer() {
  const [query, setQuery] = useState('');
  const [selectedEquipo, setSelectedEquipo] = useState('Todos');
  const [diagrams, setDiagrams] = useState<DiagramEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDiagrams() {
      try {
        const res = await fetch(`${HERMES_API}/diagrams/list`);
        if (res.ok) {
          const data = await res.json();
          setDiagrams(data);
        }
      } catch {
        // Fallback mock data if VPS unreachable
        setDiagrams([
          { filename: 'D155AX6_Diagramas.pdf', name: 'D155AX6', url: '/diagrams/file/D155AX6_Diagramas.pdf' },
          { filename: 'HM400-3_Diagramas.pdf', name: 'HM400-3', url: '/diagrams/file/HM400-3_Diagramas.pdf' },
          { filename: 'DX340LC_Diagramas.pdf', name: 'DX340LC', url: '/diagrams/file/DX340LC_Diagramas.pdf' },
          { filename: 'DX225LCA_Diagramas.pdf', name: 'DX225LCA', url: '/diagrams/file/DX225LCA_Diagramas.pdf' },
          { filename: 'DL420A_Diagramas.pdf', name: 'DL420A', url: '/diagrams/file/DL420A_Diagramas.pdf' },
          { filename: 'MACK_GR84B_Diagramas.pdf', name: 'MACK GR84B', url: '/diagrams/file/MACK_GR84B_Diagramas.pdf' },
        ]);
      }
      setLoading(false);
    }
    loadDiagrams();
  }, []);

  const filtered = diagrams.filter((d) => {
    const matchesQuery = !query.trim() || d.name.toLowerCase().includes(query.toLowerCase());
    const matchesEquipo =
      selectedEquipo === 'Todos' || matchesBrand(d.name, selectedEquipo);
    return matchesQuery && matchesEquipo;
  });

  function openPDF(diagram: DiagramEntry) {
    const pdfUrl = `${HERMES_API}${diagram.url}`;
    window.open(pdfUrl, '_blank');
  }

  return (
    <div className="flex flex-col py-4">
      <div className="relative mb-3">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar diagrama por equipo..."
          className="w-full bg-white rounded-xl border-2 border-border focus:border-amber outline-none pl-11 pr-4 py-4 text-sm text-text placeholder:text-text-secondary"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {EQUIPMENT_FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedEquipo(filter)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              selectedEquipo === filter
                ? 'bg-amber text-white border-amber'
                : 'bg-white text-text-secondary border-border hover:border-amber'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-center text-text-secondary text-sm py-8">Cargando diagramas...</p>
      )}

      {filtered.map((diagram) => (
        <div
          key={diagram.filename}
          className="bg-card rounded-xl shadow-sm border border-border p-4 mb-3 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
              <FileText size={20} style={{ color: '#2563EB' }} />
            </div>
            <div>
              <p className="font-semibold text-text text-sm">{diagram.name} — Diagramas</p>
              <p className="text-xs text-text-secondary mt-0.5">PDF técnico</p>
            </div>
          </div>
          <button
            onClick={() => openPDF(diagram)}
            className="flex-shrink-0 bg-amber text-white rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap hover:opacity-90 transition-opacity flex items-center gap-1"
          >
            <ExternalLink size={14} />
            Abrir PDF
          </button>
        </div>
      ))}

      {!loading && filtered.length === 0 && (
        <p className="text-center text-text-secondary text-sm py-8">
          No se encontraron diagramas
        </p>
      )}
    </div>
  );
}
```

## File: src/lib/hermes-api.ts
```typescript
// Always proxy through /hermes-api — Vite dev server and Vercel both rewrite to VPS
const HERMES_BASE = '/hermes-api';

async function hermesPost<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${HERMES_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Hermes API error ${response.status}: ${text}`);
  }
  return response.json();
}

async function hermesGet<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const response = await fetch(`${HERMES_BASE}${endpoint}${qs}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Hermes API error ${response.status}: ${text}`);
  }
  return response.json();
}

export interface DiagnoseParams {
  equipo: string;
  sintoma: string;
  foto_base64?: string;
  codigo_falla?: string;
  horometro?: number;
}

export interface DiagnoseResult {
  causas_probables: string[];
  checklist_diagnostico: string[];
  partes_probables: string[];
  prioridad: string;
}

export async function diagnose(params: DiagnoseParams): Promise<DiagnoseResult> {
  return hermesPost('/ai/diagnose', params as unknown as Record<string, unknown>);
}

export interface PhotoAnalysisParams {
  foto_base64: string;
  equipo?: string;
  contexto?: string;
}

export interface PhotoAnalysisResult {
  componente_probable: string;
  tipo_de_dano: string;
  severidad: string;
  recomendacion_inicial: string;
}

export async function photoToFailure(params: PhotoAnalysisParams): Promise<PhotoAnalysisResult> {
  return hermesPost('/ai/photo_to_failure', params as unknown as Record<string, unknown>);
}

export interface ManualLookupParams {
  equipo: string;
  tema: string;
  seccion?: string;
}

export interface ManualLookupResult {
  extracto: string;
  pasos_tecnicos: string[];
  herramientas_requeridas: string[];
  torque_specs?: string;
}

export async function manualLookup(params: ManualLookupParams): Promise<ManualLookupResult> {
  return hermesPost('/ai/manual_lookup', params as unknown as Record<string, unknown>);
}

export interface PartResult {
  part_number: string;
  description: string;
  oem_ref: string;
  compatible_units: string[];
  stock_quantity: number;
  stock_minimum: number;
  location: string;
  unit_price: number;
  alternatives: string[];
}

export async function searchParts(query: string, equipo?: string): Promise<PartResult[]> {
  const params: Record<string, string> = { q: query };
  if (equipo) params.equipo = equipo;
  return hermesGet('/parts', params);
}

export interface DiagramResult {
  found: boolean;
  pdf?: string;
  page?: number;
  section?: string;
  image_url?: string;
  message?: string;
}

export async function findDiagram(equipo: string, search: string): Promise<DiagramResult> {
  return hermesGet('/diagrams/find', { equipo, search });
}
```

## File: src/pages/DieselPage.tsx
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { isAnomalous } from '../data/fuel-benchmarks';
import { mexicoDate, mexicoTime } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { useAuthStore } from '../stores/auth-store';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

type FuelType = 'ULSD' | 'Diesel' | 'Gasolina';

const FUEL_TYPES: FuelType[] = ['ULSD', 'Diesel', 'Gasolina'];

export default function DieselPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const [unidad, setUnidad] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('ULSD');
  const [litros, setLitros] = useState('');
  const [costo, setCosto] = useState('');
  const [horometro, setHorometro] = useState('');
  const [kmActual, setKmActual] = useState('');
  const [estacion, setEstacion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [anomalyWarning, setAnomalyWarning] = useState(false);

  const selectedEquipment = EQUIPMENT_CATALOG.find((eq) => eq.unit_id === unidad);
  const isTruck = selectedEquipment?.type === 'Camión Pesado';

  const canSubmit = unidad !== '' && litros !== '' && horometro !== '';

  function handleSubmitIntent() {
    if (!canSubmit) return;

    if (selectedEquipment && litros) {
      const consumption = parseFloat(litros);
      const anomalous = isAnomalous(selectedEquipment.model, consumption);
      setAnomalyWarning(anomalous);
    }

    setShowConfirm(true);
  }

  async function handleConfirm() {
    setShowConfirm(false);

    const litrosNum = parseFloat(litros) || 0;
    const costoNum = parseFloat(costo) || 0;
    const horometroNum = parseFloat(horometro) || 0;
    const kmNum = parseFloat(kmActual) || 0;
    // Rendimiento requires horómetro delta which is calculated in the sheet
    const rendimiento = '';

    try {
      await appendRow(SHEET_TABS.COMBUSTIBLE, [
        String(Date.now()),
        mexicoDate(),
        mexicoTime(),
        unidad,
        userName,
        fuelType,
        String(litrosNum),
        String(costoNum),
        String(horometroNum),
        String(kmNum),
        String(rendimiento),
        estacion,
        observaciones,
      ]);
    } catch (err) {
      console.error('Sheets append failed (Combustible):', err);
    }

    setToastMessage('Combustible registrado ✓');
    setToastVisible(true);
  }

  function handleToastDismiss() {
    setToastVisible(false);
    navigate(-1);
  }

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <SuccessToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={handleToastDismiss}
      />

      <ConfirmModal
        open={showConfirm}
        title="Confirmar registro de combustible"
        message={`¿Registrar ${litros}L de ${fuelType} para ${unidad || 'la unidad'}?`}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Registro Diesel</h1>
      </div>

      {/* Anomaly warning */}
      {anomalyWarning && (
        <div className="bg-amber-50 border border-amber rounded-xl p-3 flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-amber shrink-0" />
          <span className="text-sm font-medium text-amber">
            Consumo anómalo detectado — más del 30% sobre el benchmark
          </span>
        </div>
      )}

      {/* Form card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-4">
        {/* Unidad */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Unidad</label>
          <select
            value={unidad}
            onChange={(e) => { setUnidad(e.target.value); setAnomalyWarning(false); }}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar unidad...</option>
            {EQUIPMENT_CATALOG.map((eq) => (
              <option key={eq.unit_id} value={eq.unit_id}>
                {eq.unit_id} — {eq.model}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo combustible */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Tipo Combustible</label>
          <div className="flex gap-2">
            {FUEL_TYPES.map((ft) => (
              <button
                key={ft}
                type="button"
                onClick={() => setFuelType(ft)}
                className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                  fuelType === ft
                    ? 'bg-amber text-white'
                    : 'bg-gray-100 text-text-secondary'
                }`}
              >
                {ft}
              </button>
            ))}
          </div>
        </div>

        {/* Litros */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Litros</label>
          <input
            type="number"
            value={litros}
            onChange={(e) => setLitros(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-border p-4 text-3xl font-semibold text-text bg-white text-center"
          />
        </div>

        {/* Costo */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Costo $ (opcional)</label>
          <input
            type="number"
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* Horómetro actual */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Horómetro actual</label>
          <input
            type="number"
            value={horometro}
            onChange={(e) => setHorometro(e.target.value)}
            placeholder="Ej: 8450"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* KM actual — trucks only */}
        {isTruck && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">KM actual</label>
            <input
              type="number"
              value={kmActual}
              onChange={(e) => setKmActual(e.target.value)}
              placeholder="Ej: 125400"
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
        )}

        {/* Estación */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Estación</label>
          <input
            type="text"
            value={estacion}
            onChange={(e) => setEstacion(e.target.value)}
            placeholder="PEMEX Km 12"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* Observaciones */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones adicionales..."
            rows={3}
            className="w-full rounded-xl border border-border p-3 text-sm text-text resize-none bg-white"
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmitIntent}
        disabled={!canSubmit}
        className="mt-4 w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
        style={{ minHeight: 52 }}
      >
        Registrar Combustible
      </button>
    </div>
  );
}
```

## File: src/pages/DVIRPage.tsx
```typescript
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { DVIRCheck, CheckStatus } from '../types/dvir';
import { DVIR_SYSTEMS } from '../data/dvir-systems';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { generateOTId } from '../lib/ot-generator';
import { mexicoDate, mexicoTime, mexicoDateCompact, mexicoTimeCompact } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { tryUploadPhotos } from '../lib/photo-upload-safe';
import { useAuthStore } from '../stores/auth-store';
import SystemCheckRow from '../components/dvir/SystemCheckRow';
import DVIRResultBanner from '../components/dvir/DVIRResultBanner';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

interface PhotoItem {
  file: File;
  preview: string;
}

interface CheckState extends DVIRCheck {
  photos: PhotoItem[];
}

function buildInitialChecks(): CheckState[] {
  return DVIR_SYSTEMS.map((sys) => ({
    system_id: sys.id,
    status: null,
    notes: '',
    photos: [],
  }));
}

export default function DVIRPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const [unit_id, setUnitId] = useState('');
  const [type, setType] = useState<'pre-operacion' | 'post-operacion'>('pre-operacion');
  const [horometro, setHorometro] = useState('');
  const [checks, setChecks] = useState<CheckState[]>(buildInitialChecks);
  const [observations, setObservations] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const allChecked = checks.every((c) => c.status !== null);
  const canSubmit = allChecked && unit_id !== '';

  function updateCheck(index: number, status: CheckStatus) {
    setChecks((prev) =>
      prev.map((c, i) => (i === index ? { ...c, status } : c))
    );
  }

  function updateNotes(index: number, notes: string) {
    setChecks((prev) =>
      prev.map((c, i) => (i === index ? { ...c, notes } : c))
    );
  }

  const handlePhotoCapture = useCallback((index: number, file: File) => {
    const preview = URL.createObjectURL(file);
    setChecks((prev) =>
      prev.map((c, i) =>
        i === index ? { ...c, photos: [{ file, preview }] } : c
      )
    );
  }, []);

  const handlePhotoRemove = useCallback((checkIndex: number, photoIndex: number) => {
    setChecks((prev) =>
      prev.map((c, i) => {
        if (i !== checkIndex) return c;
        const updated = [...c.photos];
        const removed = updated.splice(photoIndex, 1);
        if (removed[0]) URL.revokeObjectURL(removed[0].preview);
        return { ...c, photos: updated };
      })
    );
  }, []);

  function handleSubmitIntent() {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  async function handleConfirm() {
    setShowConfirm(false);

    const fallaCount = checks.filter((c) => c.status === 'falla').length;
    const alertaCount = checks.filter((c) => c.status === 'alerta').length;
    const okCount = checks.filter((c) => c.status === 'ok').length;

    let result: string;
    if (fallaCount > 0) result = 'reprobado';
    else if (alertaCount > 0) result = 'condicional';
    else result = 'aprobado';

    let otId: string | null = null;
    if (fallaCount > 0) {
      otId = generateOTId();
    }

    const now = new Date();
    const date = mexicoDate(now);
    const time = mexicoTime(now);
    const inspId = `INS-${mexicoDateCompact(now)}-${mexicoTimeCompact(now)}`;
    const selectedEquipment = EQUIPMENT_CATALOG.find((eq) => eq.unit_id === unit_id);
    const modelo = selectedEquipment?.model ?? '';

    const allPhotos = checks.flatMap((c) => c.photos.map((p) => p.file));
    const photoUrls = await tryUploadPhotos(allPhotos, 'dvir-photos');
    const photoUrlStr = photoUrls.join(', ');

    try {
      await appendRow(SHEET_TABS.INSPECCIONES, [
        '',                                    // # (auto-number)
        inspId,                                // INSP_ID
        date,                                  // FECHA
        time,                                  // HORA
        unit_id,                               // CÓDIGO UNIDAD
        modelo,                                // MODELO
        userName,                              // OPERADOR
        type,                                  // TIPO
        String(horometro),                     // HORÓMETRO
        ...checks.map((c) => c.status || 'N/A'), // MOTOR through TREN RODAJE (12 cols)
        `${okCount}/12`,                       // SCORE TOTAL
        result,                                // RESULTADO
        observations,                          // DEFECTOS ENCONTRADOS
        photoUrlStr,                           // FOTO_URL
        otId || '',                            // ACCIÓN REQUERIDA
        otId ? 'Pendiente' : '',               // ESTADO ACCIÓN
        userName,                              // FIRMA_OPERADOR
      ]);
    } catch (err) {
      console.error('Sheets append failed (DVIR):', err);
    }

    if (otId) {
      setToastMessage(`Inspección registrada — OT ${otId} generada`);
    } else {
      setToastMessage(`Inspección registrada — Score: ${okCount}/12`);
    }

    setToastVisible(true);
  }

  function handleToastDismiss() {
    setToastVisible(false);
    navigate(-1);
  }

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <SuccessToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={handleToastDismiss}
      />

      <ConfirmModal
        open={showConfirm}
        title="Confirmar inspección"
        message={`¿Confirmar inspección de ${unit_id || 'la unidad'}?`}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Inspección DVIR</h1>
      </div>

      {/* Unit & type card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Unidad</label>
          <select
            value={unit_id}
            onChange={(e) => setUnitId(e.target.value)}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar unidad...</option>
            {EQUIPMENT_CATALOG.map((eq) => (
              <option key={eq.unit_id} value={eq.unit_id}>
                {eq.unit_id} — {eq.model}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Tipo</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType('pre-operacion')}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                type === 'pre-operacion'
                  ? 'bg-amber text-white'
                  : 'bg-gray-100 text-text-secondary'
              }`}
            >
              Pre-Operación
            </button>
            <button
              type="button"
              onClick={() => setType('post-operacion')}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                type === 'post-operacion'
                  ? 'bg-amber text-white'
                  : 'bg-gray-100 text-text-secondary'
              }`}
            >
              Post-Operación
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Horómetro actual</label>
          <input
            type="number"
            value={horometro}
            onChange={(e) => setHorometro(e.target.value)}
            placeholder="Ej: 3240"
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          />
        </div>
      </div>

      {/* Systems */}
      <div className="flex flex-col">
        {DVIR_SYSTEMS.map((system, index) => (
          <SystemCheckRow
            key={system.id}
            system={system}
            value={checks[index].status}
            onChange={(status) => updateCheck(index, status)}
            photos={checks[index].photos}
            onPhotoCapture={(file) => handlePhotoCapture(index, file)}
            onPhotoRemove={(photoIndex) => handlePhotoRemove(index, photoIndex)}
            notes={checks[index].notes ?? ''}
            onNotesChange={(notes) => updateNotes(index, notes)}
          />
        ))}
      </div>

      {/* Observations */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border mt-2">
        <label className="text-sm font-medium text-text-secondary block mb-2">
          Observaciones generales
        </label>
        <textarea
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          placeholder="Observaciones adicionales..."
          rows={3}
          className="w-full rounded-xl border border-border p-3 text-sm text-text resize-none bg-white"
        />
      </div>

      {/* Result banner */}
      <DVIRResultBanner checks={checks} />

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmitIntent}
        disabled={!canSubmit}
        className="mt-4 w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
        style={{ minHeight: 52 }}
      >
        Enviar Inspección
      </button>
    </div>
  );
}
```

## File: src/pages/FallaPage.tsx
```typescript
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { generateOTId } from '../lib/ot-generator';
import { calculatePriority } from '../lib/priority-calculator';
import { mexicoDate, mexicoTime } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { tryUploadPhotos } from '../lib/photo-upload-safe';
import { useAuthStore } from '../stores/auth-store';
import AutoPriorityIndicator from '../components/falla/AutoPriorityIndicator';
import PhotoCapture from '../components/ui/PhotoCapture';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

const TIPO_FALLA_OPTIONS = [
  'Mecánica',
  'Hidráulica',
  'Eléctrica',
  'Motor',
  'Transmisión',
  'Neumáticos',
  'Estructura',
  'Otra',
];

const DOWNTIME_OPTIONS = ['<1 hora', '1-4 horas', '4-8 horas', '>8 horas'];

interface PhotoItem {
  file: File;
  preview: string;
}

export default function FallaPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const [unidad, setUnidad] = useState('');
  const [tipoFalla, setTipoFalla] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [puedeMoverse, setPuedeMoverse] = useState<boolean | null>(null);
  const [clienteAfectado, setClienteAfectado] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [downtime, setDowntime] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const mobilitySelected = puedeMoverse !== null;

  const priority = mobilitySelected
    ? calculatePriority({
        puede_moverse: puedeMoverse!,
        cliente_afectado: clienteAfectado,
        tipo_falla: tipoFalla,
      })
    : null;

  const canSubmit =
    unidad !== '' && tipoFalla !== '' && descripcion.trim() !== '' && puedeMoverse !== null;

  const handlePhotoCapture = useCallback((file: File) => {
    const preview = URL.createObjectURL(file);
    setPhotos((prev) => [...prev, { file, preview }]);
  }, []);

  const handlePhotoRemove = useCallback((index: number) => {
    setPhotos((prev) => {
      const updated = [...prev];
      const removed = updated.splice(index, 1);
      if (removed[0]) URL.revokeObjectURL(removed[0].preview);
      return updated;
    });
  }, []);

  function handleSubmitIntent() {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  async function handleConfirm() {
    setShowConfirm(false);
    const otId = generateOTId();
    const priorityValue = priority ?? 'media';

    const photoUrls = await tryUploadPhotos(photos.map((p) => p.file), 'falla-photos');
    const photoUrlStr = photoUrls.join(', ');

    try {
      await appendRow(SHEET_TABS.AVERIAS, [
        mexicoDate(),                                                                          // FECHA
        mexicoTime(),                                                                          // HORA
        unidad,                                                                                                   // UNIDAD
        tipoFalla,                                                                                                // TIPO AVERÍA
        descripcion,                                                                                              // DESCRIPCIÓN
        priorityValue,                                                                                            // SEVERIDAD
        userName,                                                                                                 // TÉCNICO
        downtime,                                                                                                 // TIEMPO PARO (hrs)
        '',                                                                                                       // COSTO ESTIMADO
        'Nuevo',                                                                                                  // ESTADO
        '',                                                                                                       // SOLUCIÓN
        `Ubicación: ${ubicacion}. Cliente: ${clienteAfectado}. Puede moverse: ${puedeMoverse ? 'Sí' : 'No'}`,   // OBSERVACIONES
        '',                                                                                                       // PROVEEDOR PIEZA
        photoUrlStr,                                                                                              // Foto_URL
      ]);
    } catch (err) {
      console.error('Sheets append failed (Averias):', err);
    }

    try {
      await appendRow(SHEET_TABS.ORDENES_TRABAJO, [
        String(Date.now()),
        otId,
        mexicoDate(),
        unidad,
        tipoFalla,
        descripcion,
        priorityValue,
        priorityValue,
        '',
        'Nuevo',
        '',
        '',
        '',
        '',
        '',
        photoUrlStr,  // FOTO_URL
      ]);
    } catch (err) {
      console.error('Sheets append failed (OT):', err);
    }

    setToastMessage(`${otId} creada — Jefe de Taller notificado`);
    setToastVisible(true);
  }

  function handleToastDismiss() {
    setToastVisible(false);
    navigate(-1);
  }

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <SuccessToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={handleToastDismiss}
      />

      <ConfirmModal
        open={showConfirm}
        title="Confirmar reporte de falla"
        message={`¿Enviar reporte de falla para ${unidad || 'la unidad'}?`}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Reportar Falla</h1>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-4">
        {/* Unidad */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Unidad</label>
          <select
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar unidad...</option>
            {EQUIPMENT_CATALOG.map((eq) => (
              <option key={eq.unit_id} value={eq.unit_id}>
                {eq.unit_id} — {eq.model}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo de falla */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Tipo de Falla</label>
          <select
            value={tipoFalla}
            onChange={(e) => setTipoFalla(e.target.value)}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar tipo...</option>
            {TIPO_FALLA_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Descripción */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Descripción</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Describe los síntomas observados..."
            rows={4}
            className="w-full rounded-xl border border-border p-3 text-sm text-text resize-none bg-white"
          />
        </div>

        {/* Puede moverse */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-secondary">¿Puede moverse?</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPuedeMoverse(true)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                puedeMoverse === true
                  ? 'bg-amber text-white'
                  : 'bg-gray-100 text-text-secondary'
              }`}
            >
              Sí
            </button>
            <button
              type="button"
              onClick={() => setPuedeMoverse(false)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                puedeMoverse === false
                  ? 'bg-amber text-white'
                  : 'bg-gray-100 text-text-secondary'
              }`}
            >
              No
            </button>
          </div>

          {priority !== null && (
            <AutoPriorityIndicator priority={priority} />
          )}
        </div>

        {/* Cliente afectado */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Cliente afectado</label>
          <input
            type="text"
            value={clienteAfectado}
            onChange={(e) => setClienteAfectado(e.target.value)}
            placeholder="Nombre del cliente afectado"
            className="w-full rounded-xl border border-border p-3 text-sm text-text bg-white"
          />
        </div>

        {/* Ubicación */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Ubicación</label>
          <input
            type="text"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            placeholder="Frente 3, km 4.5"
            className="w-full rounded-xl border border-border p-3 text-sm text-text bg-white"
          />
        </div>

        {/* Downtime estimado */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Downtime estimado</label>
          <select
            value={downtime}
            onChange={(e) => setDowntime(e.target.value)}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar...</option>
            {DOWNTIME_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Fotos */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Fotos</label>
          <PhotoCapture
            photos={photos}
            onCapture={handlePhotoCapture}
            onRemove={handlePhotoRemove}
            multiple={true}
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmitIntent}
        disabled={!canSubmit}
        className="mt-4 w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
        style={{ minHeight: 52 }}
      >
        Enviar Reporte
      </button>
    </div>
  );
}
```

## File: src/pages/HorometroPage.tsx
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { getNextPM } from '../data/pm-rules';
import { mexicoDate, mexicoTime } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { useAuthStore } from '../stores/auth-store';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

type TurnoType = 'inicio' | 'final';

export default function HorometroPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const [turno, setTurno] = useState<TurnoType>('inicio');
  const [unidad, setUnidad] = useState('');
  const [horometro, setHorometro] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const selectedEquipment = EQUIPMENT_CATALOG.find((eq) => eq.unit_id === unidad);
  const horasActual = horometro ? parseFloat(horometro) : null;

  const pmInfo =
    selectedEquipment && horasActual !== null
      ? getNextPM(selectedEquipment.model, horasActual)
      : null;

  const prevPMLevel = pmInfo
    ? `PM-${Math.max(1, parseInt(pmInfo.level.replace('PM-', ''), 10) - 1)}`
    : null;

  const prevPMHours = pmInfo && horasActual !== null ? horasActual - pmInfo.hours_remaining : null;

  function getPMColor(hoursRemaining: number): string {
    if (hoursRemaining <= 0) return 'text-critical';
    if (hoursRemaining <= 50) return 'text-amber';
    return 'text-success';
  }

  function getPMBgColor(hoursRemaining: number): string {
    if (hoursRemaining <= 0) return 'bg-red-50 border-critical';
    if (hoursRemaining <= 50) return 'bg-amber-50 border-amber';
    return 'bg-green-50 border-success';
  }

  const canSubmit = unidad !== '' && horometro !== '';

  function handleSubmitIntent() {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  async function handleConfirm() {
    setShowConfirm(false);

    try {
      await appendRow(SHEET_TABS.HOROMETROS, [
        mexicoDate(),          // FECHA
        mexicoTime(),          // HORA
        unidad,                                   // UNIDAD
        selectedEquipment?.model || '',           // MODELO
        userName,                                 // OPERADOR
        turno,                                    // TURNO (inicio/final)
        String(horometro),                        // HORÓMETRO
        pmInfo ? pmInfo.level : '',               // PRÓXIMO PM
        pmInfo ? String(pmInfo.hours_remaining) : '', // FALTAN
      ]);
    } catch (err) {
      console.error('Sheets append failed (Horometros):', err);
    }

    const label = turno === 'inicio' ? 'Inicio' : 'Final';
    setToastMessage(`Horómetro ${label} de Turno registrado ✓`);
    setToastVisible(true);
  }

  function handleToastDismiss() {
    setToastVisible(false);
    navigate(-1);
  }

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <SuccessToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={handleToastDismiss}
      />

      <ConfirmModal
        open={showConfirm}
        title="Confirmar horómetro"
        message={`¿Registrar horómetro ${turno === 'inicio' ? 'inicio' : 'final'} de turno para ${unidad || 'la unidad'}?`}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Registro Horómetro</h1>
      </div>

      {/* Turno toggle */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-border mb-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTurno('inicio')}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-colors ${
              turno === 'inicio'
                ? 'bg-amber text-white'
                : 'bg-gray-100 text-text-secondary'
            }`}
          >
            Inicio de Turno
          </button>
          <button
            type="button"
            onClick={() => setTurno('final')}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-colors ${
              turno === 'final'
                ? 'bg-amber text-white'
                : 'bg-gray-100 text-text-secondary'
            }`}
          >
            Final de Turno
          </button>
        </div>
      </div>

      {/* Unit selector */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
        <label className="text-sm font-medium text-text-secondary block mb-2">Unidad</label>
        <select
          value={unidad}
          onChange={(e) => setUnidad(e.target.value)}
          className="w-full rounded-xl border border-border p-4 bg-white text-text text-lg font-semibold"
        >
          <option value="">Seleccionar unidad...</option>
          {EQUIPMENT_CATALOG.map((eq) => (
            <option key={eq.unit_id} value={eq.unit_id}>
              {eq.unit_id} — {eq.model}
            </option>
          ))}
        </select>
      </div>

      {/* Horómetro large input */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
        <label className="text-sm font-medium text-text-secondary block mb-2">Horómetro</label>
        <input
          type="number"
          value={horometro}
          onChange={(e) => setHorometro(e.target.value)}
          placeholder="12,500"
          className="w-full rounded-xl border border-border p-4 text-4xl font-mono font-semibold text-text bg-white text-center tracking-wider"
        />
        <p className="text-xs text-text-secondary text-center mt-2">horas</p>
      </div>

      {/* PM proximity card */}
      {pmInfo && horasActual !== null && (
        <div className={`rounded-xl p-4 border mb-4 ${getPMBgColor(pmInfo.hours_remaining)}`}>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={18} className={getPMColor(pmInfo.hours_remaining)} />
            <span className="font-semibold text-text">Proximidad de PM</span>
          </div>

          {prevPMLevel && prevPMHours !== null && (
            <p className="text-sm text-text-secondary mb-1">
              Último PM: {prevPMLevel} completado
            </p>
          )}

          <p className={`text-sm font-medium ${getPMColor(pmInfo.hours_remaining)}`}>
            Próximo PM: {pmInfo.level} a {pmInfo.due_at.toLocaleString()} hrs
          </p>

          <p className={`text-base font-bold mt-1 ${getPMColor(pmInfo.hours_remaining)}`}>
            {pmInfo.hours_remaining <= 0
              ? `VENCIDO ${Math.abs(pmInfo.hours_remaining)} hrs`
              : `Faltan ${pmInfo.hours_remaining} hrs`}
          </p>
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmitIntent}
        disabled={!canSubmit}
        className="mt-2 w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
        style={{ minHeight: 52 }}
      >
        Registrar Horómetro
      </button>
    </div>
  );
}
```

## File: src/pages/LoginPage.tsx
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Wrench,
  Eye,
  Settings,
  BarChart3,
  ArrowLeft,
  Delete,
} from 'lucide-react';
import type { AppRole } from '../types/roles';
import { ROLE_HOME, ROLE_LABELS } from '../types/roles';
import { useAuthStore } from '../stores/auth-store';

interface RoleCard {
  role: AppRole;
  label: string;
  icon: React.ReactNode;
}

const ROLE_CARDS: RoleCard[] = [
  { role: 'operador', label: 'Operador', icon: <Truck size={28} className="text-white/80" /> },
  { role: 'mecanico', label: 'Mecánico', icon: <Wrench size={28} className="text-white/80" /> },
  { role: 'supervisor', label: 'Supervisor', icon: <Eye size={28} className="text-white/80" /> },
  { role: 'coordinador', label: 'Coordinador Mtto.', icon: <Settings size={28} className="text-white/80" /> },
  { role: 'jefe_taller', label: 'Jefe de Taller', icon: <Wrench size={28} className="text-white/80" /> },
  { role: 'gerencia', label: 'Gerencia', icon: <BarChart3 size={28} className="text-white/80" /> },
];

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const handleRoleSelect = (role: AppRole) => {
    setSelectedRole(role);
    setPin('');
  };

  const handleBack = () => {
    setSelectedRole(null);
    setPin('');
  };

  const handleKeyPress = (key: string) => {
    if (key === 'del') {
      setPin((prev) => prev.slice(0, -1));
      return;
    }
    if (key === '') return;
    if (pin.length >= 4) return;

    const newPin = pin + key;
    setPin(newPin);

    if (newPin.length === 4 && selectedRole) {
      const success = login(selectedRole, newPin);
      if (success) {
        navigate(ROLE_HOME[selectedRole]);
      } else {
        setPinError(true);
        setTimeout(() => {
          setPin('');
          setPinError(false);
        }, 800);
      }
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between py-10 px-4"
      style={{ background: '#FFFFFF' }}
    >
      {selectedRole === null ? (
        /* Phase 1 - Role Selection */
        <div className="flex flex-col items-center w-full max-w-sm gap-6">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3 mb-2">
            <img
              src="/logo-transplus.svg"
              alt="Trans Plus"
              className="w-24 h-24"
            />
            <span className="font-bold text-2xl tracking-widest" style={{ color: '#162252' }}>HERMES</span>
            <span className="text-sm" style={{ color: '#6B7280' }}>Grupo Trans Plus • Operaciones</span>
          </div>

          <p className="text-base text-center" style={{ color: '#162252' }}>
            Selecciona tu rol para ingresar
          </p>

          {/* Role cards grid */}
          <div className="grid grid-cols-2 gap-3 w-full">
            {ROLE_CARDS.map(({ role, label, icon }) => (
              <button
                key={role}
                onClick={() => handleRoleSelect(role)}
                className="flex flex-col items-center gap-2 rounded-xl py-5 px-3 transition-opacity active:opacity-70"
                style={{ backgroundColor: '#1E3A8A' }}
              >
                {icon}
                <span className="text-white text-sm font-medium text-center leading-tight">
                  {label}
                </span>
              </button>
            ))}
          </div>

          <p className="text-xs mt-4" style={{ color: '#9CA3AF' }}>v1.0.0 MVP • GTP Hermes Fleet</p>
        </div>
      ) : (
        /* Phase 2 - PIN Entry */
        <div className="flex flex-col items-center w-full max-w-xs gap-6">
          {/* Header with back arrow */}
          <div className="flex items-center w-full gap-3">
            <button
              onClick={handleBack}
              className="transition-colors"
              style={{ color: '#162252' }}
            >
              <ArrowLeft size={22} />
            </button>
            <span className="font-semibold text-lg" style={{ color: '#162252' }}>
              {ROLE_LABELS[selectedRole]}
            </span>
          </div>

          {/* PIN dots */}
          <div className={`flex gap-4 my-4 ${pinError ? 'animate-[shake_0.3s_ease]' : ''}`}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full transition-colors duration-150"
                style={{
                  backgroundColor: pinError ? '#DC2626' : i < pin.length ? '#2563EB' : '#D1D5DB',
                }}
              />
            ))}
          </div>
          {pinError && (
            <p className="text-sm font-medium" style={{ color: '#DC2626' }}>PIN incorrecto</p>
          )}

          {/* Numeric keypad */}
          <div className="grid grid-cols-3 gap-3 w-full">
            {PIN_KEYS.map((key, idx) => (
              <button
                key={idx}
                onClick={() => handleKeyPress(key)}
                disabled={key === ''}
                className={[
                  'flex items-center justify-center rounded-xl transition-opacity active:opacity-60',
                  key === '' ? 'invisible' : '',
                ].join(' ')}
                style={{
                  minHeight: 64,
                  backgroundColor: key === '' ? 'transparent' : '#162252',
                }}
              >
                {key === 'del' ? (
                  <Delete size={22} className="text-white" />
                ) : (
                  <span className="text-white text-xl font-semibold">{key}</span>
                )}
              </button>
            ))}
          </div>

          <p className="text-xs mt-4" style={{ color: '#9CA3AF' }}>v1.0.0 MVP • GTP Hermes Fleet</p>
        </div>
      )}
    </div>
  );
}
```

## File: src/pages/OperatorHomePage.tsx
```typescript
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  Camera,
  Fuel,
  Gauge,
  MapPin,
  FileText,
  CheckCircle,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { getEquipmentById } from '../data/equipment-catalog';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { mexicoDate } from '../lib/date-utils';
import EquipmentCard from '../components/ui/EquipmentCard';

interface ActionCard {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const ACTION_CARDS: ActionCard[] = [
  { label: 'DVIR', icon: <ClipboardCheck size={32} className="text-amber" />, path: '/dvir' },
  { label: 'Reportar Falla', icon: <Camera size={32} className="text-amber" />, path: '/falla' },
  { label: 'Diesel', icon: <Fuel size={32} className="text-amber" />, path: '/diesel' },
  { label: 'Horómetro', icon: <Gauge size={32} className="text-amber" />, path: '/horometro' },
  { label: 'Fletes', icon: <MapPin size={32} className="text-amber" />, path: '/flete' },
  { label: 'Mis Reportes', icon: <FileText size={32} className="text-amber" />, path: '/my-reports' },
];

export default function OperatorHomePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const assignedUnits = useAuthStore((s) => s.assignedUnits);

  const [dvirDone, setDvirDone] = useState<boolean | null>(null); // null = loading
  const [reportCount, setReportCount] = useState(0);

  const checkDVIRStatus = useCallback(async () => {
    try {
      const rows = await readRange(SHEET_TABS.INSPECCIONES);
      const today = mexicoDate();
      let todayCount = 0;
      let foundDVIR = false;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowDate = (row[2] ?? '').trim();  // FECHA column (index 2)
        const rowOperator = (row[6] ?? '').trim(); // OPERADOR column (index 6)

        if (rowDate === today && rowOperator === userName) {
          foundDVIR = true;
          todayCount++;
        }
      }

      setDvirDone(foundDVIR);
      setReportCount(todayCount);
    } catch {
      // If fetch fails, hide the banner rather than show false alarm
      setDvirDone(null);
    }
  }, [userName]);

  useEffect(() => {
    checkDVIRStatus();
  }, [checkDVIRStatus]);

  const assignedEquipment = assignedUnits
    .map((id) => getEquipmentById(id))
    .filter((e) => e !== undefined);

  const greeting = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 18 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="flex flex-col py-4 animate-fade-up">
      {/* Greeting */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-text">{greeting}, {userName}</h1>
        <p className="text-text-secondary text-sm mt-0.5">Operador</p>
      </div>

      {/* DVIR status — dynamic from Google Sheets */}
      {dvirDone === false && (
        <div className="bg-red-50 border-l-4 border-critical rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-critical">
            ⚠️ Tu DVIR de hoy no ha sido completado
          </p>
        </div>
      )}
      {dvirDone === true && (
        <div className="bg-green-50 border-l-4 border-success rounded-lg p-3 mb-4 flex items-center gap-2">
          <CheckCircle size={16} className="text-success shrink-0" />
          <p className="text-sm font-medium text-success">
            DVIR completado hoy ✓
          </p>
        </div>
      )}

      {/* Action grid 2x3 */}
      <div className="grid grid-cols-2 gap-3">
        {ACTION_CARDS.map(({ label, icon, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center justify-center gap-2 bg-white rounded-xl p-4 shadow-sm border border-border btn-press"
            style={{ minHeight: 100 }}
          >
            {icon}
            <span className="text-sm font-medium text-center text-text">{label}</span>
          </button>
        ))}
      </div>

      {/* Mi Equipo section */}
      <h2 className="font-semibold text-text mt-6 mb-3">Mi Equipo Asignado</h2>
      <div className="flex flex-col gap-3">
        {assignedEquipment.length > 0 ? (
          assignedEquipment.map((equipment) => (
            <EquipmentCard key={equipment!.unit_id} equipment={equipment!} />
          ))
        ) : (
          <p className="text-sm text-text-secondary">No tienes equipos asignados.</p>
        )}
      </div>

      {/* Footer counter — dynamic */}
      {reportCount > 0 && (
        <p className="text-sm text-success text-center mt-4 font-medium">
          Reportes hoy: {reportCount} ✓
        </p>
      )}
    </div>
  );
}
```

## File: src/pages/PMSchedulePage.tsx
```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wrench, RefreshCw } from 'lucide-react';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { getNextPM } from '../data/pm-rules';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { SkeletonList } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

interface PMEntry {
  unit_id: string;
  model: string;
  type: string;
  currentHours: number;
  pmLevel: string;
  dueAt: number;
  hoursRemaining: number;
  source: 'sheets' | 'catalog'; // where the horómetro came from
}

/**
 * Read the latest horómetro for each unit from Google Sheets.
 * Tab: 04B Registro Horómetros
 * Columns: FECHA, HORA, UNIDAD, MODELO, OPERADOR, TURNO, HORÓMETRO, ...
 */
async function fetchLatestHorometros(): Promise<Record<string, number>> {
  const rows = await readRange(SHEET_TABS.HOROMETROS);
  const latest: Record<string, { hours: number; date: string }> = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const unidad = (row[2] ?? '').trim();   // UNIDAD column
    const fecha = (row[0] ?? '').trim();     // FECHA column
    const horoStr = (row[6] ?? '').trim();   // HORÓMETRO column
    const horo = parseFloat(horoStr);

    if (!unidad || isNaN(horo) || horo <= 0) continue;

    // Keep the most recent reading per unit
    const existing = latest[unidad];
    if (!existing || fecha >= existing.date || horo > existing.hours) {
      latest[unidad] = { hours: horo, date: fecha };
    }
  }

  const result: Record<string, number> = {};
  for (const [unit, data] of Object.entries(latest)) {
    result[unit] = data.hours;
  }
  return result;
}

function getBorderColor(hrs: number): string {
  if (hrs <= 0) return 'border-l-critical';
  if (hrs <= 50) return 'border-l-amber';
  return 'border-l-success';
}

function getStatusPill(hrs: number): { label: string; cls: string } {
  if (hrs <= 0) return { label: 'Vencido', cls: 'bg-red-100 text-critical' };
  return { label: 'Próximo', cls: 'bg-amber-100 text-amber' };
}

function getBarColor(hrs: number): string {
  if (hrs <= 0) return 'bg-critical';
  if (hrs <= 50) return 'bg-amber';
  return 'bg-success';
}

function getCountdownText(hrs: number): string {
  if (hrs <= 0) return `VENCIDO ${Math.abs(hrs)} hrs`;
  return `Faltan ${hrs} hrs`;
}

export default function PMSchedulePage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<PMEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadPMData() {
    setLoading(true);
    setError(null);

    try {
      // Try to get live horómetro data from Google Sheets
      let sheetHorometros: Record<string, number> = {};
      try {
        sheetHorometros = await fetchLatestHorometros();
      } catch {
        // If sheet read fails, we'll use catalog data as fallback
      }

      const pmEntries: PMEntry[] = EQUIPMENT_CATALOG.map((eq) => {
        // Use sheet horómetro if available, otherwise catalog
        const hasSheetData = sheetHorometros[eq.unit_id] !== undefined;
        const currentHours = hasSheetData
          ? sheetHorometros[eq.unit_id]
          : eq.current_horometro;

        const pm = getNextPM(eq.model, currentHours);

        return {
          unit_id: eq.unit_id,
          model: eq.model,
          type: eq.type,
          currentHours,
          pmLevel: pm.level,
          dueAt: pm.due_at,
          hoursRemaining: pm.hours_remaining,
          source: (hasSheetData ? 'sheets' : 'catalog') as 'sheets' | 'catalog',
        };
      })
        // Only show units within less than 50 hours of a PM (or overdue)
        .filter((entry) => entry.hoursRemaining < 50)
        .sort((a, b) => a.hoursRemaining - b.hoursRemaining);

      setEntries(pmEntries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPMData();
  }, []);

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Programa de Mantenimiento</h1>
        <button
          type="button"
          onClick={loadPMData}
          disabled={loading}
          className="ml-auto p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <RefreshCw size={18} className={`text-text-secondary ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-700">
        Mostrando equipos con PM a menos de 50 horas. Datos de horómetro desde Google Sheets.
      </div>

      {loading && <SkeletonList count={4} />}

      {error && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-border text-center">
          <p className="text-red-600 text-sm mb-2">Error al cargar</p>
          <p className="text-xs text-text-secondary mb-3">{error}</p>
          <button
            type="button"
            onClick={loadPMData}
            className="px-4 py-2 bg-amber text-white rounded-xl text-sm font-medium"
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <EmptyState
          type="workorders"
          title="Sin PMs próximos"
          description="Ningún equipo tiene mantenimiento preventivo a menos de 50 horas"
        />
      )}

      {/* PM cards */}
      {!loading && (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => {
            const pill = getStatusPill(entry.hoursRemaining);
            const progressPct = Math.max(
              0,
              Math.min(
                100,
                entry.hoursRemaining <= 0
                  ? 100
                  : Math.round(((entry.dueAt - entry.hoursRemaining) / entry.dueAt) * 100)
              )
            );

            return (
              <div
                key={entry.unit_id}
                className={`bg-white rounded-xl shadow-sm border border-border border-l-4 ${getBorderColor(entry.hoursRemaining)} p-4`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-text">{entry.unit_id}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pill.cls}`}>
                        {pill.label}
                      </span>
                      {entry.source === 'sheets' && (
                        <span className="text-xs text-success font-medium">● Live</span>
                      )}
                    </div>
                    <p className="text-text-secondary text-xs mt-0.5">{entry.model}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 text-text-secondary">
                    <Wrench size={14} />
                    <span className="text-sm font-semibold text-text">{entry.pmLevel}</span>
                  </div>
                </div>

                {/* PM target */}
                <p className="text-sm text-text-secondary mb-1">
                  a {entry.dueAt.toLocaleString()} hrs
                </p>

                {/* Current + countdown */}
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="text-text-secondary font-mono">
                    Actual: {entry.currentHours.toLocaleString()} hrs
                  </span>
                  <span
                    className={`font-bold ${
                      entry.hoursRemaining <= 0
                        ? 'text-critical'
                        : entry.hoursRemaining <= 50
                        ? 'text-amber'
                        : 'text-success'
                    }`}
                  >
                    {getCountdownText(entry.hoursRemaining)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getBarColor(entry.hoursRemaining)} rounded-full transition-all`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

## File: src/pages/WorkOrderDetailPage.tsx
```typescript
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Wrench, ChevronRight } from 'lucide-react';
import { useWorkOrderStore } from '../stores/workorder-store';
import { useAuthStore } from '../stores/auth-store';
import { getEquipmentById } from '../data/equipment-catalog';
import { PRIORITY_CONFIG, ESTADO_CONFIG, OT_STATUS_FLOW, getNextStatuses } from '../types/workorder';
import type { OTEstado, OTStatusField, StatusLogEntry } from '../types/workorder';

const FIELD_LABELS: Record<OTStatusField, string> = {
  estado: 'Estado',
  mecanico_asignado: 'Mecánico',
  progreso: 'Progreso',
  observaciones: 'Observaciones',
  costo_estimado: 'Costo estimado',
  prioridad: 'Prioridad',
};

function canEditField(_role: string | null, _field: OTStatusField): boolean {
  // All roles can edit all fields
  return true;
}

function StatusPillRow({ current }: { current: OTEstado }) {
  const allStatuses: OTEstado[] = ['Nuevo', 'Asignado', 'En Proceso', 'Esperando Pieza', 'Completado'];
  const currentIdx = allStatuses.indexOf(current);

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      {allStatuses.map((s, idx) => {
        const isCurrent = s === current;
        const isPast = idx < currentIdx;
        const config = ESTADO_CONFIG[s];
        return (
          <span
            key={s}
            className="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap shrink-0"
            style={{
              color: isCurrent ? '#fff' : isPast ? config.color : '#9CA3AF',
              backgroundColor: isCurrent ? config.color : isPast ? config.bg : '#F3F4F6',
            }}
          >
            {s}
          </span>
        );
      })}
    </div>
  );
}

function TimelineEntry({ entry }: { entry: StatusLogEntry }) {
  const label = FIELD_LABELS[entry.field] ?? entry.field;
  return (
    <div className="flex gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        <div className="w-2 h-2 rounded-full bg-amber" />
        <div className="flex-1 w-px bg-gray-200 mt-1" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text">
          {label}: <span className="text-text-secondary">{entry.old_value || '(vacío)'}</span>
          {' '}<ChevronRight size={12} className="inline text-text-secondary" />{' '}
          <span className="text-amber font-semibold">{entry.new_value}</span>
        </p>
        <p className="text-xs text-text-secondary mt-0.5">
          {entry.changed_by} &middot; {entry.timestamp}
        </p>
      </div>
    </div>
  );
}

export default function WorkOrderDetailPage() {
  const { otId } = useParams<{ otId: string }>();
  const navigate = useNavigate();
  const { statusLog, loading, fetched, fetchWorkOrders, updateOTField, getWorkOrderById } = useWorkOrderStore();
  const role = useAuthStore((s) => s.role);
  const userName = useAuthStore((s) => s.userName);

  const [editEstado, setEditEstado] = useState('');
  const [editMecanico, setEditMecanico] = useState('');
  const [editCosto, setEditCosto] = useState('');
  const [editNotas, setEditNotas] = useState('');
  const [saving, setSaving] = useState<OTStatusField | null>(null);

  useEffect(() => {
    if (!fetched) {
      fetchWorkOrders();
    }
  }, [fetched, fetchWorkOrders]);

  const wo = otId ? getWorkOrderById(otId) : undefined;
  const equipment = wo ? getEquipmentById(wo.unidad) : undefined;

  // Initialize edit fields when workorder loads
  useEffect(() => {
    if (wo) {
      setEditEstado(wo.estado);
      setEditMecanico(wo.mecanico_asignado);
      setEditCosto(String(wo.costo_estimado || ''));
      setEditNotas(wo.observaciones);
    }
  }, [wo?.ot_id, wo?.estado, wo?.mecanico_asignado, wo?.costo_estimado, wo?.observaciones]);

  const otLog = statusLog
    .filter((e) => e.ot_id === otId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  async function handleSave(field: OTStatusField, value: string) {
    if (!otId || !wo) return;
    setSaving(field);
    await updateOTField(otId, field, value, userName, role ?? '');
    setSaving(null);
  }

  if (loading && !fetched) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber border-t-transparent" />
      </div>
    );
  }

  if (!wo) {
    return (
      <div className="py-4">
        <div className="flex items-center gap-3 mb-4">
          <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white border border-border shadow-sm">
            <ArrowLeft size={20} className="text-text" />
          </button>
          <h1 className="text-xl font-bold text-text">OT no encontrada</h1>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-border text-center">
          <p className="text-text-secondary">No se encontro la orden de trabajo {otId}</p>
        </div>
      </div>
    );
  }

  const prioKey = wo.prioridad?.toUpperCase() as keyof typeof PRIORITY_CONFIG;
  const priorityConfig = PRIORITY_CONFIG[prioKey] ?? { color: '#6B7280', bg: '#F3F4F6', label: wo.prioridad, time: '' };
  const canEdit = true; // All roles can edit
  const nextStatuses = getNextStatuses(OT_STATUS_FLOW.includes(wo.estado as OTEstado) ? wo.estado as OTEstado : 'Nuevo');

  return (
    <div className="flex flex-col gap-4 pb-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white border border-border shadow-sm">
          <ArrowLeft size={20} className="text-text" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-text truncate">{wo.ot_id}</h1>
          <p className="text-xs text-text-secondary">{wo.fecha}</p>
        </div>
        {priorityConfig && (
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
            style={{ color: priorityConfig.color, backgroundColor: priorityConfig.bg }}
          >
            {priorityConfig.label}
          </span>
        )}
      </div>

      {/* Status flow */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-border">
        <StatusPillRow current={wo.estado} />
      </div>

      {/* Info card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-text-secondary">Unidad</p>
            <p className="text-sm font-semibold text-text">{wo.unidad}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Modelo</p>
            <p className="text-sm font-semibold text-text">{equipment?.model ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Tipo</p>
            <p className="text-sm font-semibold text-text">{wo.tipo_averia}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Prioridad</p>
            <p className="text-sm font-semibold" style={{ color: priorityConfig?.color }}>
              {priorityConfig?.label ?? wo.prioridad}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Mecanico</p>
            <div className="flex items-center gap-1">
              <Wrench size={12} className="text-text-secondary" />
              <p className="text-sm font-semibold text-text">
                {wo.mecanico_asignado || 'Sin asignar'}
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Progreso</p>
            <p className="text-sm font-semibold text-text">{wo.progreso}%</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-text-secondary mb-1">Descripcion</p>
          <p className="text-sm text-text">{wo.descripcion}</p>
        </div>

        {wo.partes_necesarias && (
          <div>
            <p className="text-xs text-text-secondary mb-1">Partes necesarias</p>
            <p className="text-sm text-text">{wo.partes_necesarias}</p>
          </div>
        )}

        {wo.costo_estimado > 0 && (
          <div>
            <p className="text-xs text-text-secondary mb-1">Costo estimado</p>
            <p className="text-sm font-semibold text-text">${wo.costo_estimado.toLocaleString()}</p>
          </div>
        )}

        {wo.foto_url && (
          <div>
            <p className="text-xs text-text-secondary mb-1">Fotos</p>
            <div className="flex gap-2 overflow-x-auto">
              {wo.foto_url.split(',').filter(Boolean).map((url, i) => (
                <img
                  key={i}
                  src={url.trim()}
                  alt={`Foto ${i + 1}`}
                  className="w-20 h-20 rounded-lg object-cover border border-border"
                />
              ))}
            </div>
          </div>
        )}

        {wo.observaciones && (
          <div>
            <p className="text-xs text-text-secondary mb-1">Observaciones</p>
            <p className="text-sm text-text">{wo.observaciones}</p>
          </div>
        )}
      </div>

      {/* Edit panel */}
      {canEdit && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-4">
          <h3 className="text-sm font-bold text-text">Actualizar OT</h3>

          {/* Status */}
          {canEditField(role, 'estado') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Estado</label>
              <div className="flex gap-2">
                <select
                  value={editEstado}
                  onChange={(e) => setEditEstado(e.target.value)}
                  className="flex-1 rounded-xl border border-border p-2.5 text-sm bg-white text-text"
                >
                  {nextStatuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={editEstado === wo.estado || saving === 'estado'}
                  onClick={() => handleSave('estado', editEstado)}
                  className="px-4 py-2 bg-amber text-white rounded-xl text-sm font-medium disabled:opacity-40"
                >
                  {saving === 'estado' ? '...' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {/* Mechanic */}
          {canEditField(role, 'mecanico_asignado') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Mecanico asignado</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editMecanico}
                  onChange={(e) => setEditMecanico(e.target.value)}
                  className="flex-1 rounded-xl border border-border p-2.5 text-sm bg-white text-text"
                  placeholder="Nombre del mecanico"
                />
                <button
                  type="button"
                  disabled={editMecanico === wo.mecanico_asignado || saving === 'mecanico_asignado'}
                  onClick={() => handleSave('mecanico_asignado', editMecanico)}
                  className="px-4 py-2 bg-amber text-white rounded-xl text-sm font-medium disabled:opacity-40"
                >
                  {saving === 'mecanico_asignado' ? '...' : 'Reasignar'}
                </button>
              </div>
            </div>
          )}

          {/* Progress */}
          {canEditField(role, 'progreso') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Progreso</label>
              <div className="flex gap-2">
                {[0, 25, 50, 75, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    disabled={saving === 'progreso'}
                    onClick={() => handleSave('progreso', String(val))}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                      wo.progreso === val
                        ? 'bg-amber text-white'
                        : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cost */}
          {canEditField(role, 'costo_estimado') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Costo estimado ($)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={editCosto}
                  onChange={(e) => setEditCosto(e.target.value)}
                  className="flex-1 rounded-xl border border-border p-2.5 text-sm bg-white text-text"
                  placeholder="0"
                />
                <button
                  type="button"
                  disabled={editCosto === String(wo.costo_estimado || '') || saving === 'costo_estimado'}
                  onClick={() => handleSave('costo_estimado', editCosto)}
                  className="px-4 py-2 bg-amber text-white rounded-xl text-sm font-medium disabled:opacity-40"
                >
                  {saving === 'costo_estimado' ? '...' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {/* Notes */}
          {canEditField(role, 'observaciones') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Observaciones</label>
              <textarea
                value={editNotas}
                onChange={(e) => setEditNotas(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border p-2.5 text-sm text-text resize-none bg-white"
                placeholder="Notas adicionales..."
              />
              <button
                type="button"
                disabled={editNotas === wo.observaciones || saving === 'observaciones'}
                onClick={() => handleSave('observaciones', editNotas)}
                className="w-full py-2.5 bg-amber text-white rounded-xl text-sm font-medium disabled:opacity-40"
              >
                {saving === 'observaciones' ? '...' : 'Guardar notas'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      {otLog.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-amber" />
            <h3 className="text-sm font-bold text-text">Historial</h3>
          </div>
          <div className="flex flex-col">
            {otLog.map((entry, i) => (
              <TimelineEntry key={`${entry.timestamp}-${i}`} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

## File: src/pages/PMWorkOrderPage.tsx
```typescript
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wrench, Package, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { getNextPM } from '../data/pm-rules';
import { getCumulativePMParts, getAvailablePMLevels, type PMPart } from '../data/pm-parts-catalog';
import { generateOTId } from '../lib/ot-generator';
import { mexicoDate } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { useAuthStore } from '../stores/auth-store';
import { printPMOrder } from '../lib/print-pm-order';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

const CATEGORY_ICONS: Record<string, string> = {
  Filtro: '🔧',
  Aceite: '🛢️',
  Grasa: '🧴',
  Correa: '⛓️',
  Refrigerante: '❄️',
  Otro: '📦',
};

const CATEGORY_ORDER: string[] = ['Filtro', 'Aceite', 'Grasa', 'Correa', 'Refrigerante', 'Otro'];

function groupByCategory(parts: PMPart[]): Record<string, PMPart[]> {
  const groups: Record<string, PMPart[]> = {};
  for (const part of parts) {
    if (!groups[part.category]) groups[part.category] = [];
    groups[part.category].push(part);
  }
  return groups;
}

export default function PMWorkOrderPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const [unidad, setUnidad] = useState('');
  const [pmLevel, setPmLevel] = useState('');
  const [mecanico, setMecanico] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [printData, setPrintData] = useState<Parameters<typeof printPMOrder>[0] | null>(null);

  const selectedEquipment = EQUIPMENT_CATALOG.find((eq) => eq.unit_id === unidad);
  const model = selectedEquipment?.model ?? '';

  // Get PM proximity info for selected unit
  const pmInfo = useMemo(() => {
    if (!selectedEquipment) return null;
    return getNextPM(selectedEquipment.model, selectedEquipment.current_horometro);
  }, [selectedEquipment]);

  // Available PM levels for selected model
  const availableLevels = useMemo(() => getAvailablePMLevels(model), [model]);

  // Auto-suggest the recommended PM level when unit changes
  const suggestedLevel = pmInfo?.level ?? '';

  // Cumulative parts for selected level
  const partsKit = useMemo(() => {
    if (!model || !pmLevel) return null;
    return getCumulativePMParts(model, pmLevel);
  }, [model, pmLevel]);

  const groupedParts = useMemo(() => {
    if (!partsKit) return {};
    return groupByCategory(partsKit.parts);
  }, [partsKit]);

  const canSubmit = unidad !== '' && pmLevel !== '';

  function handleUnitChange(newUnit: string) {
    setUnidad(newUnit);
    setPmLevel('');
  }

  function handleLevelSelect(level: string) {
    setPmLevel(level);
  }

  function useSuggested() {
    if (suggestedLevel) setPmLevel(suggestedLevel);
  }

  function handleSubmitIntent() {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  async function handleConfirm() {
    setShowConfirm(false);

    const otId = generateOTId();
    const date = mexicoDate();
    const partsListStr = partsKit
      ? partsKit.parts.map((p) => `${p.partNumber} x${p.quantity}`).join(', ')
      : '';
    const levelsStr = partsKit ? partsKit.levelsIncluded.join('+') : pmLevel;

    // Write to Ordenes Mantenimiento tab
    try {
      await appendRow(SHEET_TABS.ORDENES_MANTENIMIENTO, [
        otId,                              // OT_ID
        date,                              // FECHA
        unidad,                            // UNIDAD
        model,                             // MODELO
        pmLevel,                           // NIVEL PM
        levelsStr,                         // NIVELES INCLUIDOS
        String(selectedEquipment?.current_horometro ?? ''), // HORÓMETRO
        `Mantenimiento Preventivo ${pmLevel}. Incluye: ${levelsStr}`, // DESCRIPCIÓN
        String(partsKit?.totalEstimatedHours ?? ''),  // HORAS ESTIMADAS
        mecanico || 'Por asignar',         // MECÁNICO
        userName,                          // AUTORIZADO POR
        'Programada',                      // ESTADO
        partsListStr,                      // PARTES NECESARIAS
        observaciones,                     // OBSERVACIONES
      ]);
    } catch (err) {
      console.error('Sheets append failed (Ordenes Mantenimiento):', err);
    }

    // Write to Historial PM
    try {
      await appendRow(SHEET_TABS.HISTORIAL_PM, [
        date,                                     // FECHA
        otId,                                     // OT_ID
        unidad,                                   // UNIDAD
        model,                                    // MODELO
        pmLevel,                                  // NIVEL PM
        levelsStr,                                // NIVELES INCLUIDOS
        String(selectedEquipment?.current_horometro ?? ''), // HORÓMETRO
        String(partsKit?.totalEstimatedHours ?? ''),        // HORAS ESTIMADAS
        mecanico || 'Por asignar',                // MECÁNICO
        userName,                                 // AUTORIZADO POR
        'Programada',                             // ESTADO
        partsListStr,                             // PARTES
        observaciones,                            // OBSERVACIONES
      ]);
    } catch (err) {
      console.error('Sheets append failed (PM History):', err);
    }

    // Save print data so user can trigger PDF on click
    if (partsKit) {
      setPrintData({
        otId,
        date,
        unidad,
        model,
        pmLevel,
        levelsIncluded: partsKit.levelsIncluded,
        horometro: selectedEquipment?.current_horometro ?? 0,
        estimatedHours: partsKit.totalEstimatedHours,
        mecanico,
        autorizadoPor: userName,
        observaciones,
        parts: partsKit.parts,
      });
    }

    setToastMessage(`${otId} — PM ${pmLevel} programado para ${unidad}`);
    setToastVisible(true);
  }

  function handleToastDismiss() {
    setToastVisible(false);
    navigate(-1);
  }

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <SuccessToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={handleToastDismiss}
      />

      <ConfirmModal
        open={showConfirm}
        title="Activar Orden de Mantenimiento"
        message={`¿Generar OT de ${pmLevel} para ${unidad} (${model})?\n\nSe ordenarán ${partsKit?.parts.length ?? 0} refacciones automáticamente.`}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-text">Orden de PM</h1>
          <p className="text-xs text-text-secondary">Genera OT + ordena refacciones automáticamente</p>
        </div>
      </div>

      {/* Step 1: Select Unit */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-amber text-white flex items-center justify-center text-xs font-bold">1</div>
          <span className="font-semibold text-text">Seleccionar Equipo</span>
        </div>
        <select
          value={unidad}
          onChange={(e) => handleUnitChange(e.target.value)}
          className="w-full rounded-xl border border-border p-3 bg-white text-text"
        >
          <option value="">Seleccionar unidad...</option>
          {EQUIPMENT_CATALOG.map((eq) => (
            <option key={eq.unit_id} value={eq.unit_id}>
              {eq.unit_id} — {eq.model} ({eq.current_horometro.toLocaleString()} hrs)
            </option>
          ))}
        </select>

        {/* PM proximity card */}
        {pmInfo && selectedEquipment && (
          <div className={`mt-3 rounded-xl p-3 border flex items-center gap-3 ${
            pmInfo.hours_remaining <= 0
              ? 'bg-red-50 border-critical'
              : pmInfo.hours_remaining <= 50
              ? 'bg-amber-50 border-amber'
              : 'bg-blue-50 border-blue-300'
          }`}>
            <Clock size={18} className={
              pmInfo.hours_remaining <= 0 ? 'text-critical' :
              pmInfo.hours_remaining <= 50 ? 'text-amber' : 'text-blue-500'
            } />
            <div className="flex-1">
              <p className="text-sm font-medium text-text">
                Próximo: {pmInfo.level} a {pmInfo.due_at.toLocaleString()} hrs
              </p>
              <p className="text-xs text-text-secondary">
                {pmInfo.hours_remaining <= 0
                  ? `VENCIDO ${Math.abs(pmInfo.hours_remaining)} hrs`
                  : `Faltan ${pmInfo.hours_remaining} hrs`}
              </p>
            </div>
            <button
              type="button"
              onClick={useSuggested}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber text-white whitespace-nowrap"
            >
              Usar {pmInfo.level}
            </button>
          </div>
        )}
      </div>

      {/* Step 2: Select PM Level */}
      {unidad && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-amber text-white flex items-center justify-center text-xs font-bold">2</div>
            <span className="font-semibold text-text">Nivel de PM</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {availableLevels.map((level) => {
              const isSelected = pmLevel === level;
              const isSuggested = level === suggestedLevel;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleLevelSelect(level)}
                  className={`relative px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                    isSelected
                      ? 'bg-amber text-white border-amber'
                      : 'bg-white text-text-secondary border-border hover:border-amber'
                  }`}
                >
                  {level}
                  {isSuggested && !isSelected && (
                    <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber rounded-full border-2 border-white" />
                  )}
                </button>
              );
            })}
          </div>
          {pmLevel && (
            <p className="text-xs text-text-secondary mt-2">
              Incluye: {partsKit?.levelsIncluded.join(' + ')} — ~{partsKit?.totalEstimatedHours ?? 0} hrs estimadas
            </p>
          )}
        </div>
      )}

      {/* Step 3: Auto-populated parts list */}
      {partsKit && partsKit.parts.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-amber text-white flex items-center justify-center text-xs font-bold">3</div>
            <span className="font-semibold text-text">Refacciones ({partsKit.parts.length})</span>
            <CheckCircle size={16} className="text-success ml-auto" />
            <span className="text-xs text-success font-medium">Auto-generado</span>
          </div>

          {CATEGORY_ORDER.filter((cat) => groupedParts[cat]).map((category) => (
            <div key={category} className="mb-3 last:mb-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-sm">{CATEGORY_ICONS[category]}</span>
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  {category}
                </span>
              </div>
              {groupedParts[category].map((part, idx) => (
                <div
                  key={`${part.partNumber}-${idx}`}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg mb-1 last:mb-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{part.description}</p>
                    <p className="text-xs text-amber font-mono">{part.partNumber}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    <span className="text-sm font-bold text-text">{part.quantity}</span>
                    <span className="text-xs text-text-secondary">{part.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Summary row */}
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-text-secondary" />
              <span className="text-sm text-text-secondary">
                {partsKit.parts.length} ítems
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-text-secondary" />
              <span className="text-sm text-text-secondary">
                ~{partsKit.totalEstimatedHours} hrs
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Assign mechanic + notes */}
      {partsKit && partsKit.parts.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-amber text-white flex items-center justify-center text-xs font-bold">4</div>
            <span className="font-semibold text-text">Asignar</span>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-secondary">Mecánico (opcional)</label>
              <input
                type="text"
                value={mecanico}
                onChange={(e) => setMecanico(e.target.value)}
                placeholder="Nombre del mecánico asignado"
                className="w-full rounded-xl border border-border p-3 text-sm text-text bg-white"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-secondary">Observaciones</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas adicionales para el mecánico..."
                rows={3}
                className="w-full rounded-xl border border-border p-3 text-sm text-text resize-none bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Warning for overdue PM */}
      {pmInfo && pmInfo.hours_remaining <= 0 && pmLevel === suggestedLevel && (
        <div className="bg-red-50 border border-critical rounded-xl p-3 flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-critical shrink-0" />
          <span className="text-sm font-medium text-critical">
            PM VENCIDO — Prioridad máxima. Equipo no debe operar sin este mantenimiento.
          </span>
        </div>
      )}

      {/* Submit */}
      {/* Submit or Print */}
      {printData ? (
        <button
          type="button"
          onClick={() => printPMOrder(printData)}
          className="w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg transition-opacity flex items-center justify-center gap-2 btn-press"
          style={{ minHeight: 52 }}
        >
          <Wrench size={20} />
          Imprimir Orden de PM
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSubmitIntent}
          disabled={!canSubmit}
          className="w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2 btn-press"
          style={{ minHeight: 52 }}
        >
          <Wrench size={20} />
          Activar Orden de PM
        </button>
      )}
    </div>
  );
}
```

## File: src/pages/ViajePage.tsx
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { mexicoDate, mexicoTime } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { useAuthStore } from '../stores/auth-store';
import ConfirmModal from '../components/ui/ConfirmModal';
import SuccessToast from '../components/ui/SuccessToast';

const MATERIAL_OPTIONS = ['Tierra', 'Roca', 'Grava', 'Mineral', 'Caliza', 'Otro'];

export default function ViajePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const [unidad, setUnidad] = useState('');
  const [rutaOrigen, setRutaOrigen] = useState('');
  const [rutaDestino, setRutaDestino] = useState('');
  const [kmCargado, setKmCargado] = useState('');
  const [kmVacio, setKmVacio] = useState('');
  const [material, setMaterial] = useState('');
  const [tonelaje, setTonelaje] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const kmTotal =
    kmCargado !== '' && kmVacio !== ''
      ? (parseFloat(kmCargado) || 0) + (parseFloat(kmVacio) || 0)
      : null;

  const canSubmit =
    unidad !== '' &&
    rutaOrigen.trim() !== '' &&
    rutaDestino.trim() !== '' &&
    kmCargado !== '' &&
    kmVacio !== '';

  function handleSubmitIntent() {
    if (!canSubmit) return;
    setShowConfirm(true);
  }

  async function handleConfirm() {
    setShowConfirm(false);

    const kmCargadoNum = parseFloat(kmCargado) || 0;
    const kmVacioNum = parseFloat(kmVacio) || 0;

    try {
      await appendRow(SHEET_TABS.FLETES, [
        String(Date.now()),
        mexicoDate(),
        mexicoTime(),
        unidad,
        userName,
        rutaOrigen,
        rutaDestino,
        String(kmCargadoNum),
        String(kmVacioNum),
        String(kmCargadoNum + kmVacioNum),
        material,
        String(parseFloat(tonelaje) || 0),
        observaciones,
      ]);
    } catch (err) {
      console.error('Sheets append failed (Viajes):', err);
    }

    setToastMessage('Flete registrado ✓');
    setToastVisible(true);
  }

  function handleToastDismiss() {
    setToastVisible(false);
    navigate(-1);
  }

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      <SuccessToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={handleToastDismiss}
      />

      <ConfirmModal
        open={showConfirm}
        title="Confirmar registro de flete"
        message={`¿Registrar flete de ${rutaOrigen} → ${rutaDestino} para ${unidad || 'la unidad'}?`}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Registro de Flete</h1>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-4">
        {/* Unidad */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Camión / Unidad</label>
          <select
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar unidad...</option>
            {EQUIPMENT_CATALOG.filter(
              (eq) => eq.type === 'Camión Articulado' || eq.type === 'Camión Pesado'
            ).map((eq) => (
              <option key={eq.unit_id} value={eq.unit_id}>
                {eq.unit_id} — {eq.model}
              </option>
            ))}
          </select>
        </div>

        {/* Ruta origen */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Ruta Origen</label>
          <input
            type="text"
            value={rutaOrigen}
            onChange={(e) => setRutaOrigen(e.target.value)}
            placeholder="Frente 3"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* Ruta destino */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Ruta Destino</label>
          <input
            type="text"
            value={rutaDestino}
            onChange={(e) => setRutaDestino(e.target.value)}
            placeholder="Patio de acopio"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* KM grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">KM Cargado</label>
            <input
              type="number"
              value={kmCargado}
              onChange={(e) => setKmCargado(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">KM Vacío</label>
            <input
              type="number"
              value={kmVacio}
              onChange={(e) => setKmVacio(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-border p-3 text-text bg-white"
            />
          </div>
        </div>

        {/* KM total read-only */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">KM Total</label>
          <div className="w-full rounded-xl border border-border p-3 bg-gray-50 text-text font-semibold">
            {kmTotal !== null ? `${kmTotal} km` : '—'}
          </div>
        </div>

        {/* Material */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Material</label>
          <select
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            className="w-full rounded-xl border border-border p-3 bg-white text-text"
          >
            <option value="">Seleccionar material...</option>
            {MATERIAL_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Tonelaje */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Tonelaje</label>
          <input
            type="number"
            value={tonelaje}
            onChange={(e) => setTonelaje(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-border p-3 text-text bg-white"
          />
        </div>

        {/* Observaciones */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-secondary">Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones del viaje..."
            rows={3}
            className="w-full rounded-xl border border-border p-3 text-sm text-text resize-none bg-white"
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmitIntent}
        disabled={!canSubmit}
        className="mt-4 w-full bg-amber text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
        style={{ minHeight: 52 }}
      >
        Registrar Flete
      </button>
    </div>
  );
}
```

## File: src/types/roles.ts
```typescript
export type AppRole =
  | 'operador'
  | 'mecanico'
  | 'jefe_taller'
  | 'coordinador'
  | 'supervisor'
  | 'gerencia';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

export const NAV_CONFIG: Record<AppRole, { visible: NavItem[]; overflow: NavItem[] }> = {
  operador: {
    visible: [
      { id: 'inicio', label: 'Inicio', icon: 'Home', path: '/operator' },
      { id: 'reportar', label: 'Reportar', icon: 'Camera', path: '/falla' },
      { id: 'dvir', label: 'DVIR', icon: 'ClipboardCheck', path: '/dvir' },
      { id: 'diesel', label: 'Diesel', icon: 'Fuel', path: '/diesel' },
      { id: 'mas', label: 'Más', icon: 'MoreHorizontal', path: '' },
    ],
    overflow: [
      { id: 'horometro', label: 'Horómetro', icon: 'Gauge', path: '/horometro' },
      { id: 'fletes', label: 'Fletes', icon: 'MapPin', path: '/flete' },
      { id: 'perfil', label: 'Perfil', icon: 'User', path: '/perfil' },
    ],
  },
  mecanico: {
    visible: [
      { id: 'inicio', label: 'Inicio', icon: 'Home', path: '/mechanic' },
      { id: 'ordenes', label: 'Órdenes', icon: 'Wrench', path: '/workorders' },
      { id: 'partes', label: 'Partes', icon: 'Package', path: '/parts' },
      { id: 'hermes', label: 'Hermes', icon: 'MessageCircle', path: '/chat' },
      { id: 'mas', label: 'Más', icon: 'MoreHorizontal', path: '' },
    ],
    overflow: [
      { id: 'manuales', label: 'Manuales', icon: 'BookOpen', path: '/manuals' },
      { id: 'diagramas', label: 'Diagramas', icon: 'FileImage', path: '/diagrams' },
    ],
  },
  jefe_taller: {
    visible: [
      { id: 'inicio', label: 'Inicio', icon: 'Home', path: '/workshop' },
      { id: 'ordenes', label: 'Órdenes', icon: 'Wrench', path: '/workorders' },
      { id: 'pm', label: 'PM', icon: 'Clock', path: '/pm' },
      { id: 'partes', label: 'Partes', icon: 'Package', path: '/parts' },
      { id: 'mas', label: 'Más', icon: 'MoreHorizontal', path: '' },
    ],
    overflow: [
      { id: 'pm-order', label: 'Orden PM', icon: 'CalendarCheck', path: '/pm-order' },
      { id: 'manuales', label: 'Manuales', icon: 'BookOpen', path: '/manuals' },
      { id: 'diagramas', label: 'Diagramas', icon: 'FileImage', path: '/diagrams' },
      { id: 'pedidos', label: 'Pedidos', icon: 'ShoppingCart', path: '/pedidos' },
      { id: 'neumaticos', label: 'Neumáticos', icon: 'Disc3', path: '/neumaticos' },
    ],
  },
  coordinador: {
    visible: [
      { id: 'inicio', label: 'Inicio', icon: 'Home', path: '/coordinator' },
      { id: 'ordenes', label: 'Órdenes', icon: 'Wrench', path: '/workorders' },
      { id: 'pm-order', label: 'Orden PM', icon: 'CalendarCheck', path: '/pm-order' },
      { id: 'inventario', label: 'Inventario', icon: 'Package', path: '/inventory' },
      { id: 'mas', label: 'Más', icon: 'MoreHorizontal', path: '' },
    ],
    overflow: [
      { id: 'pm', label: 'Programa PM', icon: 'Clock', path: '/pm' },
      { id: 'pedidos', label: 'Pedidos', icon: 'ShoppingCart', path: '/pedidos' },
      { id: 'alertas', label: 'Alertas', icon: 'AlertTriangle', path: '/alerts' },
    ],
  },
  supervisor: {
    visible: [
      { id: 'inicio', label: 'Inicio', icon: 'Home', path: '/supervisor' },
      { id: 'equipos', label: 'Equipos', icon: 'Truck', path: '/fleet' },
      { id: 'viajes', label: 'Viajes', icon: 'MapPin', path: '/viajes-pena' },
      { id: 'alertas', label: 'Alertas', icon: 'AlertTriangle', path: '/alerts' },
      { id: 'perfil', label: 'Perfil', icon: 'User', path: '/perfil' },
    ],
    overflow: [],
  },
  gerencia: {
    visible: [
      { id: 'dashboard', label: 'Dashboard', icon: 'BarChart3', path: '/dashboard' },
      { id: 'ordenes', label: 'Órdenes', icon: 'Wrench', path: '/workorders' },
      { id: 'briefing', label: 'Briefing', icon: 'FileText', path: '/briefing' },
      { id: 'pedidos', label: 'Pedidos', icon: 'ShoppingCart', path: '/pedidos' },
      { id: 'alertas', label: 'Alertas', icon: 'AlertTriangle', path: '/alerts' },
    ],
    overflow: [],
  },
};

export const ROLE_HOME: Record<AppRole, string> = {
  operador: '/operator',
  mecanico: '/mechanic',
  jefe_taller: '/workshop',
  coordinador: '/coordinator',
  supervisor: '/supervisor',
  gerencia: '/dashboard',
};

export const ROLE_LABELS: Record<AppRole, string> = {
  operador: 'Operador',
  mecanico: 'Mecánico',
  jefe_taller: 'Jefe de Taller',
  coordinador: 'Coordinador',
  supervisor: 'Supervisor',
  gerencia: 'Gerencia',
};
```

## File: src/App.tsx
```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth-store';
import { ROLE_HOME } from './types/roles';
import LoginPage from './pages/LoginPage';
import OperatorHomePage from './pages/OperatorHomePage';
import MechanicPage from './pages/MechanicPage';
import DVIRPage from './pages/DVIRPage';
import FallaPage from './pages/FallaPage';
import DashboardPage from './pages/DashboardPage';
import ChatPage from './pages/ChatPage';
import DieselPage from './pages/DieselPage';
import HorometroPage from './pages/HorometroPage';
import ViajePage from './pages/ViajePage';
import ViajesPenaPage from './pages/ViajesPenaPage';
import AlertsPage from './pages/AlertsPage';
import PerfilPage from './pages/PerfilPage';
import MyReportsPage from './pages/MyReportsPage';
import InventoryPage from './pages/InventoryPage';
import PMSchedulePage from './pages/PMSchedulePage';
import PMWorkOrderPage from './pages/PMWorkOrderPage';
import AppShell from './components/layout/AppShell';
import FleetPage from './pages/FleetPage';
import PartsSearch from './components/mechanic/PartsSearch';
import ManualSearch from './components/mechanic/ManualSearch';
import DiagramViewer from './components/mechanic/DiagramViewer';
import BriefingCard from './components/dashboard/BriefingCard';
import WorkOrdersPage from './pages/WorkOrdersPage';
import WorkOrderDetailPage from './pages/WorkOrderDetailPage';
import SupervisorHomePage from './pages/SupervisorHomePage';
import CoordinatorHomePage from './pages/CoordinatorHomePage';
import WorkshopHomePage from './pages/WorkshopHomePage';
import NeumaticosPage from './pages/NeumaticosPage';
import PedidosPage from './pages/PedidosPage';


function RootRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);

  if (isAuthenticated && role) {
    return <Navigate to={ROLE_HOME[role]} replace />;
  }
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/chat" element={<ChatPage />} />

      <Route element={<AppShell />}>
        <Route path="/operator" element={<OperatorHomePage />} />
        <Route path="/mechanic" element={<MechanicPage />} />
        <Route path="/workshop" element={<WorkshopHomePage />} />
        <Route path="/coordinator" element={<CoordinatorHomePage />} />
        <Route path="/supervisor" element={<SupervisorHomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dvir" element={<DVIRPage />} />
        <Route path="/dvir-compliance" element={<DVIRPage />} />
        <Route path="/fleet" element={<FleetPage />} />
        <Route path="/falla" element={<FallaPage />} />
        <Route path="/workorders/:otId" element={<WorkOrderDetailPage />} />
        <Route path="/workorders" element={<WorkOrdersPage />} />
        <Route path="/parts" element={<PartsSearch />} />
        <Route path="/manuals" element={<ManualSearch />} />
        <Route path="/diagrams" element={<DiagramViewer />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/pm" element={<PMSchedulePage />} />
        <Route path="/pm-order" element={<PMWorkOrderPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/pedidos" element={<PedidosPage />} />
        <Route path="/briefing" element={<BriefingCard />} />
        <Route path="/diesel" element={<DieselPage />} />
        <Route path="/horometro" element={<HorometroPage />} />
        <Route path="/viaje" element={<ViajePage />} />
        <Route path="/flete" element={<ViajePage />} />
        <Route path="/viajes-pena" element={<ViajesPenaPage />} />
        <Route path="/perfil" element={<PerfilPage />} />
        <Route path="/my-reports" element={<MyReportsPage />} />
        <Route path="/neumaticos" element={<NeumaticosPage />} />
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
```

## File: src/lib/sheets-api.ts
```typescript
const HERMES_API = '/hermes-api';

export async function appendRow(tab: string, values: string[]): Promise<void> {
  const response = await fetch(`${HERMES_API}/api/sheets/append`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab, values }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets API error ${response.status}: ${text}`);
  }
}

export async function readRange(tab: string): Promise<string[][]> {
  const params = new URLSearchParams({ tab });
  const response = await fetch(`${HERMES_API}/api/sheets/read?${params}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets API error ${response.status}: ${text}`);
  }
  const data = await response.json();
  return data.data || [];
}

export async function updateCell(
  tab: string,
  searchColumn: number,
  searchValue: string,
  updateColumn: number,
  updateValue: string
): Promise<void> {
  const response = await fetch(`${HERMES_API}/api/sheets/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tab,
      search_column: searchColumn,
      search_value: searchValue,
      update_column: updateColumn,
      update_value: updateValue,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets update error ${response.status}: ${text}`);
  }
}

export const SHEET_TABS = {
  INSPECCIONES: '14 Inspecciones',
  AVERIAS: 'Averías',
  ORDENES_TRABAJO: 'ORDENES_TRABAJO',
  OT_STATUS_LOG: 'OT_STATUS_LOG',
  COMBUSTIBLE: 'Combustible',
  VIAJES: 'Reporte_Viajes_Peña',
  HOROMETROS: '04B Registro Horómetros',
  HISTORIAL_PM: '05 Historial PM',
  ORDENES_MANTENIMIENTO: 'Ordenes Mantenimiento',
  INVENTARIO: '12 Inventario Rep.',
  FLETES: 'Reporte_Fletes_Transporte',
  INCIDENTES: 'Incidentes',
  TURNOS: 'Turnos',
  COTIZACIONES: 'Cotizaciones_Pendientes',
  NEUMATICOS: '13 Neumáticos',
} as const;
```

## File: src/components/chat/HermesChat.tsx
```typescript
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/auth-store';
import { EQUIPMENT_CATALOG } from '../../data/equipment-catalog';
import {
  diagnose,
  photoToFailure,
  manualLookup,
  searchParts,
  findDiagram,
  type DiagnoseResult,
  type PhotoAnalysisResult,
  type ManualLookupResult,
  type PartResult,
} from '../../lib/hermes-api';
import { fileToBase64 } from '../../lib/photo-upload';
import type { ChatMessage } from '../../types/chat';
import ChatBubble from './ChatBubble';
import TypingIndicator from './TypingIndicator';
import ChatInput from './ChatInput';

// ─── Mock fallbacks (used when VPS API is unreachable) ───────────────────────

const MOCK_DIAGNOSE: DiagnoseResult = {
  causas_probables: [
    'Sello de cilindro desgastado',
    'Manguera de presión dañada',
    'Conexión hidráulica floja',
  ],
  checklist_diagnostico: [
    'Verificar nivel de aceite hidráulico',
    'Inspeccionar vástago del cilindro',
    'Revisar mangueras por agrietamiento',
    'Verificar presión del sistema',
  ],
  partes_probables: [
    'Kit sello cilindro — P/N 707-99-47570',
    'Manguera presión — P/N 207-62-71451',
    'O-ring set — P/N 07000-15135',
  ],
  prioridad: 'ALTA',
};

const MOCK_PHOTO_ANALYSIS: PhotoAnalysisResult = {
  componente_probable: 'Cilindro hidráulico de pluma',
  tipo_de_dano: 'Fuga externa por sello desgastado',
  severidad: 'Alta — requiere atención en < 8 horas',
  recomendacion_inicial:
    'Detener operación. Verificar nivel de aceite hidráulico. No operar hasta reparación. Preparar kit de sellos y manguera de respaldo.',
};

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatDiagnose(result: DiagnoseResult, equipo: string): string {
  const causas = result.causas_probables
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');
  const checklist = result.checklist_diagnostico
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');
  const partes = result.partes_probables.map((p) => {
    if (typeof p === 'object' && p !== null) {
      const obj = p as Record<string, unknown>;
      const oem = obj.oem || obj.part_number || '';
      const desc = obj.descripcion || obj.description || '';
      const precio = obj.precio_estimado || '';
      return `• ${oem} — ${desc}${precio ? ` | ${precio}` : ''}`;
    }
    return `• ${p}`;
  }).join('\n');

  return `🔍 **Diagnóstico para ${equipo}**\n\n**Causas probables:**\n${causas}\n\n**Checklist:**\n${checklist}\n\n**Partes sugeridas:**\n${partes}\n\n**Prioridad:** ${result.prioridad}`;
}

function formatPhotoAnalysis(result: PhotoAnalysisResult): string {
  return `📷 **Análisis de imagen**\n\n**Componente:** ${result.componente_probable}\n**Tipo de daño:** ${result.tipo_de_dano}\n**Severidad:** ${result.severidad}\n\n**Recomendación:** ${result.recomendacion_inicial}`;
}

function formatSearchParts(results: PartResult[], query: string): string {
  if (results.length === 0) {
    return `📦 **Resultados para '${query}'**\n\nNo se encontraron partes con ese criterio.`;
  }
  const lines = results
    .map(
      (p) =>
        `• ${p.part_number} — ${p.description} | Stock: ${p.stock_quantity} | $${p.unit_price}`
    )
    .join('\n');
  return `📦 **Resultados para '${query}'**\n\n${lines}`;
}

function formatManualLookup(result: ManualLookupResult): string {
  const pasos = result.pasos_tecnicos.map((p, i) => `${i + 1}. ${p}`).join('\n');
  const herramientas = result.herramientas_requeridas.join(', ');
  const torque = result.torque_specs ? `\n\n**Torque:** ${result.torque_specs}` : '';
  return `📖 **Procedimiento**\n\n${result.extracto}\n\n**Pasos:**\n${pasos}\n\n**Herramientas:** ${herramientas}${torque}`;
}

// ─── Intent detection ────────────────────────────────────────────────────────

function isPartNumber(text: string): boolean {
  // Match common OEM formats:
  // Komatsu: 600-XXX-XXXX, 6261-11-3200, 01010-81020
  // CAT: 223-1335, 1R-0749, 253-0616
  // Doosan: K9003166, 65.26201-7076B, 300516-00020
  // Mack: 22398223, 21870635
  const t = text.toUpperCase().trim();
  return /\d{2,}-\d{2,}/.test(t) || /^[A-Z]?\d{7,}$/.test(t) || /^\d{2,}\.\d{4,}/.test(t) || /^[A-Z]\d{3,}-\d{3,}/.test(t);
}

function isManualQuery(text: string): boolean {
  return /manual|procedimiento|cómo|como|pasos/i.test(text);
}

function isDiagramQuery(text: string): boolean {
  return /diagrama|diagram|esquema|plano|dibujo/i.test(text);
}

function extractPartNumber(text: string): string | null {
  // Extract the part number from mixed text like "223-1335 diagrama"
  const match = text.match(/([A-Z]?\d{2,}-\d{2,}[-\d]*|\d{7,}|[A-Z]\d{3,}-\d{3,}[\w]*|\d{2,}\.\d{4,}[-\w]*)/i);
  return match ? match[1] : null;
}

/** Detect equipment model from user message text when selector is "General" */
function detectEquipmentFromText(text: string): string {
  const models: [RegExp, string][] = [
    [/D155/i, 'Komatsu D155AX-6'],
    [/D65/i, 'Komatsu D65EX-16'],
    [/HM400/i, 'Komatsu HM400-3'],
    [/HM\s?400/i, 'Komatsu HM400-3'],
    [/CAT\s?740|740B/i, 'CAT 740B'],
    [/DX\s?360/i, 'Doosan DX360LCA'],
    [/DX\s?340/i, 'Doosan DX340LC'],
    [/DX\s?225/i, 'Doosan DX225LC'],
    [/DL\s?420/i, 'Doosan DL420A'],
    [/Mack|GR84|GR64/i, 'Mack GR84B 8x4'],
    [/EPAK/i, 'CAT 740B'],
    [/EPTK/i, 'Komatsu D155AX-6'],
    [/EPCF/i, 'Doosan DL420A'],
    [/EPEX/i, 'Doosan DX340LC'],
    [/ULTRATK/i, 'Mack GR84B 8x4'],
  ];
  for (const [pattern, model] of models) {
    if (pattern.test(text)) return model;
  }
  return 'General';
}

// ─── Greeting ────────────────────────────────────────────────────────────────

function buildGreeting(userName: string): ChatMessage {
  const content = `Hola ${userName}. Soy Hermes, tu asistente técnico.\n\nPuedo ayudarte con:\n• Diagnóstico de fallas — envía foto o describe el síntoma\n• Búsqueda de partes — número OEM o descripción\n• Procedimientos de reparación — manuales y torques\n• Códigos de falla — qué significan y qué revisar\n\n¿En qué te puedo ayudar?`;
  return {
    id: 'greeting',
    role: 'hermes',
    content,
    timestamp: new Date(),
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HermesChat() {
  const userName = useAuthStore((s) => s.userName);
  const assignedUnits = useAuthStore((s) => s.assignedUnits);

  const defaultUnit =
    assignedUnits.length > 0 ? assignedUnits[0] : 'General';

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    buildGreeting(userName || 'Operador'),
  ]);
  const [selectedUnit, setSelectedUnit] = useState<string>(defaultUnit);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = useCallback(
    async (text: string, photo?: File) => {
      const photoUrl = photo ? URL.createObjectURL(photo) : undefined;

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        photo_url: photoUrl,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      let responseText: string;

      try {
        if (photo) {
          const foto_base64 = await fileToBase64(photo);
          try {
            const result = await photoToFailure({
              foto_base64,
              equipo: selectedUnit !== 'General' ? selectedUnit : undefined,
            });
            responseText = formatPhotoAnalysis(result);
          } catch {
            responseText = formatPhotoAnalysis(MOCK_PHOTO_ANALYSIS);
          }
        } else if (isPartNumber(text) || extractPartNumber(text)) {
          // Part number detected — search catalog first
          const pn = extractPartNumber(text) ?? text.trim();
          const wantsDiagram = isDiagramQuery(text);
          const equipUnit = selectedUnit !== 'General' ? selectedUnit : detectEquipmentFromText(text);
          try {
            const results = await searchParts(
              pn,
              equipUnit !== 'General' ? equipUnit : undefined
            );
            if (results.length > 0) {
              responseText = formatSearchParts(results, pn);
              if (wantsDiagram) {
                // Determine equipment from search results or part number format
                let diagEquip = equipUnit;
                if (diagEquip === 'General') {
                  // Try to detect from first result's compatible_units or location
                  const r = results[0];
                  if (r.compatible_units?.length > 0) {
                    diagEquip = r.compatible_units[0];
                  } else if (r.location) {
                    diagEquip = r.location;
                  }
                }
                // Also detect brand from part number prefix
                if (diagEquip === 'General') {
                  if (/^6\d{3}-/.test(pn) || /^0\d{4}-/.test(pn)) diagEquip = 'Komatsu HM400-3';
                  else if (/^\d{3}-\d{4}$/.test(pn)) diagEquip = 'CAT 740B';
                  else if (/^[A-Z]\d{4,}/.test(pn) || /^6[5]\.\d/.test(pn)) diagEquip = 'Doosan DX340LC';
                  else if (/^\d{8}$/.test(pn)) diagEquip = 'Mack GR84B';
                }
                try {
                  const diag = await findDiagram(diagEquip, pn);
                  if (diag.found && diag.image_url && diag.page !== undefined) {
                    const nextPage = diag.page + 1;
                    responseText += `\n\n📐 **Diagrama — ${diag.section ?? ''}**\n![Diagrama](/hermes-api${diag.image_url})\n\n📋 **Lista de Partes**\n![Partes](/hermes-api/diagrams/page/${diag.pdf}/${nextPage})`;
                  } else if (diag.found && diag.image_url) {
                    responseText += `\n\n📐 **Diagrama**\n![Diagrama](/hermes-api${diag.image_url})`;
                  } else {
                    responseText += `\n\n📐 **Diagrama**\nVe a **Más → Diagramas** y busca el modelo del equipo.`;
                  }
                } catch {
                  responseText += `\n\n📐 **Diagrama**\nVe a **Más → Diagramas** y busca el modelo del equipo.`;
                }
              }
            } else {
              // No catalog match — ask AI
              const effectiveUnit = equipUnit !== 'General' ? equipUnit : 'todos';
              const result = await diagnose({
                equipo: effectiveUnit,
                sintoma: `BÚSQUEDA DE PARTE: ${pn}. Busca en el catálogo.`,
              });
              responseText = formatDiagnose(result, effectiveUnit);
            }
          } catch {
            responseText = `📦 **Búsqueda: '${pn}'**\n\nNo pude conectar con el servidor. Verifica tu conexión e intenta de nuevo.`;
          }
        } else if (isDiagramQuery(text)) {
          const unitInfo = selectedUnit !== 'General' ? ` para ${selectedUnit}` : '';
          responseText = `📐 **Diagramas${unitInfo}**\n\nLos diagramas técnicos están disponibles en la sección de **Diagramas** del menú.\n\n👉 Ve a **Más → Diagramas** o usa la pestaña Diagramas en el Workbench del Mecánico.\n\nDisponibles:\n• D155AX-6 (Komatsu)\n• HM400-3 (Komatsu)\n• DX340LC (Doosan)\n• DX225LCA (Doosan)\n• DL420A (Doosan)\n• MACK GR84B`;
        } else if (isManualQuery(text)) {
          try {
            const result = await manualLookup({
              equipo: selectedUnit,
              tema: text,
            });
            responseText = formatManualLookup(result);
          } catch {
            responseText = `📖 **Procedimiento**\n\nNo pude acceder al manual en este momento. Consulta el manual físico o intenta de nuevo con conexión al servidor.`;
          }
        } else {
          // Auto-detect equipment from message if selector is "General"
          const effectiveUnit = selectedUnit !== 'General'
            ? selectedUnit
            : detectEquipmentFromText(text);
          try {
            const result = await diagnose({
              equipo: effectiveUnit,
              sintoma: text,
            });
            responseText = formatDiagnose(result, selectedUnit);
          } catch {
            responseText = formatDiagnose(MOCK_DIAGNOSE, selectedUnit);
          }
        }
      } catch {
        responseText =
          'Lo siento, no pude procesar tu consulta. Verifica tu conexión o intenta de nuevo.';
      }

      const hermesMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'hermes',
        content: responseText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, hermesMsg]);
      setIsLoading(false);
    },
    [selectedUnit]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Unit selector */}
      <div className="px-4 py-2 flex items-center gap-2 border-b" style={{ borderColor: '#E5E7EB', backgroundColor: '#F1F5F9' }}>
        <span className="text-xs font-medium" style={{ color: '#6B7280' }}>
          Equipo:
        </span>
        <select
          value={selectedUnit}
          onChange={(e) => setSelectedUnit(e.target.value)}
          className="text-sm font-medium rounded-full px-4 py-1 outline-none appearance-none cursor-pointer"
          style={{
            backgroundColor: '#1E3A8A',
            color: 'white',
          }}
        >
          <option value="General">General</option>
          {EQUIPMENT_CATALOG.map((eq) => (
            <option key={eq.unit_id} value={eq.unit_id}>
              {eq.unit_id} — {eq.model}
            </option>
          ))}
        </select>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        style={{ backgroundColor: '#F1F5F9' }}
      >
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
```
