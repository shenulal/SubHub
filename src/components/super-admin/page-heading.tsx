// src/components/super-admin/page-heading.tsx
/** Control Panel page title row (title, subtitle, optional actions). */
export function PageHeading({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1">
        {eyebrow}
        <h1 className="text-foreground truncate text-2xl font-medium">
          {title}
        </h1>
        {subtitle && (
          <p className="text-muted-foreground text-[0.9375rem]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
