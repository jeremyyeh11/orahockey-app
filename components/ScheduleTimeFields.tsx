import { endFromTime } from '@/lib/format'

const inputCls =
  'liga-field w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'
const labelCls = 'block text-xs font-medium text-slate-400 mb-1'

/**
 * Optional "Ends at" (a time on the start's day — earlier than the start means
 * it runs past midnight) and "Report early by" minutes, shared by the add/edit
 * forms for games, trainings and events. Read back with readTimeFields().
 */
export function ScheduleTimeFields({
  defaultEnd,
  defaultReport,
}: {
  /** 'HH:mm' */
  defaultEnd?: string
  defaultReport?: number | null
}) {
  return (
    <div className="liga-time-fields flex gap-3">
      <div className="flex-1">
        <label className={labelCls} htmlFor="schedule-end-time">Ends at</label>
        <input id="schedule-end-time" name="end_time" type="time" defaultValue={defaultEnd ?? ''} className={`${inputCls} h-[42px]`} />
        <p className="mt-1 text-[11px] text-slate-500">Optional</p>
      </div>
      <div className="flex-1">
        <label className={labelCls} htmlFor="schedule-report">Report early by (min)</label>
        <input
          id="schedule-report"
          name="report_minutes"
          type="number"
          min="0"
          max="600"
          step="5"
          defaultValue={defaultReport ?? ''}
          placeholder="e.g. 15"
          className={inputCls}
        />
      </div>
    </div>
  )
}

/** End time + report minutes from a form using ScheduleTimeFields */
export function readTimeFields(fd: FormData, startIso: string) {
  const report = ((fd.get('report_minutes') as string | null) ?? '').trim()
  return {
    ends_at: endFromTime(startIso, (fd.get('end_time') as string | null) ?? ''),
    report_minutes: report === '' ? null : Number(report),
  }
}
