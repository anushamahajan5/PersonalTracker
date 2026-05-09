import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, X } from "lucide-react";

const MOTIVATIONAL_QUOTES = [
  "The best way to predict the future is to create it.",
  "Believe you can and you're halfway there.",
  "The only way to do great work is to love what you do.",
  "Success is not final, failure is not fatal: it is the courage to continue that counts.",
  "The future belongs to those who believe in the beauty of their dreams.",
  "It always seems impossible until it's done.",
  "Your time is limited, don't waste it living someone else's life.",
  "The journey of a thousand miles begins with a single step.",
  "Don't watch the clock; do what it does. Keep going.",
  "The only limit to our realization of tomorrow will be our doubts of today.",
];

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState({}); // { 'YYYY-MM-DD': ['Event 1', 'Event 2'] }
  const [selectedDay, setSelectedDay] = useState(null); // Date object for selected day
  const [newEventText, setNewEventText] = useState("");
  const [motivationalQuote, setMotivationalQuote] = useState("");

  useEffect(() => {
    setMotivationalQuote(MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);
  }, [currentDate]); // Change quote when month changes

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay(); // 0 for Sunday, 1 for Monday

  const renderCalendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const numDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);

    const days = [];
    for (let i = 0; i < startDay; i++) {
      days.push(null); // Placeholder for days before the 1st of the month
    }

    for (let i = 1; i <= numDays; i++) {
      days.push(new Date(year, month, i));
    }

    const weeks = [];
    let week = [];
    days.forEach((day, index) => {
      week.push(day);
      if ((index + 1) % 7 === 0 || index === days.length - 1) {
        weeks.push(week);
        week = [];
      }
    });
    return weeks;
  }, [currentDate]);

  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleDayClick = (day) => {
    setSelectedDay(day);
    setNewEventText("");
  };

  const handleAddEvent = () => {
    if (newEventText.trim() && selectedDay) {
      const dateString = selectedDay.toISOString().slice(0, 10);
      setEvents(prev => ({
        ...prev,
        [dateString]: [...(prev[dateString] || []), newEventText.trim()]
      }));
      setNewEventText("");
    }
  };

  const handleDeleteEvent = (dateString, eventIndex) => {
    setEvents(prev => ({
      ...prev,
      [dateString]: prev[dateString].filter((_, i) => i !== eventIndex)
    }));
  };

  const formattedMonthYear = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-6xl mx-auto space-y-8 fade-in" data-testid="calendar-root">
      <div className="flex items-center gap-3">
        <CalendarIcon />
        <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
      </div>

      <div className="border border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={goToPreviousMonth} className="p-2 rounded-md hover:bg-[hsl(var(--secondary))]" data-testid="prev-month-button">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-semibold" data-testid="current-month-year">{formattedMonthYear}</h2>
          <button onClick={goToNextMonth} className="p-2 rounded-md hover:bg-[hsl(var(--secondary))]" data-testid="next-month-button">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-sm font-medium text-[hsl(var(--muted-foreground))]">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {renderCalendarDays.flat().map((day, index) => {
            const dateString = day ? day.toISOString().slice(0, 10) : null;
            const isToday = dateString === today;
            const hasEvents = events[dateString] && events[dateString].length > 0;
            const isSelected = selectedDay && dateString === selectedDay.toISOString().slice(0, 10);

            return (
              <div
                key={index}
                className={`relative h-24 p-1 text-sm rounded-md flex flex-col items-center justify-start cursor-pointer
                  ${day ? 'bg-[hsl(var(--background))] hover:bg-[hsl(var(--secondary))]' : 'bg-transparent'}
                  ${isToday ? 'border border-foreground' : ''}
                  ${isSelected ? 'ring-2 ring-foreground' : ''}
                `}
                onClick={() => day && handleDayClick(day)}
                data-testid={day ? `calendar-day-${dateString}` : `calendar-empty-day-${index}`}
              >
                {day && <span className="font-semibold">{day.getDate()}</span>}
                {hasEvents && (
                  <div className="absolute bottom-1 left-1 right-1 flex flex-wrap gap-0.5">
                    {events[dateString].slice(0, 2).map((event, i) => (
                      <span key={i} className="text-xs bg-blue-500 text-white px-1 rounded-sm truncate max-w-full">
                        {event}
                      </span>
                    ))}
                    {events[dateString].length > 2 && (
                      <span className="text-xs bg-gray-500 text-white px-1 rounded-sm">+{events[dateString].length - 2}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div className="border border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-lg p-4 space-y-4" data-testid="event-modal">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Events for {selectedDay.toDateString()}</h3>
            <button onClick={() => setSelectedDay(null)} className="p-1 rounded-md hover:bg-[hsl(var(--secondary))]" data-testid="close-event-modal">
              <X size={20} />
            </button>
          </div>
          <div className="space-y-2">
            {events[selectedDay.toISOString().slice(0, 10)]?.map((event, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded-md bg-[hsl(var(--background))]" data-testid={`event-item-${index}`}>
                <span>{event}</span>
                <button onClick={() => handleDeleteEvent(selectedDay.toISOString().slice(0, 10), index)} className="text-red-400 hover:text-red-300" data-testid={`delete-event-${index}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {(!events[selectedDay.toISOString().slice(0, 10)] || events[selectedDay.toISOString().slice(0, 10)].length === 0) && (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No events for this day.</p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newEventText}
              onChange={(e) => setNewEventText(e.target.value)}
              placeholder="Add new event"
              className="flex-1 px-3 py-2 rounded-md bg-[hsl(var(--background))] border outline-none focus:border-[hsl(var(--ring))]"
              data-testid="new-event-input"
            />
            <button onClick={handleAddEvent} className="px-4 py-2 rounded-md bg-foreground text-background flex items-center gap-2" data-testid="add-event-button">
              <Plus size={16} /> Add
            </button>
          </div>
        </div>
      )}

      <div className="text-center text-lg italic text-[hsl(var(--muted-foreground))] mt-8" data-testid="motivational-quote">
        "{motivationalQuote}"
      </div>
    </div>
  );
}

Calendar.isProtected = true;
