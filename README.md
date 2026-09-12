# smart-naive-table

English | [简体中文](./README.zh-CN.md)

A columns-driven pro table for **Vue 3 + Naive UI**. One `columns` array drives the search form, dict-based cell rendering, and the column-settings panel; one `fetcher` function adapts any backend. Everything is progressive — ignore a feature and it stays out of your way.

![basic](https://raw.githubusercontent.com/SmartCode-X/smart-naive-table/main/assets/basic-light.png)

## Features

- **Columns drive everything** — declare `search` on a column and it becomes a search field; declare `options` and both the cell translation and the search select share one dict.
- **One-function backend contract** — `(params: {page, pageSize, ...search}) => Promise<{items, total}>`. Map any request/response shape inside your fetcher; nothing else to configure.
- **Column settings with persistence** — show/hide, drag to reorder, pin left/right; persisted to `localStorage` per `storage-key` and merged safely when your column definitions evolve.
- **Density toggle** — comfortable / compact, follows the host Naive UI theme (only minimal layout CSS shipped).
- **Race-guarded requests** — out-of-order responses from fast page flips are discarded.
- **Locale-reactive text** — column titles / labels accept `() => string`; switch language and every cell, title, and button updates instantly. Component chrome text comes from a `labels` prop (English defaults built in).
- **Declarative formats** — `format: 'date' | 'datetime' | 'money'` or a custom function.
- **Async dicts** — `options: () => Promise<...>` with loading state, in-flight dedup, and `reloadOptions()`.
- **Server-side sorting** — `sorter: true` on a column feeds `{ sortField, sortOrder }` into the fetcher params.
- **Row drag-to-reorder** — `row-draggable` reorders the rows and emits the new order; the host persists it.
- **Global defaults** — `provide` labels / alignment / page sizes once at the app root; every table inherits.
- **`useProTable` / `useTableCrud`** — the UI-agnostic data core and an optional CRUD dialog state machine, exported separately.
- One runtime dependency: `sortablejs`, lazy-loaded only when row dragging is enabled. Peers: `vue ^3.3`, `naive-ui ^2.34`. ESM only.

## Install

```bash
npm i smart-naive-table
```

## Quick start

```vue
<script setup lang="ts">
import { ProTable, type ProTableColumn } from 'smart-naive-table'

interface User { id: number; account: string; name: string; enabled: boolean; createTime: string }

const columns: ProTableColumn<User>[] = [
  { type: 'index' },
  { key: 'account', title: 'Account', search: true },
  { key: 'name', title: 'Name', search: true },
  {
    key: 'enabled', title: 'Status', tag: true, search: true,
    options: [
      { label: 'Enabled', value: true, tagType: 'success' },
      { label: 'Disabled', value: false },
    ],
  },
  { key: 'createTime', title: 'Created', format: 'datetime' },
]

// the only backend contract — adapt any API here
async function fetcher({ page, pageSize, ...query }) {
  const res = await fetch(`/api/users?page=${page}&size=${pageSize}&...`).then(r => r.json())
  return { items: res.list, total: res.total }
}
</script>

<template>
  <ProTable :columns="columns" :fetcher="fetcher" storage-key="users" />
</template>
```

Must be rendered inside your app's `<n-config-provider>` — the table follows its theme, locale and density tokens.

## Column definition

Data columns extend Naive UI's column props (`width`, `minWidth`, `fixed`, `align`, `ellipsis`, `sorter`, ... all pass through) plus:

| Field | Type | Description |
|---|---|---|
| `key` | `string` | Row field; also the default search param name, settings id, and `#cell-{key}` slot name. Required. |
| `title` | `string \| () => VNodeChild` | Function form is evaluated at render time — locale switches update instantly. |
| `render` | `(row, rowIndex) => VNodeChild` | Custom cell. Highest priority. |
| `format` | `'date' \| 'datetime' \| 'money' \| (value, row) => string` | Declarative formatting. |
| `options` | `Option[] \| Ref<Option[]> \| () => Promise<Option[]>` | Dict: cell translation + search select options from one declaration. |
| `tag` | `boolean` | Render the translated value as an `NTag` (type from the matched option's `tagType`). |
| `hide` | `boolean` | Initially hidden; can be re-enabled in column settings. |
| `hideInTable` | `boolean` | Search-only field, never rendered as a column. |
| `hideInSetting` | `boolean` | Rendered, but not listed in column settings (typical: actions column). |
| `search` | `boolean \| SearchConfig` | `true` = defaults (`select` when the column has `options`, else `input`). |
| `children` | `ProTableDataColumn[]` | Multi-level headers. |

Special columns: `{ type: 'selection' | 'expand' | 'index', ... }` — explicit types, no magic keys. An actions column is just a normal column with `render` + `fixed: 'right'` + `hideInSetting: true`.

`SearchConfig`: `type` (`input | number | select | date | daterange | switch`), `key` (param name override), `label`, `placeholder`, `defaultValue`, `order`, `span`, `props` (passed to the Naive control), `render` (fully custom control).

Cell priority: `render` → `#cell-{key}` slot → `options` translation (+`tag`) → `format` → raw value.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `columns` | `ProTableColumn<T>[]` | — | required |
| `fetcher` | `(params) => Promise<{items, total}>` | — | remote mode |
| `data` | `T[]` | — | static mode (client-side pagination) |
| `row-key` | `string \| (row) => key` | `'id'` | |
| `params` | `object` | — | extra request params; deep-watched → back to page 1 & reload |
| `immediate` | `boolean` | `true` | fetch on mount |
| `default-page-size` | `number` | `10` | |
| `pagination` | `false \| PaginationProps` | — | merged over built-in defaults |
| `search` | `false \| { layout, cols, labelPlacement, labelWidth, collapsible, collapsedRows }` | — | `false` hides the search card; `layout: 'inline'` = no card, single wrapping row (fits narrow / master-detail columns); `collapsible` see [Search collapse](#search-collapse) |
| `toolbar` | `false \| { refresh, density, columnSettings }` | all on | |
| `title` | `string` | — | or use the `#title` slot |
| `storage-key` | `string` | — | enables localStorage persistence of column settings + density |
| `default-density` | `'comfortable' \| 'compact'` | global default | |
| `labels` | `Partial<ProTableLabels>` | global default / English | pass a `computed` for locale reactivity |
| `active-row-key` | `string \| number \| null` | — | highlights the matching row with `.pro-table-row--active` (compared via `row-key`); pair with `@row-click` for master-detail selection |
| `row-draggable` | `boolean` | `false` | drag-to-reorder rows (sortablejs, lazy-loaded); emits `row-drag-sort`, host persists |
| `drag-handle` | `string` | — | CSS selector for the drag handle (e.g. `.drag-handle`); whole row draggable if omitted |

Anything else (e.g. `striped`, `max-height`, `checked-row-keys`, `virtual-scroll`) is forwarded to `n-data-table`.

**Events**: `search(cleanedParams)`, `reset()`, `loaded(rows, total)`, `error(err)`, `row-click(row, index)`, `row-drag-sort({ from, to, reordered })` — the component never shows message UI itself; handle `@error` in the host.

**Slots**: `#title`, `#toolbar` (left side), `#toolbar-right` (right side, before built-in buttons), `#cell-{key}` (`{ row, index }`), `#header-{key}` (`{ column }`, custom column header), `#empty` (no data), `#pagination-prefix` (left of pagination, e.g. batch info).

**Instance** (template ref): `refresh()`, `search()`, `reset()`, `loading`, `rows`, `params`, `pagination`, `reloadOptions(key?)`, `tableRef` (the raw `NDataTable` instance).

## Global defaults (provide/inject)

Tired of passing the same `labels` / `align` / `page-sizes` everywhere? `provide` them once at the host root — every ProTable inherits. Precedence is always **instance prop / explicit column value > global default > built-in fallback**.

```ts
// main.ts
import { createProTableDefaults, PRO_TABLE_DEFAULTS } from 'smart-naive-table'
import { computed } from 'vue'

app.provide(
  PRO_TABLE_DEFAULTS,
  createProTableDefaults({
    align: 'left',                 // cells default to left (built-in fallback 'center')
    pageSizes: [10, 20, 50, 100],
    emptyText: '-',
    // labels as a ref/getter → locale-reactive; pages don't need to pass :labels
    labels: computed(() => ({ search: t('common.search'), reset: t('common.reset') /* ... */ })),
  }),
)
```

Injectable fields: `align` / `titleAlign` / `emptyText` / `tag` / `pageSizes` / `showSizePicker` / `fixedFallbackWidth` / `indexWidth` / `density` / `dateValueFormat` / `searchCols` / `activeRowBg` / `labels`.

## Tree / expandable rows

Tree rows = **static data mode**: give rows a `children` field and a `row-key`; Naive renders them as an expandable tree natively. Column settings, density and the toolbar all keep working.

```vue
<ProTable :columns="columns" :data="tree" row-key="id" :pagination="false" default-expand-all />
```

For a single expandable detail row use the special column `{ type: 'expand', renderExpand: (row) => h(...) }`.

## Sorting (wired into the fetcher)

Mark a column `sorter: true` (Naive-native); clicking the header feeds the sort into the fetcher params for server-side sorting:

```ts
const columns = [{ key: 'createTime', title: 'Created', sorter: true }]
// fetcher receives { page, pageSize, ...search, sortField: 'createTime', sortOrder: 'asc' | 'desc' }
// no keys when unsorted; the api layer maps them to backend fields (like page → Current).
```

The arrow is controlled, and changing the sort returns to page 1. Multi-column sort is not built in (single is enough for most admin tables).

## Search collapse

Collapse the search area when there are many fields (`layout: 'grid'` only):

```vue
<ProTable :search="{ collapsible: true, collapsedRows: 1 }" ... />
```

Fields beyond `collapsedRows` rows collapse, with an expand/collapse toggle (text from labels `expand`/`collapse`).

## Row drag-to-reorder

```vue
<ProTable row-draggable drag-handle=".drag-handle"
  @row-drag-sort="(e) => api.reorder(e.reordered.map(r => r.id)).then(() => tableRef.refresh())" />
```

Backed by **sortablejs** (the only runtime dependency, lazy-loaded — zero extra bytes for tables that don't drag). The package only reorders the reactive row array and emits `{ from, to, reordered }`; **the host persists** (call your reorder api, then `refresh()`). Under remote pagination only the current page's visible rows are reordered.

## Passthrough capabilities (attrs / column fields, no extra API)

These work through `n-data-table` props or column fields:

- **Column resize**: column `resizable: true`.
- **Virtual scroll** (thousands of rows, no pagination): `:virtual-scroll` + `max-height` (the auto `scroll-x` still applies).
- **Footer summary row**: `:summary="(pageData) => ...)"`.
- **Merged cells**: Naive `rowSpan` / `colSpan` in a column render.
- **Cross-page selection**: host holds and passes back `checked-row-keys`.

## i18n

```ts
const labels = computed<Partial<ProTableLabels>>(() => ({
  search: t('common.search'),
  reset: t('common.reset'),
  // ...refresh, density, columnSettings, ...
}))
```

Column titles / option labels use the function form: `title: () => t('user.account')`. Both are evaluated during render, so switching locale re-renders everything — no refresh API needed.

## useProTable / useTableCrud

```ts
import { useProTable, useTableCrud } from 'smart-naive-table'

// the UI-agnostic core the component itself uses: loading/rows/params/pagination,
// race guard, search/reset/onPage/onPageSize
const { loading, rows, params, pagination, search, reset } = useProTable(fetcher, { initParams: {} })

// optional CRUD dialog state machine
const crud = useTableCrud({
  form: () => ({ name: '' }),
  create: api.create, update: api.update, remove: api.remove,
  onSuccess: () => tableRef.value?.refresh(),
})
```

## Behavior notes

- Search params are cleaned before each request: strings are trimmed, empty strings / `null` / `undefined` / empty arrays dropped, **`false` and `0` kept**.
- Reset assigns `defaultValue ?? null` (never `undefined` — Naive controls would fall back to stale uncontrolled values).
- A `fixed` column without `width` gets `minWidth ?? 120` (Naive fixed columns need a concrete width; the fallback is configurable via the global `fixedFallbackWidth`).
- `scroll-x` defaults to the sum of visible column widths; pass your own to override.
- Stored column settings are version-checked and merged: removed columns dropped, new columns inserted at their declared position.

## License

Apache-2.0
