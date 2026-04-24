// FoodLab design system — the single import surface for anything building
// UI. Pages and feature components should import from "@/design-system",
// not from "@/components/ui/*" directly, so that when we swap or restyle a
// primitive it propagates everywhere.
//
// Structure:
//   tokens.ts                 — semantic color roles, spacing, container sizes
//   components/PageHeader     — h1 + subtitle + actions
//   components/SectionHeader  — h2 for in-page sections
//   components/EmptyState     — dashed-border callout when a list is empty
//   components/ProfileChip    — toggle pill for profile selection
//   components/LoadingRow     — inline spinner + label
//
// Primitives (button, card, badge, input, label, textarea, spinner) are
// re-exported below so a single `import { Button, Card, PageHeader } from
// "@/design-system"` covers most pages.

export * from "./tokens";

// Compositions
export { PageHeader } from "./components/PageHeader";
export { SectionHeader } from "./components/SectionHeader";
export { EmptyState } from "./components/EmptyState";
export { ProfileChip } from "./components/ProfileChip";
export { LoadingRow } from "./components/LoadingRow";

// Primitives (wrapped shadcn/ui). Re-exported so consumers don't need to know
// the internal folder structure.
export { Badge } from "@/components/ui/badge";
export { Button, type ButtonProps } from "@/components/ui/button";
export {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
export { Input } from "@/components/ui/input";
export { Label } from "@/components/ui/label";
export { Spinner } from "@/components/ui/spinner";
export { Textarea } from "@/components/ui/textarea";
