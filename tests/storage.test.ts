import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearState, loadState, mergeCols, saveState } from '../src/storage'

// node 环境无 localStorage,用内存 stub(storage.ts 只用这四个方法)
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
})

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips state', () => {
    saveState('t', 'compact', [{ key: 'a', show: true }])
    expect(loadState('t')).toEqual({ v: 1, density: 'compact', cols: [{ key: 'a', show: true }] })
  })

  it('returns null for missing / corrupted / version-mismatched state', () => {
    expect(loadState('missing')).toBeNull()

    localStorage.setItem('protable:bad', 'not json')
    expect(loadState('bad')).toBeNull()

    localStorage.setItem('protable:v2', JSON.stringify({ v: 2, density: 'compact', cols: [] }))
    expect(loadState('v2')).toBeNull()
  })

  it('clearState removes the entry', () => {
    saveState('t', 'comfortable', [])
    clearState('t')
    expect(loadState('t')).toBeNull()
  })
})

describe('mergeCols', () => {
  it('stored order/visibility/fixed wins for surviving columns', () => {
    const declared = [
      { key: 'a', show: true },
      { key: 'b', show: true },
    ]
    const merged = mergeCols(declared, [
      { key: 'b', show: false, fixed: 'left' },
      { key: 'a', show: true },
    ])
    expect(merged).toEqual([
      { key: 'b', show: false, fixed: 'left' },
      { key: 'a', show: true },
    ])
  })

  it('drops stored columns that no longer exist in the declaration', () => {
    const merged = mergeCols([{ key: 'a', show: true }], [
      { key: 'gone', show: true },
      { key: 'a', show: false },
    ])
    expect(merged).toEqual([{ key: 'a', show: false }])
  })

  it('inserts newly declared columns at their declared index with declared visibility', () => {
    const declared = [
      { key: 'a', show: true },
      { key: 'new', show: true },
      { key: 'b', show: true },
    ]
    const merged = mergeCols(declared, [
      { key: 'b', show: true },
      { key: 'a', show: true },
    ])
    expect(merged.map((c) => c.key)).toEqual(['b', 'new', 'a'])
    expect(merged[1]).toEqual({ key: 'new', show: true })
  })

  it('appends a new trailing column when declared index exceeds merged length', () => {
    const declared = [
      { key: 'a', show: true },
      { key: 'b', show: true },
      { key: 'tail', show: false },
    ]
    const merged = mergeCols(declared, [{ key: 'a', show: true }])
    expect(merged.map((c) => c.key)).toEqual(['a', 'b', 'tail'])
  })
})
