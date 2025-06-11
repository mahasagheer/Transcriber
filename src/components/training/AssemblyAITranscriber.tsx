'use client';

import React, { useRef, useState } from 'react';

const ASSEMBLYAI_API_KEY = '239db32e77d44771ad26e0accdd31423';

const AssemblyAITranscriber: React.FC = () => {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Start recording and streaming
  const startTranscription = async () => {
    setTranscript('');
    setIsRecording(true);

    // 1. Open AssemblyAI WebSocket
    const ws = new WebSocket(
      `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000`,
    );
    wsRef.current = ws;

    ws.onopen = async () => {
      // 2. Get user mic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

      // 3. Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
        audioBitsPerSecond: 16000 * 16, // 16kHz, 16bit
      });
      mediaRecorderRef.current = mediaRecorder;

      // 4. Send audio chunks to AssemblyAI
      mediaRecorder.addEventListener('dataavailable', async (event) => {
        if (event.data.size > 0 && ws.readyState === 1) {
          // Convert webm to base64 (AssemblyAI expects base64-encoded PCM or WAV, but webm/opus is accepted for browser clients)
          const arrayBuffer = await event.data.arrayBuffer();
          ws.send(arrayBuffer);
        }
      });

      mediaRecorder.start(250); // send every 250ms
    };

    // 5. Handle AssemblyAI responses
    ws.onmessage = (message) => {
      const res = JSON.parse(message.data);
      if (res.text) {
        setTranscript(res.text);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      stopTranscription();
    };

    ws.onclose = () => {
      stopTranscription();
    };
  };

  // Stop everything
  const stopTranscription = () => {
    setIsRecording(false);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  // Authenticate WebSocket (AssemblyAI expects the API key in the header, but browsers can't set headers on WS, so use query param)
  // You must pass the API key as a query param: wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=YOUR_API_KEY
  // If your key is not working, you may need to generate a temporary token via your backend for security.

  return (
    <div className="p-4 border rounded-lg bg-white shadow">
      <h2 className="text-xl font-semibold mb-4">Live Transcription (AssemblyAI)</h2>
      <div className="mb-4">
        <button
          onClick={isRecording ? stopTranscription : startTranscription}
          className={`px-4 py-2 rounded ${isRecording ? 'bg-red-500' : 'bg-blue-500'} text-white`}
        >
          {isRecording ? 'Stop' : 'Start'} Transcription
        </button>
      </div>
      <div className="mb-4 min-h-[2em] bg-gray-100 p-2 rounded">
        <span className="font-mono">{transcript}</span>
      </div>
    </div>
  );
};

export default AssemblyAITranscriber;