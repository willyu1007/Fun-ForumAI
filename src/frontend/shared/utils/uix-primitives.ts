const UIX_PRIMITIVE_CLASS_MAP = {
  buttonBase:
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  buttonVariantDefault: 'bg-primary text-primary-foreground hover:bg-primary/90',
  buttonVariantDestructive:
    'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
  buttonVariantOutline:
    'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
  buttonVariantSecondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  buttonVariantGhost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
  buttonVariantLink: 'text-primary underline-offset-4 hover:underline',
  buttonSizeDefault: 'h-9 px-4 py-2 has-[>svg]:px-3',
  buttonSizeXs:
    "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
  buttonSizeSm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
  buttonSizeLg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
  buttonSizeIcon: 'size-9',
  buttonSizeIconXs: "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
  buttonSizeIconSm: 'size-8',
  buttonSizeIconLg: 'size-10',
  badgeBase:
    'inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  badgeVariantDefault: 'bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
  badgeVariantSecondary: 'bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
  badgeVariantDestructive:
    'bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
  badgeVariantOutline:
    'border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
  badgeVariantGhost: '[a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
  badgeVariantLink: 'text-primary underline-offset-4 [a&]:hover:underline',
  tabsRoot: 'group/tabs flex gap-2 data-[orientation=horizontal]:flex-col',
  tabsListBase:
    'rounded-lg p-[3px] group-data-[orientation=horizontal]/tabs:h-9 data-[variant=line]:rounded-none group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col',
  tabsListVariantDefault: 'bg-muted',
  tabsListVariantLine: 'gap-1 bg-transparent',
  tabsTriggerBase:
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  tabsTriggerLineVariant:
    'group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent',
  tabsTriggerActive:
    'data-[state=active]:bg-background dark:data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 data-[state=active]:text-foreground',
  tabsTriggerIndicator:
    'after:bg-foreground after:absolute after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100',
  tabsContent: 'flex-1 outline-none',
  toggleBase:
    "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap",
  toggleVariantDefault: 'bg-transparent',
  toggleVariantOutline:
    'border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground',
  toggleSizeDefault: 'h-9 px-2 min-w-9',
  toggleSizeSm: 'h-8 px-1.5 min-w-8',
  toggleSizeLg: 'h-10 px-2.5 min-w-10',
} as const

export type UixPrimitiveKey = keyof typeof UIX_PRIMITIVE_CLASS_MAP

export function uixPrimitive(key: UixPrimitiveKey): string {
  return UIX_PRIMITIVE_CLASS_MAP[key]
}
