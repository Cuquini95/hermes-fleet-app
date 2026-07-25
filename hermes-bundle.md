Warning: truncated output (original token count: 103562)
Total output lines: 11547

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
            onCh…53562 tokens truncated…lassName="flex flex-col gap-1">
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
