<script setup lang="ts" generic="T">
// 唯一胶水层:useProTable(数据)+ useOptions(字典)+ useColumns(列/设置)组装。
// props 用运行时声明 + PropType:泛型 + 复杂导入类型下比纯类型声明稳。
import { computed, toValue, useAttrs, useSlots, watch, type PropType, type Slots, type VNodeChild } from 'vue'
import { NCard, NDataTable } from 'naive-ui'
import type { DataTableInst, PaginationInfo, PaginationProps } from 'naive-ui'
import type {
  Density,
  ProTableColumn,
  ProTableDataColumn,
  ProTableFetcher,
  ProTableLabels,
  SearchFormConfig,
  ToolbarConfig,
} from './types'
import { cleanParams, useProTable } from './useProTable'
import { useOptions } from './useOptions'
import {
  deriveInitParams,
  deriveOptionsSources,
  deriveSearchDefs,
  useColumns,
} from './useColumns'
import { mergeLabels } from './labels'
import { useProTableDefaults } from './config'
import SearchForm from './SearchForm.vue'
import Toolbar from './Toolbar.vue'
import ColumnSettings from './ColumnSettings.vue'
import { ref } from 'vue'
import { useRowDrag } from './useRowDrag'

defineOptions({ name: 'ProTable', inheritAttrs: false })

const props = defineProps({
  columns: { type: Array as PropType<ProTableColumn<T>[]>, required: true },
  fetcher: { type: Function as PropType<ProTableFetcher<T>>, default: undefined },
  data: { type: Array as PropType<T[]>, default: undefined },
  rowKey: { type: [String, Function] as PropType<string | ((row: T) => string | number)>, default: 'id' },
  params: { type: Object as PropType<Record<string, any>>, default: undefined },
  immediate: { type: Boolean, default: true },
  defaultPageSize: { type: Number, default: 10 },
  pagination: { type: [Boolean, Object] as PropType<false | Partial<PaginationProps>>, default: undefined },
  search: { type: [Boolean, Object] as PropType<false | SearchFormConfig>, default: undefined },
  toolbar: { type: [Boolean, Object] as PropType<false | ToolbarConfig>, default: undefined },
  title: { type: String, default: undefined },
  storageKey: { type: String, default: undefined },
  defaultDensity: { type: String as PropType<Density>, default: undefined },
  labels: { type: Object as PropType<Partial<ProTableLabels>>, default: undefined },
  activeRowKey: { type: [String, Number] as PropType<string | number | null>, default: undefined },
  rowDraggable: { type: Boolean, default: false },
  dragHandle: { type: String, default: undefined },
})

const emit = defineEmits<{
  search: [params: Record<string, any>]
  reset: []
  loaded: [rows: T[], total: number]
  error: [err: unknown]
  rowClick: [row: T, index: number]
  rowDragSort: [e: { from: number; to: number; reordered: T[] }]
}>()

// 仅声明插槽类型(对外):cell-* / header-* 是按列 key 动态读取的,模板里没有对应 <slot>,
// 不声明的话宿主写 #cell-name 会被 vue-tsc / Volar 报「插槽不存在」。
defineSlots<{
  title?: () => VNodeChild
  /** 工具栏左侧 */
  toolbar?: () => VNodeChild
  /** 工具栏右侧,内置按钮之前 */
  'toolbar-right'?: () => VNodeChild
  empty?: () => VNodeChild
  /** 分页栏左侧 */
  'pagination-prefix'?: (info: PaginationInfo) => VNodeChild
  /** 自定义单元格:#cell-{列 key} */
  [cell: `cell-${string}`]: ((props: { row: T; index: number }) => VNodeChild) | undefined
  /** 自定义表头:#header-{列 key} */
  [header: `header-${string}`]: ((props: { column: ProTableDataColumn<T> }) => VNodeChild) | undefined
}>()

// 显式标注:slots 进入 useColumns 又参与 expose 类型,dts 生成会因自引用推断报 TS7022
const slots: Slots = useSlots()
const attrs = useAttrs()

const defaults = useProTableDefaults()

const isRemote = computed(() => !!props.fetcher)
// 三层合并:内置 < 全局默认(defaults.labels,渲染期 toValue 解引用保持 locale 响应)< 实例 prop
const mergedLabels = computed(() => mergeLabels(props.labels, toValue(defaults.labels)))

/* ---- 搜索项与数据核 ---- */

const searchDefs = computed(() => deriveSearchDefs(props.columns))

