import type { ProTableLabels } from './types'

/** 英文默认文案;宿主经 labels prop 部分覆盖(传 computed 即随 locale 响应)。 */
export const defaultLabels: ProTableLabels = {
  search: 'Search',
  reset: 'Reset',
  refresh: 'Refresh',
  density: 'Density',
  densityComfortable: 'Comfortable',
  densityCompact: 'Compact',
  columnSettings: 'Columns',
  columnSettingsReset: 'Restore defaults',
  fixedLeft: 'Pin left',
  fixedRight: 'Pin right',
  fixedNone: 'Unpin',
  expand: 'Expand',
  collapse: 'Collapse',
}

/** 三层合并:内置英文 < 全局默认(global)< 实例 prop(partial)。 */
export function mergeLabels(
  partial?: Partial<ProTableLabels>,
  global?: Partial<ProTableLabels>,
): ProTableLabels {
  return { ...defaultLabels, ...global, ...partial }
}
