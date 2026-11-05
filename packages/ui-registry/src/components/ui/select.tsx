"use client";

/**
 * Searchable Select — a drop-in replacement for the shadcn/Radix Select.
 *
 * Same parts and props as before (Select, SelectTrigger, SelectValue, SelectContent,
 * SelectItem, SelectGroup, SelectLabel, SelectSeparator, scroll buttons), so existing
 * forms keep working, but the list is rendered in a popover with a search box
 * (cmdk) so every dropdown in SubHub can be filtered by typing.
 *
 * Extras:
 * - `SelectContent searchPlaceholder` / `emptyText` customise the search UI.
 * - `SelectContent createOption={{ label, onCreate }}` adds a "+ Create …" row that
 *   receives the current search text (used for inline master-data creation).
 * - A hidden <input name> is rendered when `name` is set, for native form posts.
 */

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Command as CommandPrimitive } from "cmdk";
import { CheckIcon, ChevronDownIcon, PlusIcon, SearchIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

// ─── Label registry ─────────────────────────────────────────────────────────
// Items register their label while the list is closed so the trigger can show
// the selected item's label, exactly like Radix's ItemText mirroring.

type Registry = {
  labels: Map<string, { node: React.ReactNode; text: string }>;
  listeners: Set<() => void>;
};

function nodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean")
    return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (React.isValidElement(node)) {
    return nodeText((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

interface SelectContextValue {
  value: string | undefined;
  setValue: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled?: boolean;
  registry: Registry;
  register: (value: string, node: React.ReactNode) => void;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

function useSelectContext(part: string): SelectContextValue {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error(`<${part}> must be used within <Select>`);
  return ctx;
}

/** "collect" = closed (register labels only), "list" = rendered inside the open list. */
const ContentModeContext = React.createContext<"collect" | "list">("collect");

// ─── Root ───────────────────────────────────────────────────────────────────

interface SelectProps {
  value?: string;
  defaultValue?: string;
  // Method syntax (bivariant) so handlers typed to a string-literal union still fit,
  // matching the Radix Select typings this component replaces.
  onValueChange?(value: string): void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?(open: boolean): void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  dir?: "ltr" | "rtl";
  autoComplete?: string;
  form?: string;
  children?: React.ReactNode;
}

function Select({
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen,
  onOpenChange,
  disabled,
  required,
  name,
  form,
  children,
}: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState(defaultValue);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
    defaultOpen ?? false,
  );
  const value = valueProp !== undefined ? valueProp : uncontrolledValue;
  const open = openProp !== undefined ? openProp : uncontrolledOpen;

  const registryRef = React.useRef<Registry>({
    labels: new Map(),
    listeners: new Set(),
  });

  const setValue = React.useCallback(
    (next: string) => {
      if (valueProp === undefined) setUncontrolledValue(next);
      onValueChange?.(next);
    },
    [valueProp, onValueChange],
  );

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (disabled && next) return;
      if (openProp === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [disabled, openProp, onOpenChange],
  );

  const register = React.useCallback(
    (itemValue: string, node: React.ReactNode) => {
      const registry = registryRef.current;
      const text = nodeText(node);
      const existing = registry.labels.get(itemValue);
      registry.labels.set(itemValue, { node, text });
      if (!existing || existing.text !== text) {
        registry.listeners.forEach((listener) => listener());
      }
    },
    [],
  );

  const ctx = React.useMemo<SelectContextValue>(
    () => ({
      value,
      setValue,
      open,
      setOpen,
      disabled,
      registry: registryRef.current,
      register,
    }),
    [value, setValue, open, setOpen, disabled, register],
  );

  return (
    <SelectContext.Provider value={ctx}>
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen} modal>
        <span data-slot="select" className="contents">
          {children}
        </span>
      </PopoverPrimitive.Root>
      {name ? (
        <input
          type="hidden"
          name={name}
          value={value ?? ""}
          required={required}
          form={form}
          readOnly
        />
      ) : null}
    </SelectContext.Provider>
  );
}

function SelectGroup({ children, ...props }: React.ComponentProps<"div">) {
  const mode = React.useContext(ContentModeContext);
  if (mode === "collect") return <>{children}</>;
  return (
    <CommandPrimitive.Group data-slot="select-group" {...(props as object)}>
      {children}
    </CommandPrimitive.Group>
  );
}

interface SelectValueProps {
  placeholder?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

function SelectValue({ placeholder, children, className }: SelectValueProps) {
  const ctx = useSelectContext("SelectValue");
  const [, force] = React.useReducer((n: number) => n + 1, 0);

  // Subscribe before the (later-mounted) items register their labels.
  useIsomorphicLayoutEffect(() => {
    const listener = () => force();
    ctx.registry.listeners.add(listener);
    return () => {
      ctx.registry.listeners.delete(listener);
    };
  }, [ctx.registry]);

  const hasValue = ctx.value !== undefined && ctx.value !== "";
  const content = children
    ? children
    : hasValue
      ? (ctx.registry.labels.get(ctx.value as string)?.node ?? ctx.value)
      : placeholder;

  return (
    <span data-slot="select-value" className={className}>
      {content}
    </span>
  );
}

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button"> & { size?: "sm" | "default" }
>(({ className, size = "default", children, onKeyDown, ...props }, ref) => {
  const ctx = useSelectContext("SelectTrigger");
  const hasValue = ctx.value !== undefined && ctx.value !== "";
  return (
    <PopoverPrimitive.Trigger asChild>
      <button
        ref={ref}
        type="button"
        role="combobox"
        aria-expanded={ctx.open}
        aria-haspopup="listbox"
        disabled={ctx.disabled || props.disabled}
        data-slot="select-trigger"
        data-size={size}
        data-state={ctx.open ? "open" : "closed"}
        data-placeholder={hasValue ? undefined : ""}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            ctx.setOpen(true);
          }
        }}
        className={cn(
          "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:border-foreground/60 flex w-fit min-w-0 items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-left text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-10 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="size-4 opacity-50" />
      </button>
    </PopoverPrimitive.Trigger>
  );
});
SelectTrigger.displayName = "SelectTrigger";

interface SelectContentProps extends Omit<
  React.ComponentPropsWithoutRef<"div">,
  "dir"
> {
  position?: "popper" | "item-aligned";
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  /** Placeholder of the search box (default "Search…"). */
  searchPlaceholder?: string;
  /** Text shown when the search matches nothing (default "No results found"). */
  emptyText?: React.ReactNode;
  /** Adds a "+ Create …" row that receives the current search text. */
  createOption?: {
    label: (query: string) => React.ReactNode;
    onCreate: (query: string) => void;
  };
}

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  (
    {
      className,
      children,
      position: _position,
      align = "start",
      side = "bottom",
      sideOffset = 4,
      searchPlaceholder = "Search…",
      emptyText = "No results found",
      createOption,
      ...props
    },
    ref,
  ) => {
    const ctx = useSelectContext("SelectContent");
    const [query, setQuery] = React.useState("");

    React.useEffect(() => {
      if (!ctx.open) setQuery("");
    }, [ctx.open]);

    return (
      <>
        {/* Closed: register item labels without rendering them */}
        {!ctx.open ? (
          <ContentModeContext.Provider value="collect">
            {children}
          </ContentModeContext.Provider>
        ) : null}
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            ref={ref}
            data-slot="select-content"
            align={align}
            side={side}
            sideOffset={sideOffset}
            onOpenAutoFocus={(event) => event.preventDefault()}
            className={cn(
              "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 relative z-50 w-(--radix-popover-trigger-width) min-w-[12rem] overflow-hidden rounded-md border border-transparent p-0 shadow-lg",
              className,
            )}
            {...props}
          >
            <CommandPrimitive
              loop
              className="flex max-h-[min(22rem,var(--radix-popover-content-available-height))] flex-col"
            >
              <div className="border-border flex items-center gap-2 border-b px-3">
                <SearchIcon className="text-muted-foreground size-4 shrink-0" />
                <CommandPrimitive.Input
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="placeholder:text-muted-foreground h-10 w-full bg-transparent text-sm outline-none"
                />
              </div>
              <CommandPrimitive.List
                role="listbox"
                className="overflow-x-hidden overflow-y-auto p-1"
              >
                <CommandPrimitive.Empty className="text-muted-foreground py-5 text-center text-sm">
                  {emptyText}
                </CommandPrimitive.Empty>
                <ContentModeContext.Provider value="list">
                  {children}
                </ContentModeContext.Provider>
                {createOption ? (
                  <CommandPrimitive.Item
                    value={`__create__ ${query}`}
                    forceMount
                    onSelect={() => {
                      createOption.onCreate(query.trim());
                      ctx.setOpen(false);
                    }}
                    data-slot="select-create"
                    className="text-primary data-[selected=true]:bg-primary/10 flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium outline-hidden select-none"
                  >
                    <PlusIcon className="size-4" />
                    {createOption.label(query.trim())}
                  </CommandPrimitive.Item>
                ) : null}
              </CommandPrimitive.List>
            </CommandPrimitive>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </>
    );
  },
);
SelectContent.displayName = "SelectContent";

const SelectLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => {
  const mode = React.useContext(ContentModeContext);
  if (mode === "collect") return null;
  return (
    <div
      ref={ref}
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  );
});
SelectLabel.displayName = "SelectLabel";

interface SelectItemProps extends Omit<
  React.ComponentPropsWithoutRef<"div">,
  "onSelect"
> {
  value: string;
  disabled?: boolean;
  /** Extra words that should match this item in the search box. */
  keywords?: string[];
  textValue?: string;
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  (
    { className, children, value, disabled, keywords, textValue, ...props },
    ref,
  ) => {
    const ctx = useSelectContext("SelectItem");
    const mode = React.useContext(ContentModeContext);
    const { register } = ctx;

    useIsomorphicLayoutEffect(() => {
      register(value, children);
    });

    if (mode === "collect") return null;

    const selected = ctx.value === value;
    const label = textValue ?? nodeText(children);
    return (
      <CommandPrimitive.Item
        ref={ref}
        value={`${label} ${value}`}
        keywords={keywords}
        disabled={disabled}
        onSelect={() => {
          ctx.setValue(value);
          ctx.setOpen(false);
        }}
        data-slot="select-item"
        data-state={selected ? "checked" : "unchecked"}
        className={cn(
          "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-pointer items-center gap-2 rounded-sm py-2 pr-8 pl-3 text-[0.9375rem] outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[state=checked]:font-medium [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className,
        )}
        {...(props as object)}
      >
        <span className="absolute right-2 flex size-3.5 items-center justify-center">
          {selected ? <CheckIcon className="text-primary size-4" /> : null}
        </span>
        <span className="flex min-w-0 items-center gap-2">{children}</span>
      </CommandPrimitive.Item>
    );
  },
);
SelectItem.displayName = "SelectItem";

const SelectSeparator = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => {
  const mode = React.useContext(ContentModeContext);
  if (mode === "collect") return null;
  return (
    <CommandPrimitive.Separator
      ref={ref}
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...(props as object)}
    />
  );
});
SelectSeparator.displayName = "SelectSeparator";

/** Kept for API compatibility; the searchable list scrolls natively. */
function SelectScrollUpButton(_props: React.ComponentProps<"div">) {
  return null;
}

/** Kept for API compatibility; the searchable list scrolls natively. */
function SelectScrollDownButton(_props: React.ComponentProps<"div">) {
  return null;
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
