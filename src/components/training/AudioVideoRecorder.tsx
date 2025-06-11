import React, { useState } from "react";
import { ReactMediaRecorder } from "react-media-recorder";

// Add a new type for the recording mode
const RECORDING_MODES = [
  { label: "Audio Only", value: "audio" },
  { label: "Video Only", value: "video" },
  { label: "Audio + Video", value: "audio+video" },
] as const;
type RecordingMode = typeof RECORDING_MODES[number]["value"];

const AudioVideoRecorder: React.FC = () => {
  const [recordingMode, setRecordingMode] = useState<RecordingMode>("audio+video");

  // Determine audio/video props
  const audio = recordingMode === "audio" || recordingMode === "audio+video";
  const video = recordingMode === "video" || recordingMode === "audio+video";

  return (
    <div className="mb-8 p-4 border rounded-lg bg-white shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Audio/Video Recorder</h2>
      <div className="mb-4">
        <label className="block mb-2 font-medium">Recording Mode:</label>
        <div className="flex space-x-4">
          {RECORDING_MODES.map((mode) => (
            <label key={mode.value} className="inline-flex items-center">
              <input
                type="radio"
                value={mode.value}
                checked={recordingMode === mode.value}
                onChange={() => setRecordingMode(mode.value)}
                className="mr-2"
              />
              {mode.label}
            </label>
          ))}
        </div>
      </div>
      <ReactMediaRecorder
        video={video}
        audio={audio}
        render={({
          status,
          startRecording,
          stopRecording,
          mediaBlobUrl,
          previewStream,
          clearBlobUrl,
        }) => (
          <div>
            <div className="mb-4">
              <span className="font-medium">Status:</span> {status}
            </div>
            {video && previewStream && status === "recording" && (
              <div className="mb-4 bg-gray-100 rounded overflow-hidden">
                <video
                  style={{ width: "100%", height: "auto" }}
                  ref={videoEl => {
                    if (videoEl && previewStream) {
                      videoEl.srcObject = previewStream;
                      videoEl.play();
                    }
                  }}
                  muted
                  autoPlay
                  playsInline
                />
              </div>
            )}
            <div className="flex space-x-3 mb-4">
              <button
                onClick={startRecording}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                Start Recording
              </button>
              <button
                onClick={stopRecording}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                Stop Recording
              </button>
              <button
                onClick={clearBlobUrl}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                Clear
              </button>
            </div>
            {mediaBlobUrl && (
              <div className="mb-4">
                {video ? (
                  <video
                    src={mediaBlobUrl}
                    controls
                    className="w-full h-auto"
                  />
                ) : (
                  <audio
                    src={mediaBlobUrl}
                    controls
                    className="w-full"
                  />
                )}
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
};

export default AudioVideoRecorder; 