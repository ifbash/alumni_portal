/**
 * The UI kit's public surface.
 *
 * Screens import from `@/components/ui` and nowhere deeper. Keeping the
 * entry point single means the kit can be reorganised — a component split
 * out, a file renamed — without touching forty pages.
 *
 * Nothing in here contains a hardcoded colour, radius, font or duration.
 * Every value resolves through the tenant's design tokens, which is the
 * property that makes a new customer a JSON file in `brands/` rather than
 * a branch.
 */

export {
  Button,
  ButtonLink,
  Spinner,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  Badge,
  Avatar,
  Alert,
  EmptyState,
  Skeleton,
  Progress,
  Separator,
  Stat,
  DetailRow,
  Kbd,
  type ButtonProps,
  type ButtonLinkProps,
} from './primitives';

export {
  Field,
  describedBy,
  Input,
  Textarea,
  Select,
  Checkbox,
  Radio,
  Switch,
  Fieldset,
  FormActions,
  type FieldProps,
  type InputProps,
} from './form';

export {
  PageHeader,
  Breadcrumbs,
  Tabs,
  SegmentedNav,
  ChipNav,
  Pagination,
  Section,
  type TabItem,
} from './nav';

// Signed-in patterns: media, tasks, actions and explanation.
export { MediaFrame, CoverArt, DateTile, type MediaAspect } from './media';
export { NeedsYou, SummaryLine, type TaskItem } from './tasks';
export { StickyActionBar } from './actions';
export { ShareActions, CopyButton, DropZone } from './actions-client';
export { HowThisWorks, TrustChip } from './explain';

export {
  TableWrap,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  TableEmpty,
  DefinitionCard,
} from './table';

export {
  Dialog,
  ConfirmDialog,
  Sheet,
  Menu,
  MenuItem,
  MenuSeparator,
  MenuLabel,
  Popover,
  Disclosure,
  Tooltip,
} from './overlay';

export { ToastProvider, useToast } from './toast';
export { ThemeToggle } from './ThemeToggle';
