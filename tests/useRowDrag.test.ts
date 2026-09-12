import { describe, expect, it, vi, beforeEach } from 'vitest'
import { effectScope, ref, nextTick } from 'vue'

// sortablejs 是懒加载的运行时依赖;这里换成假的,只观察「有没有绑、绑到了哪个 tbody」。
const created: { el: unknown; options: any; destroyed: boolean }[] = []
vi.mock('sortablejs', () => ({
  default: {
    create: (el: unknown, options: any) => {
      const inst = { el, options, destroyed: false, destroy: () => (inst.destroyed = true) }
      created.push(inst)
      return inst
    },
  },
}))

import { useRowDrag } from '../src/useRowDrag'

interface Row {
  id: number
}

/** 等 watch 回调 + nextTick + 动态 import 落地(首次 import 要读盘 = 宏任务,光 await nextTick 等不到) */
const flush = async () => {
  for (let i = 0; i < 3; i++) {
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
  }
}

/** 冒充 tbody:useRowDrag 只按引用比较,不碰 DOM API */
const fakeTbody = (name: string) => ({ name }) as unknown as HTMLElement

beforeEach(() => (created.length = 0))

describe('useRowDrag', () => {
  it('远程模式:挂载时表还是空的(naive 不渲染 tbody),行到达后仍要绑上', async () => {
    // 锁定绑定时机:若只在 onMounted 绑一次 → fetcher 模式永远绑不上,手柄拖不动。
    const rows = ref<Row[]>([])
    const tbody = fakeTbody('t1')
    const scope = effectScope()
    scope.run(() =>
      useRowDrag<Row>({
        enabled: () => true,
        getTbody: () => (rows.value.length ? tbody : null), // 空表 → 没有 tbody
        rows: () => rows.value,
        onSort: () => {},
      }),
    )

    await flush()
    expect(created).toHaveLength(0) // 空表时绑不上,且不能报错

    rows.value = [{ id: 1 }, { id: 2 }] // fetcher 返回
    await flush()
    expect(created).toHaveLength(1)
    expect(created[0].el).toBe(tbody)

    scope.stop()
  })

  it('tbody 被重建(空↔非空)时重绑到新元素,旧实例销毁', async () => {
    const rows = ref<Row[]>([{ id: 1 }])
    let tbody = fakeTbody('t1')
    const scope = effectScope()
    scope.run(() =>
      useRowDrag<Row>({
        enabled: () => true,
        getTbody: () => (rows.value.length ? tbody : null),
        rows: () => rows.value,
        onSort: () => {},
      }),
    )
    await flush()
    expect(created).toHaveLength(1)

    rows.value = [] // 搜到空 → naive 拆掉 tbody
    await flush()
    expect(created[0].destroyed).toBe(true)

    tbody = fakeTbody('t2') // 再有数据 → 是一个全新的 tbody
    rows.value = [{ id: 3 }]
    await flush()
    expect(created).toHaveLength(2)
    expect(created[1].el).toBe(tbody)

    scope.stop()
  })

  it('同一个 tbody 上行数据变化不重复建实例', async () => {
    const rows = ref<Row[]>([{ id: 1 }])
    const tbody = fakeTbody('t1')
    const scope = effectScope()
    scope.run(() =>
      useRowDrag<Row>({
        enabled: () => true,
        getTbody: () => tbody,
        rows: () => rows.value,
        onSort: () => {},
      }),
    )
    await flush()
    rows.value = [{ id: 2 }] // 翻页/刷新:tbody 元素还是那个
    await flush()
    expect(created).toHaveLength(1)

    scope.stop()
  })

  it('未启用时不加载 sortablejs;作用域销毁时释放实例', async () => {
    const rows = ref<Row[]>([{ id: 1 }])
    const off = effectScope()
    off.run(() =>
      useRowDrag<Row>({
        enabled: () => false,
        getTbody: () => fakeTbody('t1'),
        rows: () => rows.value,
        onSort: () => {},
      }),
    )
    await flush()
    expect(created).toHaveLength(0)
    off.stop()

    const on = effectScope()
    on.run(() =>
      useRowDrag<Row>({
        enabled: () => true,
        getTbody: () => fakeTbody('t2'),
        rows: () => rows.value,
        onSort: () => {},
      }),
    )
    await flush()
    expect(created).toHaveLength(1)
    on.stop()
    expect(created[0].destroyed).toBe(true)
  })

  it('onEnd:重排响应式行数组并把新顺序发给宿主', async () => {
    const rows = ref<Row[]>([{ id: 1 }, { id: 2 }, { id: 3 }])
    const onSort = vi.fn()
    const scope = effectScope()
    scope.run(() =>
      useRowDrag<Row>({
        enabled: () => true,
        getTbody: () => fakeTbody('t1'),
        rows: () => rows.value,
        handle: () => '.drag-handle',
        onSort,
      }),
    )
    await flush()
    expect(created[0].options.handle).toBe('.drag-handle')

    created[0].options.onEnd({ oldIndex: 2, newIndex: 0 }) // 把第 3 行拖到首位
    expect(rows.value.map((r) => r.id)).toEqual([3, 1, 2]) // 行数组本身已重排
    expect(onSort).toHaveBeenCalledWith({ from: 2, to: 0, reordered: [{ id: 3 }, { id: 1 }, { id: 2 }] })

    created[0].options.onEnd({ oldIndex: 1, newIndex: 1 }) // 原地放下 = 不是变更
    expect(onSort).toHaveBeenCalledTimes(1)

    scope.stop()
  })
})
