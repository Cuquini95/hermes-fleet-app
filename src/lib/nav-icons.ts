/**
 * @fileoverview Explicit lucide-react icon map for bottom navigation.
 *
 * Named imports let Vite tree-shake lucide-react so only these icons ship.
 * Previously BottomNav and MoreTray used `import * as Icons from 'lucide-react'`,
 * which disables tree-shaking and bundles ~1200 icons (~610 KB raw / 152 KB gzip).
 *
 * Keep this map aligned with the `icon` values in `src/types/roles.ts` NAV_CONFIG.
 */
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Camera,
  ClipboardCheck,
  Clock,
  Disc3,
  FileImage,
  FileText,
  Fuel,
  Gauge,
  Home,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Package,
  Receipt,
  ShoppingCart,
  Table2,
  Truck,
  User,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export const NAV_ICONS: Readonly<Record<string, LucideIcon>> = {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Camera,
  ClipboardCheck,
  Clock,
  Disc3,
  FileImage,
  FileText,
  Fuel,
  Gauge,
  Home,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Package,
  Receipt,
  ShoppingCart,
  Table2,
  Truck,
  User,
  Wrench,
};

export type NavIconName = keyof typeof NAV_ICONS;
