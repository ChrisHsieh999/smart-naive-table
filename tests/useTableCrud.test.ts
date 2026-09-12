import { describe, expect, it, vi } from 'vitest'
import { useTableCrud } from '../src/useTableCrud'

interface Row {
  id: number
  name: string
  extra: string
}
interface Form {
  name: string
}

describe('useTableCrud', () => {
  const base = () => ({
    form: (): Form => ({ name: '' }),
    create: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    onSuccess: vi.fn(),
    onError: vi.fn(),
  })

  it('openCreate resets model from the form factory', () => {
    const crud = useTableCrud<Row, Form>(base())
    crud.model.value.name = 'dirty'
    crud.openCreate()
    expect(crud.visible.value).toBe(true)
    expect(crud.mode.value).toBe('create')
    expect(crud.model.value).toEqual({ name: '' })
    expect(crud.editingRow.value).toBeNull()
  })

  it('openEdit default toForm copies only fields present on the empty form', () => {
    const crud = useTableCrud<Row, Form>(base())
    crud.openEdit({ id: 1, name: 'tom', extra: 'x' })
    expect(crud.mode.value).toBe('edit')
    expect(crud.model.value).toEqual({ name: 'tom' })
  })

  it('submit(create) closes on success and calls onSuccess', async () => {
    const opts = base()
    const crud = useTableCrud<Row, Form>(opts)
    crud.openCreate()
    const ok = await crud.submit()
    expect(ok).toBe(true)
    expect(opts.create).toHaveBeenCalledOnce()
    expect(crud.visible.value).toBe(false)
    expect(opts.onSuccess).toHaveBeenCalledOnce()
  })

  it('submit(edit) passes model and editing row to update', async () => {
    const opts = base()
    const crud = useTableCrud<Row, Form>(opts)
    const row = { id: 1, name: 'tom', extra: 'x' }
    crud.openEdit(row)
    crud.model.value.name = 'jerry'
    await crud.submit()
    expect(opts.update).toHaveBeenCalledWith({ name: 'jerry' }, row)
  })

  it('submit failure keeps the dialog open, reports error, returns false', async () => {
    const opts = { ...base(), create: vi.fn(async () => Promise.reject(new Error('boom'))) }
    const crud = useTableCrud<Row, Form>(opts)
    crud.openCreate()
    const ok = await crud.submit()
    expect(ok).toBe(false)
    expect(crud.visible.value).toBe(true)
    expect(opts.onError).toHaveBeenCalledOnce()
    expect(crud.submitting.value).toBe(false)
  })

  it('concurrent submit is ignored while submitting', async () => {
    const opts = base()
    let resolveCreate!: () => void
    opts.create = vi.fn(() => new Promise<void>((res) => (resolveCreate = res)))
    const crud = useTableCrud<Row, Form>(opts)
    crud.openCreate()
    const first = crud.submit()
    const second = await crud.submit()
    expect(second).toBe(false)
    resolveCreate()
    expect(await first).toBe(true)
    expect(opts.create).toHaveBeenCalledOnce()
  })

  it('removeRow returns false when remove is not configured', async () => {
    const opts = { ...base(), remove: undefined }
    const crud = useTableCrud<Row, Form>(opts)
    expect(await crud.removeRow({ id: 1, name: 't', extra: '' })).toBe(false)
  })

  it('removeRow success triggers onSuccess; failure triggers onError', async () => {
    const opts = base()
    const crud = useTableCrud<Row, Form>(opts)
    expect(await crud.removeRow({ id: 1, name: 't', extra: '' })).toBe(true)
    expect(opts.onSuccess).toHaveBeenCalledOnce()

    const failing = { ...base(), remove: vi.fn(async () => Promise.reject(new Error('no'))) }
    const crud2 = useTableCrud<Row, Form>(failing)
    expect(await crud2.removeRow({ id: 1, name: 't', extra: '' })).toBe(false)
    expect(failing.onError).toHaveBeenCalledOnce()
  })
})
