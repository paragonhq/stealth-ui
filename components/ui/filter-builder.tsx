"use client";
import { Menu } from "@base-ui/react/menu";
import { Select } from "@base-ui/react/select";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Check, ChevronDown, Plus, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */

export type FilterOption = { value: string; label: string; icon?: React.ReactNode };

export type FilterField = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  type: "option" | "text" | "number";
  /** The choices for an option field. */
  options?: FilterOption[];
  /** Shown before a number, e.g. "€". */
  unit?: string;
  placeholder?: string;
};

export type FilterRule = { id: string; field: string; operator: string; value: string | string[] | null };
export type FilterGroup = { conjunction: "and" | "or"; rules: FilterRule[] };

type Arity = "one" | "many" | "none";
type Operator = { value: string; label: string; arity: Arity };

export const OPERATORS: Record<FilterField["type"], Operator[]> = {
  option: [
    { value: "is", label: "is", arity: "one" },
    { value: "is_not", label: "is not", arity: "one" },
    { value: "any_of", label: "is any of", arity: "many" },
    { value: "none_of", label: "is none of", arity: "many" },
  ],
  text: [
    { value: "contains", label: "contains", arity: "one" },
    { value: "not_contains", label: "doesn’t contain", arity: "one" },
    { value: "is", label: "is", arity: "one" },
    { value: "starts_with", label: "starts with", arity: "one" },
    { value: "empty", label: "is empty", arity: "none" },
  ],
  number: [
    { value: "eq", label: "is", arity: "one" },
    { value: "gt", label: "is more than", arity: "one" },
    { value: "lt", label: "is less than", arity: "one" },
    { value: "gte", label: "is at least", arity: "one" },
    { value: "lte", label: "is at most", arity: "one" },
  ],
};

const operatorOf = (field: FilterField | undefined, op: string) => (field ? OPERATORS[field.type].find((o) => o.value === op) : undefined);

/** A rule is applied only once it has everything its operator needs. */
export function isRuleComplete(rule: FilterRule, fields: FilterField[]) {
  const field = fields.find((f) => f.key === rule.field);
  const op = operatorOf(field, rule.operator);
  if (!field || !op) return false;
  if (op.arity === "none") return true;
  if (op.arity === "many") return Array.isArray(rule.value) && rule.value.length > 0;
  if (typeof rule.value !== "string" || rule.value.trim() === "") return false;
  return field.type !== "number" || Number.isFinite(Number(rule.value));
}

/** Tests one record against the group. Incomplete rules are ignored; an empty group matches everything. */
export function matchesFilters(record: Record<string, unknown>, group: FilterGroup, fields: FilterField[]) {
  const rules = group.rules.filter((r) => isRuleComplete(r, fields));
  if (!rules.length) return true;
  const test = (rule: FilterRule) => {
    const field = fields.find((f) => f.key === rule.field)!;
    const raw = record[field.key];
    const v = rule.value;
    if (field.type === "number") {
      const a = Number(raw);
      const b = Number(v);
      return { eq: a === b, gt: a > b, lt: a < b, gte: a >= b, lte: a <= b }[rule.operator as "eq"] ?? false;
    }
    if (field.type === "text") {
      const a = String(raw ?? "").toLocaleLowerCase();
      const b = String(v ?? "").toLocaleLowerCase();
      return { contains: a.includes(b), not_contains: !a.includes(b), is: a === b, starts_with: a.startsWith(b), empty: a.trim() === "" }[rule.operator as "is"] ?? false;
    }
    const list = [v].flat();
    return { is: raw === v, is_not: raw !== v, any_of: list.includes(raw as string), none_of: !list.includes(raw as string) }[rule.operator as "is"] ?? false;
  };
  return group.conjunction === "and" ? rules.every(test) : rules.some(test);
}

/* ------------------------------------------------------------------ */
/* Builder                                                             */
/* ------------------------------------------------------------------ */

export type FilterBuilderProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  fields: FilterField[];
  value?: FilterGroup;
  defaultValue?: FilterGroup;
  onValueChange?: (group: FilterGroup) => void;
  /** Portal target for every popup. Defaults to document.body. */
  container?: HTMLElement | null;
};

