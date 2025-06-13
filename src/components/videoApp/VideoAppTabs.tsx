import React, { useState } from 'react';
import MediaRecorderWithSpeechRecognition from './MediaRecorderWithSpeechRecognition';
import MonthlyCalendar from './MonthlyCalendar';
import MediaLibrary from './MediaLibrary';
import RecordingHeatmap from '../videoApp/RecordingHeatmap';
import { useTheme } from '../../context/ThemeContext';
import { Moon, Sun } from 'lucide-react';
import AssemblyAITranscriber from '../training/AssemblyAITranscriber';


const TABS = [
  { label: 'Record', value: 'record' },
  { label: 'Calendar', value: 'calendar' },
  { label: 'Library', value: 'library' },
  { label: 'Activity', value: 'activity' },
];

const VideoAppTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState('record');
  const { theme, toggleTheme } = useTheme();


  return (
    <div className="w-full mx-auto mt-5 px-2 sm:px-4 md:px-6 lg:px-8">
      {/* Tab headers */}
      <div className="flex flex-wrap border-b border-gray-200 dark:border-gray-700 mb-6 justify-center sm:justify-start">
        {TABS.map(tab => (
          <button
            key={tab.value}
            className={`
              flex-1 sm:flex-none px-3 py-2 sm:px-6 sm:py-2 font-medium focus:outline-none transition-colors border-b-2 -mb-px text-sm sm:text-base
              ${activeTab === tab.value
                ? // Active Tab Styles
                  theme === 'dark'
                    ? 'border-blue-400 text-white hover:bg-blue-600' // Dark theme active
                    : 'border-blue-600 text-blue-600 hover:bg-blue-100' // Light theme active
                : // Inactive Tab Styles
                  theme === 'dark'
                    ? 'border-transparent text-white hover:bg-gray-700' // Dark theme inactive
                    : 'border-transparent text-gray-700 hover:text-blue-500 hover:bg-gray-100' // Light theme inactive
              }
            }`}
            onClick={() => setActiveTab(tab.value)}
            aria-selected={activeTab === tab.value}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
        {/* Theme Toggle Button */}
        <button
          className="ml-auto px-2 py-2 sm:px-4 sm:py-2 rounded text-sm transition-colors text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? (
            <Sun className={` w-5 h-5 inline-block align-middle mr-1`} />
          ) : (
            <Moon className={`${ theme === "dark" ? "text-white":"text-gray-700"} w-5 h-5 inline-block align-middle mr-1`} />
          )}
          <span className={`${ theme === "dark" ? "text-white":"text-gray-700"} hidden sm:inline-block align-middle`}>
            {theme === 'light' ? 'Light' : 'Dark'} Mode
          </span>
        </button>
      </div>
      {/* Tab content */}
      <div className={`${ theme === "dark" ? "bg-[#1f2937]":"bg-white"} dark:bg-gray-800 rounded shadow-lg dark:shadow-none md:p-4 min-h-[400px]`}>
        {activeTab === 'record' && <AssemblyAITranscriber/>}
        {activeTab === 'calendar' && <MonthlyCalendar />}
        {activeTab === 'library' && <MediaLibrary />}
        {activeTab === 'activity' && <RecordingHeatmap />}
      </div>
    </div>
  );
};

export default VideoAppTabs; 