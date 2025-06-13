"use client";

import { useState } from "react";
import DBInitializer from "./DBInitializer";
import TodoForm from "./TodoForm";
import TodoList from "./TodoList";
import MediaUploader from "../training/MediaUploader";
import MediaPlayer from "../training/MediaPlayer";
import MediaRecorderWithSpeechRecognition from '../videoApp/MediaRecorderWithSpeechRecognition';
import MonthlyCalendar from "../videoApp/MonthlyCalendar";


export default function TodoApp() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleTodoAdded = () => {
    // Increment the refresh trigger to cause TodoList to reload
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleMediaSaved = () => {
    // Increment the refresh trigger to cause MediaPlayer to reload
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <DBInitializer />

      {/* <h1 className="text-2xl font-bold mb-6 text-center">
        IndexedDB Todo & Media App
      </h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Todo List</h2>
        <TodoForm onTodoAdded={handleTodoAdded} />
        <TodoList refreshTrigger={refreshTrigger} />
      </div> */}
      <MediaRecorderWithSpeechRecognition />
      <MonthlyCalendar />
      {/* <AudioVideoRecorderWithTranscription />      */}
       {/* <div className="border-t pt-8">
        <h2 className="text-xl font-semibold mb-4">Media Library</h2>
        <p className="mb-4 text-gray-600">
          Upload video files and store them in IndexedDB. Your uploaded videos
          will appear in the Media Library below.
        </p>
        <MediaUploader onMediaSaved={handleMediaSaved} />
        <MediaPlayer refreshTrigger={refreshTrigger} />
      </div> */}
    </div>
  );
}