// 排序状态(受控):sorter 列点表头 → 写这里 → 并进 fetcher 参数 + 回显箭头。
const sortState = ref<{ field: string; order: 'ascend' | 'descend' } | null>(null)
function sortToParams(): Record<string, string> {
  const s = sortState.value
  return s ? { sortField: s.field, sortOrder: s.order === 'ascend' ? 'asc' : 'desc' } : {}
}

const table = useProTable<T>(
  // 包一层保证始终取最新的 props.fetcher(模板内联箭头每次渲染都是新引用)
  (p) => props.fetcher!(p),
  {
    initParams: deriveInitParams(searchDefs.value),
    extraParams: () => ({ ...(props.params ?? {}), ...sortToParams() }),
    immediate: isRemote.value && props.immediate,
    defaultPageSize: props.defaultPageSize,
    onError: (e) => emit('error', e),
  },
)
const { loading, rows, params, pagination } = table

// 列定义后追加的搜索字段:补种 key,保证 Naive 控件受控(null 而非 undefined)
watch(searchDefs, (defs) => {
  for (const d of defs) {
    if (!(d.key in params)) params[d.key] = d.defaultValue ?? null
  }
})

// 外部附加参数变化(树筛选联动)→ 回第 1 页重查
watch(
  () => props.params,
  () => {
    if (isRemote.value) void table.search()
  },
  { deep: true },
)

// 请求成功(竞态守卫已过滤过期响应)→ loaded
watch(rows, (r) => {
  if (isRemote.value) emit('loaded', r, pagination.itemCount)
})

/* ---- 字典与列 ---- */

const options = useOptions(() => deriveOptionsSources(props.columns))

const columnsApi = useColumns<T>({
  columns: () => props.columns,
  storageKey: props.storageKey,
  defaultDensity: props.defaultDensity ?? defaults.density,
  getOptions: options.getOptions,
  slots,
  indexOffset: () => (isRemote.value ? (pagination.page - 1) * pagination.pageSize : 0),
  defaults,
  sortState: () => sortState.value,
})

// Naive @update:sorter → 更新受控排序态 + 远程重查(回第 1 页)。宿主若另挂 handler 也转发。
function onSorterChange(s: unknown) {
  const st = (Array.isArray(s) ? s[0] : s) as { columnKey?: string | number; order?: 'ascend' | 'descend' | false } | null
  sortState.value = st && st.order ? { field: String(st.columnKey), order: st.order } : null
  if (isRemote.value) void table.search()
  const hostHandler = attrs['onUpdate:sorter']
  if (typeof hostHandler === 'function') (hostHandler as (v: unknown) => void)(s)
}

/* ---- 组装 ---- */

const tableRef = ref<DataTableInst | null>(null)

const rowKeyFn = computed(() => {
  const rk = props.rowKey
  return typeof rk === 'function' ? rk : (row: T) => (row as Record<string, any>)[rk]
})

const tableSize = computed(() => (columnsApi.density.value === 'compact' ? 'small' : 'medium'))

// NDataTable 的 data 形参是 RowData[](Record 索引),泛型 T 无索引签名,此处收窄
const tableData = computed(() => (isRemote.value ? rows.value : (props.data ?? [])) as Record<string, any>[])

const searchConfig = computed<SearchFormConfig>(() => {
  const user = typeof props.search === 'object' ? props.search : {}
  return { cols: defaults.searchCols, ...user } // 用户 cols 覆盖全局默认
})

const showToolbar = computed(
  () => props.toolbar !== false || !!props.title || !!slots.title || !!slots.toolbar,
)
const settingsEnabled = computed(
  () => props.toolbar !== false && (typeof props.toolbar === 'object' ? props.toolbar.columnSettings !== false : true),
)

const paginationPrefix = computed(() =>
  slots['pagination-prefix'] ? (info: unknown) => slots['pagination-prefix']!(info) : undefined,
)

const mergedPagination = computed<false | PaginationProps>(() => {
  if (props.pagination === false) return false
  const user = props.pagination ?? {}
  const base: Partial<PaginationProps> = {
    showSizePicker: defaults.showSizePicker,
    pageSizes: defaults.pageSizes,
    prefix: paginationPrefix.value,
  }
  if (isRemote.value) {
    return {
      ...base,
      page: pagination.page,
      pageSize: pagination.pageSize,
      itemCount: pagination.itemCount,
      onUpdatePage: table.onPage,
      onUpdatePageSize: table.onPageSize,
      ...user,
    }
  }
  return { ...base, defaultPageSize: props.defaultPageSize, ...user }
})

// 消费者显式传 scroll-x 时让位(v-bind 顺序也保证其覆盖)
const autoScrollX = computed(() =>
  'scrollX' in attrs || 'scroll-x' in attrs ? undefined : columnsApi.scrollX.value,
)

