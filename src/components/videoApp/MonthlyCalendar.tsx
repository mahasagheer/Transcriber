import React, { useMemo, useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format } from 'date-fns/format';
import { parse } from 'date-fns/parse';
import { startOfWeek } from 'date-fns/startOfWeek';
import { getDay } from 'date-fns/getDay';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useTheme } from '@/context/ThemeContext';

// IndexedDB helpers
import { getAllMedia, Media } from '../../lib/db';

// Localizer setup for date-fns
const locales = {
  'en-US': enUS,
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

// Example event type
interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  mediaItems?: Media[];
}

// Example events
const exampleEvents: CalendarEvent[] = [
  {
    title: 'Project Kickoff',
    start: new Date(),
    end: new Date(),
    mediaItems: [],
  },
  {
    title: 'Doctor Appointment',
    start: new Date(new Date().setDate(new Date().getDate() + 2)),
    end: new Date(new Date().setDate(new Date().getDate() + 2)),
    mediaItems: [],
  },
  {
    title: 'Team Lunch',
    start: new Date(new Date().setDate(new Date().getDate() + 5)),
    end: new Date(new Date().setDate(new Date().getDate() + 5)),
    mediaItems: [],
  },
];

interface MonthlyCalendarProps {
  events?: CalendarEvent[];
  onDaySelect?: (date: Date) => void;
}

// Helper to parse the filename format: date_time_name.ext
function parseMediaFilename(filename: string) {
  // Example: 2024-06-10_15-30-00_Meeting.mp3
  const regex = /^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})_(.+)\.(\w+)$/;
  const match = filename.match(regex);
  if (!match) {
    return {
      date: '',
      time: '',
      name: filename,
      ext: '',
    };
  }
  const [_, date, time, name, ext] = match;
  return {
    date,
    time: time.replace(/-/g, ':'),
    name,
    ext,
  };
}

