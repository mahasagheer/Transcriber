import React, { useEffect, useState } from 'react';
import { getAllMedia, Media } from '../../lib/db';
import { format as formatDateFns, parseISO } from 'date-fns';
import TagList from "@/components/videoApp/TagList"
import { X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';


// Helper to format date as D MMMM YYYY
function formatDay(date: string) {
  return formatDateFns(parseISO(date), 'd MMMM yyyy');
}

// Helper to format hour as 12-hour AM/PM
function formatHour(hour: number) {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h} ${ampm}`;
}

// Helper to format time as h:mm AM/PM
function formatTime(date: Date) {
  return formatDateFns(date, 'h:mm a');
}

// Color scale: 0 = #f3f4f6 (gray-100), 1 = #bfdbfe, 2 = #60a5fa, 3+ = #1e40af (blue-200, blue-400, blue-800)
function getCellColor(count: number) {
    if (count <= 0) return '#f3f4f6'; // light gray for 0
  
    // Max intensity count cap at 20
    const maxCount = 20;
    const intensity = Math.min(count, maxCount) / maxCount;
  
    // From light blue to dark blue using HSL
    const hue = 217; // blue
    const saturation = 100;
    const lightness = 90 - intensity * 50; // light to dark
  
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
  

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const RecordingHeatmap: React.FC = () => {
  const [heatmapData, setHeatmapData] = useState<{
    [date: string]: { [hour: number]: Media[] };
  }>({});
  const [days, setDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoverInfo, setHoverInfo] = useState<{
    date: string;
    hour: number;
    count: number;
    recordings: Media[];
    x: number;
    y: number;
  } | null>(null);
  const [drawer, setDrawer] = useState<{
    open: boolean;
    date: string;
    hour: number;
    recordings: Media[];
  } | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    getAllMedia().then((mediaList) => {
      // Group by date and hour
      const map: { [date: string]: { [hour: number]: Media[] } } = {};
      mediaList.forEach((media) => {
        const d = new Date(media.createdAt);
        const dateStr = d.toISOString().slice(0, 10);
        const hour = d.getHours();
        if (!map[dateStr]) map[dateStr] = {};
        if (!map[dateStr][hour]) map[dateStr][hour] = [];
        map[dateStr][hour].push(media);
      });
      // Get last 30 days with recordings, sorted descending
      const allDays = Object.keys(map).sort((a, b) => b.localeCompare(a)).slice(0, 30).reverse();
      setDays(allDays);
      setHeatmapData(map);
      setLoading(false);
    });
  }, []);

  return (
    <div className={`p-4 md:p-6 lg:p-8 rounded-lg ${theme === "dark" ? "bg-gray-800 text-gray-100 shadow-xl":"bg-white text-gray-900 shadow-lg"}`}>
      <h2 className={`text-2xl md:text-3xl font-bold mb-6 text-center ${theme === "dark" ? "text-gray-100":"text-gray-900"}`}>Recording Activity Heatmap</h2>
      {loading ? (
        <div className={`text-center text-lg py-10 ${theme === "dark" ? "text-gray-300":"text-gray-700"}`}>Loading...</div>
      ) : days.length === 0 ? (
        <div className={`text-center text-lg py-10 ${theme === "dark" ? "text-gray-400":"text-gray-500"}`}>No recordings found.</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid" style={{ gridTemplateColumns: `140px repeat(24, 1fr)` }}>
            {/* Header row */}
            <div></div>
            {HOURS.map(h => (
              <div key={h} className={`text-xs text-center font-mono pb-2 whitespace-nowrap ${theme === "dark" ? "text-gray-400":"text-gray-500"}`}>{formatHour(h)}</div>
            ))}
            {/* Data rows */}
            {days.map(date => (
              <React.Fragment key={date}>
                {/* Day label */}
                <div className={`text-xs pr-2 text-right font-mono py-1 whitespace-nowrap ${theme === "dark" ? "text-gray-300":"text-gray-700"}`}>{formatDay(date)}</div>
                {/* Hour cells */}
                {HOURS.map(hour => {
                  const recordings = heatmapData[date]?.[hour] || [];
                  const count = recordings.length;
                  return (
                    <div
                      key={hour}
                      className={`rounded cursor-pointer border ${theme === "dark" ? "border-gray-700":"border-gray-200"} relative transition-colors duration-150 py-4 px-1`}
                      style={{ background: getCellColor(count) }}
                      onMouseEnter={e => {
                        const rect = (e.target as HTMLElement).getBoundingClientRect();
                        setHoverInfo({
                          date,
                          hour,
                          count,
                          recordings,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                        });
                      }}
                      onMouseLeave={() => setHoverInfo(null)}
                      onClick={() => {
                        if (count > 0) {
                          setDrawer({ open: true, date, hour, recordings });
                        }
                      }}
                    >
                      {count > 0 && (
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">{count}</span>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          {/* Tooltip */}
          {hoverInfo && (
            <div
              className={`fixed z-50 rounded shadow-lg p-3 text-xs ${theme === "dark" ? "bg-gray-700 border-gray-600 text-gray-100":"bg-white border-gray-300 text-gray-900"}`}
              style={{ left: hoverInfo.x + 8, top: hoverInfo.y + window.scrollY - 8, minWidth: 180 }}
            >
              <div className={`font-semibold mb-1 text-base ${theme === "dark" ? "text-gray-100":"text-gray-900"}`}>{formatDay(hoverInfo.date)} @ {formatHour(hoverInfo.hour)}</div>
              <div className="text-sm">Recordings: <span className={`font-bold ${theme === "dark" ? "text-gray-200":"text-gray-800"}`}>{hoverInfo.count}</span></div>
              {hoverInfo.recordings.length > 0 && (
                <ul className="mt-2 max-h-32 overflow-y-auto space-y-1">
                  {hoverInfo.recordings.map((rec, idx) => (
                    <li key={rec.id || idx} className={`truncate ${theme === "dark" ? "text-gray-300":"text-gray-700"}`}>{rec.name}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {/* Drawer */}
          {drawer?.open && (
            <div className="fixed inset-0 z-50 flex">
              {/* Overlay */}
              <div className={`fixed inset-0 bg-transparent backdrop-blur-sm transition-opacity ${theme === "dark" ? "bg-opacity-70":"bg-opacity-40"}`} onClick={() => setDrawer(null)}></div>
              {/* Drawer panel */}
              <div className={`ml-auto w-full max-w-xl h-full shadow-2xl p-6 flex flex-col relative animate-slide-in-right rounded-l-xl ${theme === "dark" ? "bg-gray-800 text-gray-100 shadow-none":"bg-white text-gray-900"}`}>
                <button
                  className={`absolute top-4 right-4 text-3xl font-bold focus:outline-none transition-colors ${theme === "dark" ? "text-gray-500 hover:text-gray-300":"text-gray-400 hover:text-gray-700"}`}
                  onClick={() => setDrawer(null)}
                  aria-label="Close"
                >
                  <X size={24} />
                </button>
                <h3 className={`text-xl font-bold mb-4 ${theme === "dark" ? "text-gray-100":"text-gray-900"}`}>Recordings for {formatDay(drawer.date)} @ {formatHour(drawer.hour)}</h3>
                <div className="flex-1 overflow-y-auto pr-2">
                  {drawer.recordings.length === 0 ? (
                    <div className={`py-4 text-center ${theme === "dark" ? "text-gray-400":"text-gray-500"}`}>No recordings found.</div>
                  ) : (
                    <ul className="space-y-4">
                      {drawer.recordings.map((rec, idx) => (
                        <li key={rec.id || idx} className={`rounded-lg p-4 shadow-sm ${theme === "dark" ? "bg-gray-700 border-gray-700 shadow-none":"bg-gray-50 border-gray-200"}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-semibold text-base truncate" title={rec.name}>{rec.name}</div>
                            <div className={`text-xs ml-2 whitespace-nowrap ${theme === "dark" ? "text-gray-400":"text-gray-500"}`}>{formatTime(new Date(rec.createdAt))}</div>
                          </div>
                         <TagList tags={rec.tags} />

                          <div className="flex flex-wrap gap-2 mt-2 items-center">
                            {rec.type === 'audio' ? (
                              <audio src={URL.createObjectURL(rec.blob)} controls className={`w-[60%] sm:w-[75%] rounded-md shadow-inner ${theme === "dark" ? "bg-gray-600":"bg-gray-200"}`} />
                            ) : (
                              <video src={URL.createObjectURL(rec.blob)} controls className={`w-full sm:w-40 max-h-28 object-contain rounded-md shadow-inner ${theme === "dark" ? "bg-gray-600":"bg-gray-200"}`} />
                            )}
                            <a
                              href={URL.createObjectURL(rec.blob)}
                              download={rec.name}
                              className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${theme === "dark" ? "focus:ring-offset-gray-800":"focus:ring-offset-white"} transition-colors`}
                            >
                              Download
                            </a>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <style jsx>{`
                @keyframes slide-in-right {
                  from { transform: translateX(100%); }
                  to { transform: translateX(0); }
                }
                .animate-slide-in-right {
                  animation: slide-in-right 0.3s cubic-bezier(0.4,0,0.2,1);
                }
              `}</style>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RecordingHeatmap; 