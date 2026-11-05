# shadcn/ui Component Rules

> **Golden rule: never recreate a shadcn/ui component**

---

## 1. Core Principles

### 1.1 Do Not Recreate Components

```typescript
// ❌ Not allowed: building a new base component
// src/components/MyButton.tsx - strictly prohibited!
export function MyButton({ children }) {
  return <button className="px-4 py-2">{children}</button>;
}

// ✅ Required: use the existing shadcn/ui component
import { Button } from "@/components/ui/button";

export function SubmitButton() {
  return <Button type="submit">Submit</Button>;
}
```

### 1.2 Why Is Recreating Components Prohibited?

- **Consistency**: the same design system is maintained across the whole app
- **Maintainability**: a style change in one place is reflected everywhere
- **Testing**: shadcn/ui components are already tested
- **Accessibility**: built-in a11y support is included
- **Time savings**: no reinventing the wheel

---

## 2. Available Components (54)

### 2.1 Layout & Navigation

```typescript
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Resizable,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Sidebar } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { NavigationMenu } from "@/components/ui/navigation-menu";
import { Menubar } from "@/components/ui/menubar";
import { Pagination } from "@/components/ui/pagination";
```

### 2.2 Forms & Input

```typescript
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Field } from "@/components/ui/field";
import { InputOTP } from "@/components/ui/input-otp";
import { Calendar } from "@/components/ui/calendar";
import { ButtonGroup } from "@/components/ui/button-group";
import { InputGroup } from "@/components/ui/input-group";
```

### 2.3 Feedback & Overlay

```typescript
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Sonner } from "@/components/ui/sonner"; // Toast notifications
```

### 2.4 Data Display

```typescript
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Chart } from "@/components/ui/chart";
import { Empty } from "@/components/ui/empty";
import { Typography } from "@/components/ui/typography";
import { Kbd } from "@/components/ui/kbd";
import { AspectRatio } from "@/components/ui/aspect-ratio";
```

### 2.5 Menu & Command

```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Item } from "@/components/ui/item";
```

---

## 3. How to Check Available Components

### 3.1 Check the File List

```bash
# List all available components
ls packages/ui-registry/src/components/ui/
```

### 3.2 Run Storybook

```bash
npm run storybook
# View at http://localhost:6006
```

### 3.3 Check the Source Code

```bash
# View the source of a specific component
cat packages/ui-registry/src/components/ui/button.tsx
```

---

## 4. Correct Usage Patterns

### 4.1 Creating Domain Components (Recommended)

Create domain components by **composing** shadcn/ui components

```typescript
// src/components/dashboard/stats-card.tsx
// ✅ Correct pattern: composing shadcn/ui components

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StatsCardProps {
  title: string;
  value: string | number;
  badge?: string;
  icon: React.ReactNode;
}

export function StatsCard({ title, value, badge, icon }: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {badge && (
          <Badge variant="secondary" className="mt-1">
            {badge}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
```

### 4.2 Creating Form Components

```typescript
// src/components/forms/app-form.tsx
// ✅ Using the shadcn/ui Form components

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export function AppForm({ onSubmit }: AppFormProps) {
  const form = useForm<AppFormValues>({
    resolver: zodResolver(appSchema),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>App Name</FormLabel>
              <FormControl>
                <Input placeholder="Slack" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="communication">Communication</SelectItem>
                  <SelectItem value="productivity">Productivity</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
}
```

---

## 5. Custom Component Locations

### 5.1 Directory Structure

```
src/components/
├── ui/                    # ❌ Do not add anything here! (submodule symlink)
├── dashboard/             # ✅ Dashboard domain components
│   ├── stats-card.tsx
│   ├── stats-card.test.tsx
│   ├── app-list.tsx
│   └── app-list.test.tsx
├── forms/                 # ✅ Form components
│   ├── app-form.tsx
│   └── app-form.test.tsx
├── charts/                # ✅ Chart components
│   └── spending-chart.tsx
└── layouts/               # ✅ Layout components
    ├── dashboard-header.tsx
    └── dashboard-sidebar.tsx
```

### 5.2 Component Creation Checklist

```markdown
Before creating a new component:
[ ] Check whether a similar component exists in packages/ui-registry/src/components/ui/
[ ] Check the available components in Storybook
[ ] Review whether existing shadcn/ui components can solve the need

When creating a new component:
[ ] Create it in the src/components/[domain]/ folder
[ ] Implement it by composing shadcn/ui components
[ ] Create the test file alongside it (.test.tsx)
```

---

## 6. Test Writing Guide

### 6.1 Testing Domain Components

```typescript
// src/components/dashboard/stats-card.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsCard } from './stats-card';
import { TrendingUp } from 'lucide-react';

describe('StatsCard', () => {
  it('should render title and value', () => {
    render(
      <StatsCard
        title="Total Apps"
        value={42}
        icon={<TrendingUp />}
      />
    );

    expect(screen.getByText('Total Apps')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should render badge when provided', () => {
    render(
      <StatsCard
        title="Active Users"
        value={100}
        badge="+12%"
        icon={<TrendingUp />}
      />
    );

    expect(screen.getByText('+12%')).toBeInTheDocument();
  });
});
```

### 6.2 What You Do Not Need to Test

```typescript
// ❌ No need to test shadcn/ui internal behaviour
// Whether a Button is clickable, whether a Dialog opens, etc. is already tested

// ✅ Test domain logic only
// - The correct data is displayed
// - Event handlers are called correctly
// - Conditional rendering works
```

---

## 7. Common Mistakes

### 7.1 Creating Duplicate Components

```typescript
// ❌ Mistake: recreating a component that already exists
// src/components/common/LoadingSpinner.tsx
export function LoadingSpinner() {
  return <div className="animate-spin">...</div>;
}

// ✅ Fix: use the existing component
import { Spinner } from "@/components/ui/spinner";
// or
import { Skeleton } from "@/components/ui/skeleton";
```

### 7.2 Style Overrides

```typescript
// ❌ Mistake: building a completely different button with inline styles
<Button style={{ backgroundColor: 'purple', borderRadius: '20px' }}>

// ✅ Fix: use a variant or extend via className
<Button variant="secondary" className="rounded-full bg-purple-500">
```

### 7.3 Using Raw HTML Elements

```typescript
// ❌ Mistake: using <button> directly
<button onClick={handleClick}>Click me</button>

// ✅ Fix: use the shadcn/ui Button
<Button onClick={handleClick}>Click me</Button>
```

---

## 8. Next Steps

- [04-test-templates.md](./04-test-templates.md) - Copy-and-use test templates
- [05-common-patterns.md](./05-common-patterns.md) - Common test patterns