// 行 props:合并宿主经 attrs 传入的 row-props + 内置高亮(activeRowKey)与行点击(@row-click)。
// 显式绑定在 v-bind="attrs" 之后,故此处结果最终生效(已并入宿主的 row-props)。
type RowPropsFn = (row: T, index: number) => Record<string, any>
const mergedRowProps = computed<RowPropsFn>(() => {
  const host = (attrs.rowProps ?? attrs['row-props']) as RowPropsFn | undefined
  const active = props.activeRowKey
  return (row: T, index: number) => {
    const base = host ? { ...host(row, index) } : {}
    const isActive = active !== undefined && active !== null && rowKeyFn.value(row) === active
    const cls = [base.class, isActive ? 'pro-table-row--active' : ''].filter(Boolean).join(' ')
    const hostClick = base.onClick as ((e: MouseEvent) => void) | undefined
    return {
      ...base,
      ...(cls ? { class: cls } : {}),
      onClick: (e: MouseEvent) => {
        hostClick?.(e)
        emit('rowClick', row, index)
      },
    }
  }
})

function onSearch() {
  if (isRemote.value) void table.search()
  emit('search', cleanParams(params))
}

function onReset() {
  void table.reset()
  emit('reset')
}

function refresh(): Promise<void> {
  return isRemote.value ? table.load() : Promise.resolve()
}

/* ---- 行拖拽排序(sortablejs 懒加载,仅 rowDraggable 时) ---- */
const rootRef = ref<HTMLElement | null>(null)

useRowDrag<T>({
  enabled: () => props.rowDraggable,
  getTbody: () => rootRef.value?.querySelector<HTMLElement>('.n-data-table-tbody'),
  rows: () => (isRemote.value ? rows.value : props.data) as T[] | undefined,
  handle: () => props.dragHandle,
  onSort: (e) => emit('rowDragSort', e),
})

defineExpose({
  refresh,
  search: () => table.search(),
  reset: () => table.reset(),
  loading,
  rows,
  params,
  pagination,
  reloadOptions: options.reload,
  tableRef,
})
</script>

<template>
  <div ref="rootRef" class="pro-table" :style="{ '--pro-table-active-row-bg': defaults.activeRowBg }">
    <SearchForm
      v-if="props.search !== false && searchDefs.length > 0"
      :fields="searchDefs"
      :params="params"
      :config="searchConfig"
      :labels="mergedLabels"
      :loading="loading"
      :date-value-format="defaults.dateValueFormat"
      :get-options="options.getOptions"
      :is-loading-options="options.isLoading"
      @search="onSearch"
      @reset="onReset"
    />

    <n-card :bordered="true" class="pro-table-card">
      <Toolbar
        v-if="showToolbar"
        :title="props.title"
        :labels="mergedLabels"
        :config="props.toolbar ?? {}"
        :density="columnsApi.density.value"
        @refresh="refresh"
        @update:density="columnsApi.setDensity"
      >
        <template v-if="slots.title" #title><slot name="title" /></template>
        <template v-if="slots.toolbar" #left><slot name="toolbar" /></template>
        <template v-if="slots['toolbar-right']" #right><slot name="toolbar-right" /></template>
        <template v-if="settingsEnabled" #settings>
          <ColumnSettings
            :items="columnsApi.settingItems.value"
            :labels="mergedLabels"
            @toggle="columnsApi.toggleShow"
            @move="columnsApi.moveCheck"
            @set-fixed="columnsApi.setFixed"
            @reset="columnsApi.resetSettings"
          />
        </template>
      </Toolbar>

      <n-data-table
        ref="tableRef"
        :remote="isRemote"
        :columns="columnsApi.naiveColumns.value"
        :data="tableData"
        :loading="isRemote ? loading : false"
        :row-key="rowKeyFn"
        :pagination="mergedPagination"
        :size="tableSize"
        :scroll-x="autoScrollX"
        v-bind="attrs"
        :row-props="mergedRowProps"
        @update:sorter="onSorterChange"
      >
        <template v-if="slots.empty" #empty><slot name="empty" /></template>
      </n-data-table>
    </n-card>
  </div>
</template>

<style scoped>
.pro-table {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
/* activeRowKey 命中行高亮:背景走 --pro-table-active-row-bg,宿主/主题可覆盖。
   :deep 打进内层 n-data-table 的 td —— 包内处理,消费端不必自己写 :deep。 */
.pro-table :deep(.pro-table-row--active > td) {
  background-color: var(--pro-table-active-row-bg, rgba(99, 102, 241, 0.08));
}
</style>
