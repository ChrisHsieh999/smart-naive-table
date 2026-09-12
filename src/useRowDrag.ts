import { nextTick, onScopeDispose, watch } from 'vue'

/**
 * 行拖拽(sortablejs 懒加载)。要点是**绑定时机**:
 *
 * Naive 的 n-data-table 在**没有行**时渲染的是空状态占位,DOM 里根本没有 `.n-data-table-tbody`。
 * 而 fetcher(远程)模式下,组件挂载那一刻数据还在路上 —— 若只在 onMounted 里绑一次,
 * 那时查不到 tbody,拖拽就**永远绑不上**(手柄画得出来,却拖不动)。
 *
 * 所以绑定跟着行数据走:每次行数组变化后对齐一次 —— tbody 换了(空↔非空会重建)就重绑,没变则原样保留。
 */
export interface RowDragOptions<T> {
  /** 是否启用(对应 rowDraggable) */
  enabled: () => boolean
  /** 取当前 tbody;拿不到(空表/未渲染)返回 null,等下次行变化再试 */
  getTbody: () => HTMLElement | null | undefined
  /** 当前行数组(远程=内部 rows,静态=props.data);既是 watch 源,也是拖完要重排的那个响应式数组 */
  rows: () => T[] | undefined
  /** 拖拽手柄选择器(可选;不传则整行可拖) */
  handle?: () => string | undefined
  /** 拖完回调:行数组已按新顺序重排 */
  onSort: (e: { from: number; to: number; reordered: T[] }) => void
}

export function useRowDrag<T>(options: RowDragOptions<T>) {
  let sortable: { destroy(): void } | null = null
  let boundEl: HTMLElement | null = null

  function teardown() {
    sortable?.destroy()
    sortable = null
    boundEl = null
  }

  async function sync() {
    if (!options.enabled()) return
    await nextTick() // 行数据刚变,等 DOM patch 完再找 tbody
    const tbody = options.getTbody() ?? null
    if (tbody === boundEl) return // 还是同一个 tbody,已绑好,不重复建
    teardown()
    if (!tbody) return // 空表:naive 没渲染 tbody,等有行了再绑

    const Sortable = (await import('sortablejs')).default
    sortable = Sortable.create(tbody, {
      animation: 150,
      handle: options.handle?.(),
      onEnd: (evt: { oldIndex?: number; newIndex?: number }) => {
        const from = evt.oldIndex
        const to = evt.newIndex
        if (from == null || to == null || from === to) return
        // 直接改可复用的响应式行数组:Vue 据此重排 = DOM 最终真相(与 Sortable 的 DOM 移动一致,
        // 固定列多 tbody 也靠这次 patch 归一)。宿主收 rowDragSort 再落库/refresh。
        const arr = options.rows()
        if (!arr) return
        const [moved] = arr.splice(from, 1)
        arr.splice(to, 0, moved)
        options.onSort({ from, to, reordered: [...arr] })
      },
    })
    boundEl = tbody
  }

  watch(options.rows, () => void sync(), { immediate: true })
  onScopeDispose(teardown)

  return { sync }
}
