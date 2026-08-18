import {
  Home, Users, Handshake, Calendar, Briefcase, Heart, User, Settings,
  Shield, Upload, Megaphone, Palette, ScrollText, Building2, GraduationCap,
  RefreshCw, FileCheck2, BarChart3, Newspaper, Image as ImageIcon, Bell,
  ClipboardList, type LucideIcon,
} from 'lucide-react';
import type { IconName } from '@/lib/navigation';

/**
 * Icon lookup for navigation.
 *
 * The nav config in `lib/navigation.ts` names icons as strings so it stays
 * a plain data module importable from anywhere, including places that
 * cannot pull in a React component. This is the single place those names
 * become elements.
 */
const ICONS: Record<IconName, LucideIcon> = {
  home: Home,
  users: Users,
  handshake: Handshake,
  calendar: Calendar,
  briefcase: Briefcase,
  heart: Heart,
  user: User,
  settings: Settings,
  shield: Shield,
  upload: Upload,
  megaphone: Megaphone,
  palette: Palette,
  scroll: ScrollText,
  building: Building2,
  graduation: GraduationCap,
  refresh: RefreshCw,
  'file-check': FileCheck2,
  chart: BarChart3,
  newspaper: Newspaper,
  image: ImageIcon,
  bell: Bell,
  clipboard: ClipboardList,
};

export function NavIcon({ name, className }: { name: IconName; className?: string }) {
  const Cmp = ICONS[name] ?? Home;
  // Decorative: every nav item has a visible text label beside it, so a
  // screen reader announcing the icon as well would just say it twice.
  return <Cmp className={className ?? 'size-4'} aria-hidden="true" strokeWidth={1.75} />;
}
