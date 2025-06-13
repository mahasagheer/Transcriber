'use client';

import React, { useCallback, useState } from 'react';
import { createMicrophone } from '@/helpers/createMicrophone';
import { createTranscriber } from '@/helpers/createTranscriber';
import { RealtimeTranscriber } from 'assemblyai';

const AssemblyAITranscriber: React.FC = () => {
  const [transcribedText, setTranscribedText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [transcriber, setTranscriber] = useState<RealtimeTranscriber | undefined>(undefined);
  const [mic, setMic] = useState<{
    startRecording(onAudioCallback: any): Promise<void>;
    stopRecording(): void;
  } | undefined>(undefined);

  const handlePrompt = useCallback(async (text: string) => {
    console.log('Prompt:', text);
    // You can trigger your LLM logic here, if needed
  }, []);

  const startTranscription = useCallback(async () => {
    setTranscribedText('');
    setIsRecording(true);

    // Initialize transcriber
    const t = await createTranscriber(setTranscribedText, () => {}, handlePrompt);

    if (!t) {
      console.error('Failed to create transcriber');
      return;
    }

    await t.connect();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const m = createMicrophone(stream);

    await m.startRecording((audioData: any) => {
      t.sendAudio(audioData);
    });

    setTranscriber(t);
    setMic(m);
  }, [handlePrompt]);

  const stopTranscription = useCallback(async () => {
    setIsRecording(false);
    mic?.stopRecording();
    await transcriber?.close(false);
    setMic(undefined);
    setTranscriber(undefined);
  }, [mic, transcriber]);

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
        <span className="font-mono">{transcribedText}</span>
      </div>
    </div>
  );
};

export default AssemblyAITranscriber;