const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({ events, onDaySelect }) => {
  const [mediaEvents, setMediaEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [mediaForDay, setMediaForDay] = useState<Media[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const {theme}= useTheme()
  const [currentDate, setCurrentDate] = useState(new Date());

  // Fetch all media from IndexedDB and group by day
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getAllMedia().then((media: Media[]) => {
      if (!isMounted) return;
      // Group by day
      const dayMap: { [date: string]: Media[] } = {};
      media.forEach((item) => {
        const day = new Date(item.createdAt);
        day.setHours(0, 0, 0, 0);
        const key = day.toISOString();
        if (!dayMap[key]) dayMap[key] = [];
        dayMap[key].push(item);
      });
      // Convert to calendar events with media names as title
      const events: CalendarEvent[] = Object.entries(dayMap).map(([date, items]) => ({
        title: items
          .map(v => {
            const parsed = parseMediaFilename(v.name);
            return parsed.name + (parsed.time ? ` (${parsed.time})` : '');
          })
          .join(', '),
        start: new Date(date),
        end: new Date(date),
        mediaItems: items,
      }));
      setMediaEvents(events);
      setLoading(false);
    });
    return () => { isMounted = false; };
  }, [events]);

  // Memoize events for performance
  const memoEvents = useMemo(() => mediaEvents, [mediaEvents]);

  // Custom event style for color coding
  const eventPropGetter = (event: CalendarEvent) => ({
    style: {
      backgroundColor: '#1976d2',
      borderRadius: '6px',
      color: '#fff',
      border: 'none',
      padding: '2px 6px',
      fontWeight: 500,
    },
  });

  // Handle day selection
  const handleDaySelect = (date: Date) => {
    setSelectedDay(date);
    setSelectedMedia(null);
    // Find media for this day
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    const media = memoEvents
      .find(ev => ev.start.getTime() === day.getTime())?.mediaItems || [];
    setMediaForDay(media);
  };

  // Handle media selection
  const handleMediaSelect = (media: Media) => {
    setSelectedMedia(media);
    // Lazy create object URL
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl(URL.createObjectURL(media.blob));
  };

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  // Responsive container
  return (
    <div className={` sm:p-6 lg:p-8  ${ theme === "dark" ? "bg-[#1f2937]":"bg-white"} dark:bg-gray-800 rounded-lg shadow-xl text-gray-900 dark:text-gray-100 min-h-[600px] flex flex-col`}>
      <div style={{ flexGrow: 1 }}>
        <Calendar
          localizer={localizer}
          events={memoEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 600 }}
          views={[Views.MONTH]}
          defaultView={Views.MONTH}
          popup
          selectable
          onSelectSlot={(slotInfo: { start: Date }) => {
            if (onDaySelect) onDaySelect(slotInfo.start);
            handleDaySelect(slotInfo.start);
          }}
          onSelectEvent={event => {
            if (event.mediaItems && event.mediaItems.length > 0) {
              setSelectedDay(event.start);
              setMediaForDay(event.mediaItems);
              setSelectedMedia(null);
            }
          }}
          eventPropGetter={eventPropGetter}
          dayPropGetter={date => ({
            style: {
              cursor: 'pointer',
            },
          })}
          messages={{
            next: 'Next',
            previous: 'Back',
            today: 'Today',
            month: 'Month',
          }}
          toolbar
          longPressThreshold={10}
          // Custom class for further theming
          className="custom-calendar"
          date={currentDate}
          onNavigate={newDate => setCurrentDate(newDate)}
        />
      </div>
      {/* Modal for media on selected day */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-opacity-60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 sm:p-8 max-w-lg w-full relative transform transition-all duration-300 scale-100 opacity-100">
            <button
              className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-3xl font-bold focus:outline-none transition-colors"
              onClick={() => { setSelectedDay(null); setSelectedMedia(null); }}
              aria-label="Close"
            >
              ×
            </button>
            <h3 className="text-xl sm:text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              Recordings for {selectedDay.toLocaleDateString()}
            </h3>
            {loading ? (
              <div className="text-gray-500 dark:text-gray-400">Loading recordings...</div>
            ) : mediaForDay.length === 0 ? (
              <div className="text-gray-500 dark:text-gray-400">No recordings on this day.</div>
            ) : (
              <ul className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2">
                {mediaForDay.map((media) => {
                  const parsed = parseMediaFilename(media.name);
                  return (
                    <li key={media.id}>
                      <button
                        className={`w-full text-left px-4 py-3 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 border transition-colors flex items-center gap-3
                          ${selectedMedia?.id === media.id ? 'bg-blue-100 dark:bg-blue-800 border-blue-400 dark:border-blue-600 text-blue-800 dark:text-blue-200 shadow-md' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200'}`}
                        onClick={() => handleMediaSelect(media)}
                        title={media.name}
                      >
                        {media.type === 'audio' ? (
                          <span className="inline-block text-blue-600 dark:text-blue-400 text-xl" title="Audio">🔊</span>
                        ) : (
                          <span className="inline-block text-purple-600 dark:text-purple-400 text-xl" title="Video">🎥</span>
                        )}
                        <span className="font-semibold flex-grow">{parsed.name}</span>
                        {parsed.time && (
                          <span className="ml-auto text-sm text-gray-500 dark:text-gray-400 font-mono">{parsed.time}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {/* Media preview and transcript */}
            {selectedMedia && objectUrl && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="font-bold mb-2 text-gray-900 dark:text-gray-100 text-lg">
                  {(() => {
                    const parsed = parseMediaFilename(selectedMedia.name);
                    return `${parsed.name}${parsed.time ? ' (' + parsed.time + ')' : ''} [${selectedMedia.type}]`;
                  })()}
                </div>
                {selectedMedia.type === 'audio' ? (
                  <audio
                    src={objectUrl}
                    controls
                    className="w-full rounded-lg mb-4 bg-gray-200 dark:bg-gray-700 shadow-inner" // Adjusted styling
                    style={{ maxHeight: 80 }}
                    preload="metadata"
                  />
                ) : (
                  <video
                    src={objectUrl}
                    controls
                    className="w-full rounded-lg mb-4 bg-gray-200 dark:bg-gray-700 shadow-inner" // Adjusted styling
                    style={{ maxHeight: 320 }}
                    preload="metadata"
                  />
                )}
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-sm border border-gray-200 dark:border-gray-700 shadow-inner">
                  <div className="font-bold mb-2 text-gray-800 dark:text-gray-200">Transcription:</div>
                  <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 max-h-40 overflow-y-auto">
                    {selectedMedia.transcript || <span className="italic text-gray-400 dark:text-gray-500">No transcript available.</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <style jsx global>{`
        .custom-calendar .rbc-toolbar {
          background: #f5f5f5; /* Light mode default */
          border-radius: 12px;
          margin-bottom: 16px;
          padding: 12px;
          border: 1px solid #e2e8f0; /* Tailwind gray-200 */
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); /* shadow-md */
        }

        .dark .custom-calendar .rbc-toolbar {
          background: #374151; /* Tailwind gray-700 */
          border-color: #4b5563; /* Tailwind gray-600 */
          color: #d1d5db; /* Tailwind gray-300 */
          box-shadow: none;
        }

        .custom-calendar .rbc-toolbar button {
          transition: all 0.2s ease-in-out;
          padding: 8px 12px;
          border-radius: 8px;
          font-weight: 600;
          color: #4a5568; /* Tailwind gray-700 */
        }

        .dark .custom-calendar .rbc-toolbar button {
          color: #d1d5db; /* Tailwind gray-300 */
        }

        .custom-calendar .rbc-toolbar button:hover {
          background-color: #e2e8f0; /* Tailwind gray-200 */
        }

        .dark .custom-calendar .rbc-toolbar button:hover {
          background-color: #4b5563; /* Tailwind gray-600 */
        }

        .custom-calendar .rbc-toolbar button.rbc-active,
        .custom-calendar .rbc-toolbar button.rbc-active:hover {
          background-color: #2563eb; /* Tailwind blue-600 */
          color: #fff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .dark .custom-calendar .rbc-toolbar button.rbc-active,
        .dark .custom-calendar .rbc-toolbar button.rbc-active:hover {
          background-color: #60a5fa; /* Tailwind blue-400 */
          color: #1f2937; /* Tailwind gray-800 */
        }

        .custom-calendar .rbc-month-view {
          background: #fff; /* Light mode default */
          border-radius: 12px;
          border: 1px solid #e2e8f0; /* Tailwind gray-200 */
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); /* shadow-md */
        }

        .dark .custom-calendar .rbc-month-view {
          background: #1f2937; /* Tailwind gray-800 */
          border-color: #4b5563; /* Tailwind gray-600 */
          color: #e5e7eb; /* Tailwind gray-200 */
          box-shadow: none;
        }

        .custom-calendar .rbc-header {
          background-color: #f9fafb; /* Tailwind gray-50 */
          color: #4a5568; /* Tailwind gray-700 */
          font-weight: 700;
          padding: 10px 0;
          border-bottom: 1px solid #e5e7eb; /* Tailwind gray-200 */
        }
        .dark .custom-calendar .rbc-header {
          background-color: #374151; /* Tailwind gray-700 */
          color: #d1d5db; /* Tailwind gray-300 */
          border-bottom-color: #4b5563; /* Tailwind gray-600 */
        }

        .custom-calendar .rbc-date-cell {
          padding: 8px;
          font-size: 0.9rem;
          color: #374151; /* Tailwind gray-800 */
          transition: background-color 0.15s ease-in-out;
        }
        .dark .custom-calendar .rbc-date-cell {
          color: #d1d5db; /* Tailwind gray-300 */
        }

        .custom-calendar .rbc-off-range {
          background-color: #e6e6e6; /* Light gray for out-of-range days in light mode */
          color: #9ca3af; /* Tailwind gray-400 for text */
        }

        .dark .custom-calendar .rbc-off-range {
          background-color: transparent; /* Ensure rbc-day-bg shows through */
          color: #6b7280; /* Tailwind gray-500 for text */
        }

        .dark .custom-calendar .rbc-off-range-bg {
          background-color: #1f2937; /* Darker gray for out-of-range day background in dark mode (Tailwind gray-800) */
        }

        .custom-calendar .rbc-day-bg {
          transition: background-color 0.15s ease-in-out;
        }

        .custom-calendar .rbc-day-bg:hover {
          background-color: #f3f4f6; /* Tailwind gray-100 */
        }

        .dark .custom-calendar .rbc-day-bg:hover {
          background-color: #4b5563; /* Tailwind gray-600 */
        }

        .custom-calendar .rbc-date-cell.rbc-current,
        .custom-calendar .rbc-today {
          background: #eff6ff !important; /* Tailwind blue-50 */
          border-radius: 8px;
          box-shadow: inset 0 0 0 2px #93c5fd; /* Tailwind blue-300 ring */
        }

        .dark .custom-calendar .rbc-date-cell.rbc-current,
        .dark .custom-calendar .rbc-today {
          background: #1e3a8a !important; /* Tailwind blue-900 */
          box-shadow: inset 0 0 0 2px #60a5fa; /* Tailwind blue-400 ring */
        }

        .custom-calendar .rbc-event {
          background-color: #3b82f6; /* Tailwind blue-500 */
          border-radius: 6px;
          color: #fff;
          border: none;
          padding: 2px 8px;
          font-weight: 500;
          font-size: 0.8rem;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .dark .custom-calendar .rbc-event {
          background-color: #60a5fa; /* Tailwind blue-400 */
          color: #1f2937; /* Tailwind gray-800 */
          box-shadow: none;
        }

        .custom-calendar .rbc-toolbar .rbc-btn-group button {
          border: 1px solid #d1d5db; /* Tailwind gray-300 */
          color: #4a5568; /* Tailwind gray-700 */
        }

        .dark .custom-calendar .rbc-toolbar .rbc-btn-group button {
          border-color: #4b5563; /* Tailwind gray-600 */
          color: #d1d5db; /* Tailwind gray-300 */
        }

        .custom-calendar .rbc-toolbar .rbc-btn-group button.rbc-active {
          background-color: #2563eb; /* Tailwind blue-600 */
          color: #fff;
          border-color: #2563eb;
        }

        .dark .custom-calendar .rbc-toolbar .rbc-btn-group button.rbc-active {
          background-color: #60a5fa; /* Tailwind blue-400 */
          color: #1f2937; /* Tailwind gray-800 */
          border-color: #60a5fa;
        }

        @media (max-width: 768px) {
          .custom-calendar .rbc-toolbar {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }
          .custom-calendar .rbc-toolbar .rbc-btn-group {
            width: 100%;
            display: flex;
            justify-content: space-between;
          }
          .custom-calendar .rbc-toolbar .rbc-btn-group button {
            flex-grow: 1;
          }
          .custom-calendar .rbc-month-row {
            min-height: 80px; /* Adjusted for better mobile spacing */
          }
          .custom-calendar .rbc-event {
            font-size: 0.75rem; /* Smaller font for events on mobile */
            padding: 1px 4px;
          }
        }

        @media (max-width: 480px) {
          .custom-calendar .rbc-month-row {
            min-height: 70px;
          }
        }
      `}</style>
    </div>
  );
};

export default MonthlyCalendar; 