export function FilterBuilder({ fields, value, defaultValue = { conjunction: "and", rules: [] }, onValueChange, container, className, ...rest }: FilterBuilderProps) {
  const reduce = !!useReducedMotion();
  const [group, setGroup] = useControllableState({ value, defaultValue, onChange: onValueChange });
  const [openValue, setOpenValue] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const added = useRef<string | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const counter = useRef(0);
  const baseId = useId();

  const fieldOf = (key: string) => fields.find((f) => f.key === key);
  const update = (id: string, patch: Partial<FilterRule>) => setGroup({ ...group, rules: group.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  const add = (key: string) => {
    const field = fieldOf(key);
    if (!field) return;
    const id = `${baseId}-${++counter.current}`;
    added.current = id;
    setGroup({ ...group, rules: [...group.rules, { id, field: key, operator: OPERATORS[field.type][0].value, value: null }] });
    setAnnounce(`Added a ${field.label} filter`);
  };

  const remove = (id: string) => {
    const index = group.rules.findIndex((r) => r.id === id);
    const next = group.rules.filter((r) => r.id !== id);
    const neighbor = next[Math.min(index, next.length - 1)];
    const owned = rootRef.current?.querySelector(`[data-rule="${CSS.escape(id)}"]`)?.contains(document.activeElement);
    if (owned) pendingFocus.current = neighbor?.id ?? "add";
    setGroup({ ...group, rules: next });
    const field = fieldOf(group.rules[index]?.field ?? "");
    setAnnounce(`Removed the ${field?.label ?? ""} filter`);
  };

  // Focus follows a removal to the row that slid up into its place, or to Add filter.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target === "add") return addRef.current?.focus();
    rootRef.current?.querySelector<HTMLElement>(`[data-rule="${CSS.escape(target)}"] [data-part=remove]`)?.focus();
  });

  const toggleConjunction = () => {
    const conjunction = group.conjunction === "and" ? "or" : "and";
    setGroup({ ...group, conjunction });
    setAnnounce(conjunction === "and" ? "Matching all filters" : "Matching any filter");
  };

  // After Add filter's menu closes, the new row's value is where the eye and focus go next.
  const valueElement = (id: string) => rootRef.current?.querySelector<HTMLElement>(`[data-rule="${CSS.escape(id)}"] [data-part=value]`) ?? null;

  const complete = group.rules.filter((r) => isRuleComplete(r, fields)).length;
  const incomplete = group.rules.length - complete;

  return (
    <div ref={rootRef} className={cn("flex min-w-0 flex-col", className)} {...rest}>
      <div role="group" aria-label="Filters" className="flex flex-col">
        <AnimatePresence initial={false}>
          {group.rules.length === 0 && (
            <motion.p
              key="empty"
              initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.14, ease: ease.out } }}
              transition={{ duration: 0.22, ease: ease.out }}
              className="overflow-hidden text-[12.5px] text-fg-3"
            >
              <span className="flex h-9 items-center pl-2">No filters yet. Add one to narrow the list.</span>
            </motion.p>
          )}
          {group.rules.map((rule, index) => (
            <motion.div
              key={rule.id}
              data-rule={rule.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, height: 0, transition: { duration: 0.16, ease: ease.out } }}
              transition={reduce ? { duration: 0.14 } : { duration: 0.24, ease: ease.out }}
              // Clips while the height animates; the side padding keeps focus rings inside the clip.
              className="-mx-1 overflow-hidden px-1"
            >
              <Row
                rule={rule}
                index={index}
                fields={fields}
                conjunction={group.conjunction}
                onConjunction={toggleConjunction}
                onChange={(patch) => update(rule.id, patch)}
                onRemove={() => remove(rule.id)}
                valueOpen={openValue === rule.id}
                onValueOpenChange={(o) => setOpenValue(o ? rule.id : null)}
                container={container}
                reduce={reduce}
                complete={isRuleComplete(rule, fields)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-1.5 flex h-8 items-center justify-between gap-2">
        <Menu.Root
          onOpenChange={(open) => {
            if (open) added.current = null;
          }}
          onOpenChangeComplete={(open) => {
            const id = added.current;
            if (open || !id) return;
            added.current = null;
            // Hand over to the new row: options open their list, text and numbers take the caret.
            valueElement(id)?.focus();
            const rule = group.rules.find((r) => r.id === id);
            if (rule && fieldOf(rule.field)?.type === "option") setOpenValue(id);
          }}
        >
          <Menu.Trigger ref={addRef} className={cn(ghost, "gap-1.5 pr-2.5 pl-2 text-fg-2")}>
            <Plus size={14} />
            Add filter
          </Menu.Trigger>
          <Menu.Portal container={container}>
            <Menu.Positioner align="start" sideOffset={6} collisionPadding={8} className="z-(--z-popover) outline-none">
              <Menu.Popup
                finalFocus={() => !added.current}
                className={cn(popupClass, "min-w-44 p-1")}
              >
                <p className="px-2 pt-1 pb-1.5 font-mono text-2xs tracking-[0.08em] text-fg-4 uppercase">Filter by</p>
                {fields.map((f) => (
                  <Menu.Item key={f.key} onClick={() => add(f.key)} className={itemClass}>
                    {f.icon && <span className="flex shrink-0 text-fg-3 [&_svg]:size-3.5">{f.icon}</span>}
                    <span className="truncate">{f.label}</span>
                  </Menu.Item>
                ))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>

        <div className="flex min-w-0 items-center gap-2">
          <AnimatePresence initial={false}>
            {incomplete > 0 && (
              <motion.span
                key="incomplete"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                className="truncate text-[12px] text-fg-4"
              >
                {incomplete === 1 ? "1 filter needs a value" : `${incomplete} filters need a value`}
              </motion.span>
            )}
          </AnimatePresence>
          {group.rules.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setGroup({ ...group, rules: [] });
                addRef.current?.focus();
                setAnnounce("Cleared all filters");
              }}
              className={cn(ghost, "px-2 text-fg-3")}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

type RowProps = {
  rule: FilterRule;
  index: number;
  fields: FilterField[];
  conjunction: "and" | "or";
  onConjunction: () => void;
  onChange: (patch: Partial<FilterRule>) => void;
  onRemove: () => void;
  valueOpen: boolean;
  onValueOpenChange: (open: boolean) => void;
  container?: HTMLElement | null;
  reduce: boolean;
  complete: boolean;
};

function Row({ rule, index, fields, conjunction, onConjunction, onChange, onRemove, valueOpen, onValueOpenChange, container, reduce, complete }: RowProps) {
  const field = fields.find((f) => f.key === rule.field);
  const ops = field ? OPERATORS[field.type] : [];
  const op = operatorOf(field, rule.operator);

  const changeField = (key: string) => {
    const next = fields.find((f) => f.key === key);
    if (!next || key === rule.field) return;
    // A new field keeps its operator only when the new type has one with the same meaning.
    const same = next.type === field?.type ? rule.operator : OPERATORS[next.type][0].value;
    onChange({ field: key, operator: same, value: next.type === field?.type && next.type !== "option" ? rule.value : null });
  };

  const changeOperator = (value: string) => {
    const nextOp = ops.find((o) => o.value === value);
    if (!nextOp) return;
    // Carry the value across when the arity changes: one becomes a list of one, a list keeps its first.
    let v = rule.value;
    if (nextOp.arity === "many") v = v == null ? null : [v].flat();
    else if (nextOp.arity === "one") v = Array.isArray(v) ? (v[0] ?? null) : v;
    else v = null;
    onChange({ operator: value, value: v });
  };

  return (
    <div data-complete={complete || undefined} className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-start gap-x-1.5 py-[3px]">
      <div className="flex h-7 items-center">
        {index === 0 ? (
          <span className="pl-2 text-[12.5px] text-fg-3">Where</span>
        ) : (
          <button
            type="button"
            onClick={onConjunction}
            aria-label={conjunction === "and" ? "Match all filters. Switch to any." : "Match any filter. Switch to all."}
            className={cn(ghost, "relative w-full justify-start overflow-hidden pr-1 pl-2 text-fg-2")}
          >
            <span className="relative grid h-4 overflow-hidden">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={conjunction}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
                  // Each row's word rolls a beat after the one above, so the change reads down the list.
                  transition={reduce ? { duration: 0.12 } : { ...spring.snappy, delay: (index - 1) * 0.03 }}
                  className="leading-4"
                >
                  {conjunction}
                </motion.span>
              </AnimatePresence>
            </span>
            <ChevronDown size={12} className="ml-0.5 shrink-0 text-fg-4" />
          </button>
        )}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Segment
          label="Field"
          value={rule.field}
          items={fields.map((f) => ({ value: f.key, label: f.label, icon: f.icon }))}
          onValueChange={(v) => v && changeField(v)}
          container={container}
          reduce={reduce}
          variant="field"
        />
        {field && (
          <Segment
            label="Operator"
            value={rule.operator}
            items={ops.map((o) => ({ value: o.value, label: o.label }))}
            onValueChange={(v) => v && changeOperator(v)}
            container={container}
            reduce={reduce}
            variant="operator"
          />
        )}
        {field && op && op.arity !== "none" && (
          <ValueControl
            field={field}
            arity={op.arity}
            value={rule.value}
            onChange={(v) => onChange({ value: v })}
            open={valueOpen}
            onOpenChange={onValueOpenChange}
            container={container}
            reduce={reduce}
          />
        )}
      </div>

      <button
        type="button"
        data-part="remove"
        aria-label={`Remove ${field?.label ?? "this"} filter`}
        onClick={onRemove}
        className={cn(ghost, "relative w-7 justify-center text-fg-3 active:scale-[0.9] pointer-coarse:after:-inset-2")}
      >
        <X size={14} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Segments                                                            */
/* ------------------------------------------------------------------ */

type SegmentProps = {
  label: string;
  value: string | null;
  items: FilterOption[];
  onValueChange: (value: string | null) => void;
  container?: HTMLElement | null;
  reduce: boolean;
  variant: "field" | "operator" | "value";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
};

function Segment({ label, value, items, onValueChange, container, reduce, variant, open, onOpenChange, placeholder = "Select…" }: SegmentProps) {
  const current = items.find((i) => i.value === value);
  return (
    <Select.Root
      items={items}
      value={value}
      onValueChange={(v) => onValueChange(v as string | null)}
      open={open}
      onOpenChange={onOpenChange ? (o) => onOpenChange(o) : undefined}
    >
      <Select.Trigger
        aria-label={label}
        data-part={variant === "value" ? "value" : undefined}
        className={cn(triggerClass(variant), !current && "border-dashed text-fg-4")}
      >
        {current?.icon && <span className="flex shrink-0 text-fg-3 [&_svg]:size-3.5">{current.icon}</span>}
        <SwapText text={current?.label ?? placeholder} reduce={reduce} />
        {variant !== "operator" && <ChevronDown size={12} className="shrink-0 text-fg-4" />}
      </Select.Trigger>
      <Popup container={container} reduce={reduce}>
        {items.map((item) => (
          <Select.Item key={item.value} value={item.value} className={itemClass}>
            {item.icon && <span className="flex shrink-0 text-fg-3 [&_svg]:size-3.5">{item.icon}</span>}
            <Select.ItemText className="min-w-0 flex-1 truncate">{item.label}</Select.ItemText>
            <Select.ItemIndicator className="flex shrink-0 text-fg-2">
              <Check size={14} />
            </Select.ItemIndicator>
          </Select.Item>
        ))}
      </Popup>
    </Select.Root>
  );
}

type ValueControlProps = {
  field: FilterField;
  arity: "one" | "many";
  value: string | string[] | null;
  onChange: (value: string | string[] | null) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container?: HTMLElement | null;
  reduce: boolean;
};

function ValueControl({ field, arity, value, onChange, open, onOpenChange, container, reduce }: ValueControlProps) {
  const options = field.options ?? [];
  if (field.type === "option" && arity === "one") {
    return (
      <Segment
        label={`${field.label} value`}
        value={typeof value === "string" ? value : null}
        items={options}
        onValueChange={onChange}
        open={open}
        onOpenChange={onOpenChange}
        container={container}
        reduce={reduce}
        variant="value"
        placeholder={field.placeholder}
      />
    );
  }

  if (field.type === "option") {
    const list = Array.isArray(value) ? value : [];
    const labels = options.filter((o) => list.includes(o.value)).map((o) => o.label);
    const text = labels.length === 0 ? (field.placeholder ?? "Select…") : labels.length <= 2 ? labels.join(", ") : `${labels[0]} +${labels.length - 1}`;
    return (
      <Select.Root<string, true> multiple items={options} value={list} onValueChange={(v) => onChange(v.length ? v : null)} open={open} onOpenChange={(o) => onOpenChange(o)}>
        <Select.Trigger aria-label={`${field.label} values`} data-part="value" className={cn(triggerClass("value"), !labels.length && "border-dashed text-fg-4")}>
          <SwapText text={text} reduce={reduce} />
          <ChevronDown size={12} className="shrink-0 text-fg-4" />
        </Select.Trigger>
        <Popup container={container} reduce={reduce}>
          {options.map((item) => (
            <Select.Item key={item.value} value={item.value} className={itemClass}>
              <Box on={list.includes(item.value)} reduce={reduce} />
              {item.icon && <span className="flex shrink-0 text-fg-3 [&_svg]:size-3.5">{item.icon}</span>}
              <Select.ItemText className="min-w-0 flex-1 truncate">{item.label}</Select.ItemText>
            </Select.Item>
          ))}
        </Popup>
      </Select.Root>
    );
  }

  const number = field.type === "number";
  return (
    <label
      data-invalid={number && typeof value === "string" && value !== "" && !Number.isFinite(Number(value)) ? "" : undefined}
      className={cn(
        "flex h-7 min-w-0 items-center gap-1 rounded-md border border-line-2 bg-raised px-2 text-[12.5px] shadow-[var(--shadow)]",
        "transition-[border-color,box-shadow] duration-150 hover:border-fg-4 focus-within:border-fg-4 focus-within:ring-2 focus-within:ring-fg/10",
        "data-invalid:border-danger/70",
        number ? "w-28" : "w-40 max-w-full",
      )}
    >
      <span className="sr-only">{field.label} value</span>
      {number && field.unit && <span aria-hidden className="shrink-0 text-fg-3">{field.unit}</span>}
      <input
        data-part="value"
        type="text"
        inputMode={number ? "decimal" : "text"}
        enterKeyHint="done"
        autoComplete="off"
        spellCheck={false}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        placeholder={field.placeholder ?? (number ? "0" : "Type a value")}
        className={cn("h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[12.5px]", number && "tabular")}
      />
    </label>
  );
}

// A label that swaps inside its own box: the old word lifts out as the new one settles in.
function SwapText({ text, reduce }: { text: string; reduce: boolean }) {
  return (
    <span className="grid min-w-0 overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={text}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)", transition: { duration: 0.12 } }}
          transition={{ duration: reduce ? 0.12 : 0.2, ease: ease.out }}
          className="col-start-1 row-start-1 truncate"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Popup({ children, container, reduce }: { children: React.ReactNode; container?: HTMLElement | null; reduce: boolean }) {
  const { setList, y, height, opacity } = useGlide(reduce);
  return (
    <Select.Portal container={container}>
      <Select.Positioner alignItemWithTrigger={false} align="start" sideOffset={6} collisionPadding={8} className="z-(--z-popover) outline-none select-none">
        <Select.Popup className={cn(popupClass, "min-w-(--anchor-width)")}>
          <Select.List ref={setList} className="relative max-h-[min(var(--available-height),16rem)] min-w-40 overflow-y-auto overscroll-contain p-1 outline-none">
            <motion.div aria-hidden style={{ y, height, opacity }} className="pointer-events-none absolute inset-x-1 top-0 rounded-lg bg-line" />
            {children}
          </Select.List>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  );
}

function Box({ on, reduce }: { on: boolean; reduce: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-3.5 shrink-0 place-items-center rounded-[4px] border transition-[background-color,border-color,scale] duration-150 ease-out group-active/item:scale-[0.85]",
        on ? "border-fg bg-fg text-frame" : "border-line-2 bg-frame group-data-highlighted/item:border-fg-4",
      )}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <motion.path
          d="M2 5.2 4.1 7.2 8 2.8"
          initial={false}
          animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { pathLength: { duration: 0.2, ease: ease.out }, opacity: { duration: 0.05 } }}
        />
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const focusRing = "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3";

const ghost = cn(
  "inline-flex h-7 shrink-0 items-center rounded-md text-[12.5px] font-medium whitespace-nowrap select-none",
  focusRing,
  "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.96] active:duration-75 data-popup-open:bg-hover data-popup-open:text-fg",
);

const triggerClass = (variant: "field" | "operator" | "value") =>
  cn(
    "relative inline-flex h-7 max-w-full min-w-0 shrink items-center gap-1.5 rounded-md text-[12.5px] select-none",
    focusRing,
    "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
    "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2",
    // The operator reads as a word in the sentence; field and value read as the things being compared.
    variant === "operator"
      ? "px-1.5 text-fg-2 hover:bg-hover hover:text-fg data-popup-open:bg-hover data-popup-open:text-fg"
      : "border border-line-2 bg-raised pr-1.5 pl-2 text-fg shadow-[var(--shadow)] hover:border-fg-4 data-popup-open:border-fg-4",
    variant === "field" && "font-medium",
    variant === "value" && "max-w-[14rem]",
  );

const popupClass = cn(
  "origin-(--transform-origin) overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
  "transition-[opacity,scale] duration-160 ease-out-expo data-ending-style:duration-100 data-ending-style:ease-out",
  "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
  "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
);

const itemClass = cn(
  "group/item relative z-[1] flex h-8 cursor-default scroll-my-1 items-center gap-2.5 rounded-lg px-2 text-[13px] text-fg outline-none select-none pointer-coarse:h-10",
  "data-highlighted:bg-line data-disabled:text-fg-4 [[data-glide]_&]:data-highlighted:bg-transparent",
);

// One highlight for a list: glides after the pointer, jumps for arrow keys.
function useGlide(reduce: boolean) {
  const [list, setList] = useState<HTMLDivElement | null>(null);
  const y = useMotionValue(0);
  const height = useMotionValue(32);
  const opacity = useMotionValue(0);

  useEffect(() => {
    if (!list) return;
    list.setAttribute("data-glide", "");
    let keyboard = false;
    let shown = false;
    let running: AnimationPlaybackControls[] = [];
    const stop = () => {
      running.forEach((c) => c.stop());
      running = [];
    };
    const place = () => {
      const el = list.querySelector<HTMLElement>("[data-highlighted]");
      stop();
      if (!el) {
        shown = false;
        running.push(animate(opacity, 0, { duration: reduce ? 0 : 0.12 }));
        return;
      }
      if (!shown || keyboard || reduce) {
        y.jump(el.offsetTop);
        height.jump(el.offsetHeight);
        opacity.jump(1);
      } else {
        running.push(animate(y, el.offsetTop, spring.follow), animate(height, el.offsetHeight, spring.follow));
        opacity.jump(1);
      }
      shown = true;
    };
    const onKey = () => (keyboard = true);
    const onPointer = () => (keyboard = false);
    const observer = new MutationObserver(place);
    observer.observe(list, { subtree: true, attributes: true, attributeFilter: ["data-highlighted"] });
    document.addEventListener("keydown", onKey, true);
    list.addEventListener("pointermove", onPointer);
    place();
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKey, true);
      list.removeEventListener("pointermove", onPointer);
      stop();
    };
  }, [list, reduce, y, height, opacity]);

  return { setList, y, height, opacity };
}
