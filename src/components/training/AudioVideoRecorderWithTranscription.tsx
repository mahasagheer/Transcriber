'use client';

import React, { useRef, useState, useEffect } from 'react';
import { ReactMediaRecorder } from 'react-media-recorder';

type RecordingMode = 'audio' | 'video' | 'audio+video';

const RECORDING_MODES = [
  { label: 'Audio Only', value: 'audio' },
  { label: 'Video Only', value: 'video' },
  { label: 'Audio + Video', value: 'audio+video' },
] as const;

const AudioVideoRecorderWithTranscription: React.FC = () => {
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('audio+video');
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [currentPreviewStream, setCurrentPreviewStream] = useState<MediaStream | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Determine audio/video props
  const audio = recordingMode === 'audio' || recordingMode === 'audio+video';
  const video = recordingMode === 'video' || recordingMode === 'audio+video';

  // --- AssemblyAI WebSocket logic ---
  const startTranscription = async (audioStream: MediaStream) => {
    setTranscript('');
    let token = '';
    try {
      const tokenRes = await fetch('/api/assemblyai-token');
      const data = await tokenRes.json();
      token = data.token;
    } catch (err) {
      setTranscript('Failed to fetch AssemblyAI token.');
      return;
    }
    const ws = new WebSocket(
      `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket opened');
      const audioTracks = audioStream.getAudioTracks();
      if (!audioTracks.length) {
        setTranscript('No audio track found. Please ensure your microphone is enabled.');
        return;
      }
      const audioOnlyStream = new MediaStream([audioTracks[0]]);
      const mediaRecorder = new MediaRecorder(audioOnlyStream, {
        mimeType: 'audio/webm',
        audioBitsPerSecond: 16000 * 16,
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.addEventListener('dataavailable', async (event) => {
        if (event.data.size > 0 && ws.readyState === 1) {
          const arrayBuffer = await event.data.arrayBuffer();
          ws.send(arrayBuffer);
        }
      });

      mediaRecorder.start(250);
    };

    ws.onmessage = (message) => {
      const res = JSON.parse(message.data);
      if (res.text) setTranscript(res.text);
    };

    ws.onerror = (err) => {
      stopTranscription();
    };

    ws.onclose = () => {
      stopTranscription();
    };
  };

  // Start transcription when recording and previewStream are available
  useEffect(() => {
    if (isRecording && audio && currentPreviewStream && !wsRef.current) {
      startTranscription(currentPreviewStream);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, audio, currentPreviewStream]);

  const stopTranscription = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  return (
    <div className="mb-8 p-4 border rounded-lg bg-white shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Audio/Video Recorder with Live Transcription</h2>
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
                disabled={isRecording}
              />
              {mode.label}
            </label>
          ))}
        </div>
      </div>
      <ReactMediaRecorder
        video={video}
        audio={audio}
        askPermissionOnMount={false}
        render={({
          status,
          startRecording,
          stopRecording,
          mediaBlobUrl,
          previewStream,
          clearBlobUrl,
        }) => {
          useEffect(() => {
            setCurrentPreviewStream(previewStream ?? null);
          }, [previewStream]);
          return (
            <div>
              <div className="mb-4">
                <span className="font-medium">Status:</span> {status}
              </div>
              {video && previewStream && isRecording && (
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
                  onClick={async () => {
                    setIsRecording(true);
                    startRecording();
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  disabled={isRecording}
                >
                  Start Recording
                </button>
                <button
                  onClick={() => {
                    setIsRecording(false);
                    stopTranscription();
                    stopRecording();
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
                  disabled={!isRecording}
                >
                  Stop Recording
                </button>
                <button
                  onClick={clearBlobUrl}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  disabled={isRecording}
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
              {/* Live transcript below the recorder */}
              <div className="mb-4 min-h-[2em] bg-gray-100 p-2 rounded">
                <span className="font-mono">{transcript}</span>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
};

export default AudioVideoRecorderWithTranscription;