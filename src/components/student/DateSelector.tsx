import { ELIGIBLE_DATES } from '../../utils/schedule'

interface DateSelectorProps {
  selectedDate: string
  onSelectDate: (date: string) => void
}

export function DateSelector({ selectedDate, onSelectDate }: DateSelectorProps) {
  return (
    <div className="date-selector-tabs" role="tablist" aria-label="Select interview date">
      {ELIGIBLE_DATES.map((d) => {
        const isActive = d.date === selectedDate
        return (
          <button
            key={d.date}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`date-tab-button ${isActive ? 'active' : ''}`}
            onClick={() => onSelectDate(d.date)}
          >
            <span className="day-label">{d.dayOfWeek}</span>
            <span className="date-label">{d.displayDate}</span>
          </button>
        )
      })}
    </div>
  )
}
