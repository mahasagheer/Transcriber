'use client';

import React, { useCallback, useState, useRef } from 'react';
import { createMicrophone } from '@/helpers/createMicrophone';
import { createTranscriber } from '@/helpers/createTranscriber';
import { RealtimeTranscriber } from 'assemblyai';
import { Video, Mic, Square, X, Download, CheckCircle, Trash2, PlusCircle, XCircle } from 'lucide-react';
import { saveMedia, Tag } from '@/lib/db';
import { useTheme } from '@/context/ThemeContext';

type RecordingMode = 'audio' | 'video' | 'both';

const predefinedTags: Tag[] = [
  { name: 'Angry', color: '#f44336' },
  { name: 'Meeting', color: '#1976d2' },
  { name: 'Urgent', color: '#ff9800' },
  { name: 'Feedback', color: '#4caf50' },
  { name: 'Client Call', color: '#9c27b0' },
];

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2;
  const buffer2 = new ArrayBuffer(44 + length);
  const view = new DataView(buffer2);
  const channels = [];
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952);                         // "RIFF"
  setUint32(36 + length);                        // file length - 8
  setUint32(0x45564157);                         // "WAVE"
  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // length = 16
  setUint16(1);                                  // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan);  // avg. bytes/sec
  setUint16(numOfChan * 2);                      // block-align
  setUint16(16);                                 // 16-bit
  setUint32(0x61746164);                         // "data" - chunk
  setUint32(length);                             // chunk length

  // write interleaved data
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][pos]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(44 + offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  return buffer2;
}

const AssemblyAITranscriber: React.FC = () => {
  const [transcribedText, setTranscribedText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('audio');
  const [transcriber, setTranscriber] = useState<RealtimeTranscriber | undefined>(undefined);
  const [mic, setMic] = useState<{
    startRecording(onAudioCallback: any): Promise<void>;
    stopRecording(): void;
  } | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [mediaBlobUrl, setMediaBlobUrl] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [recordingName, setRecordingName] = useState('');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState('');
  const { theme } = useTheme();

  // Helper functions
  const getDateTimeString = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  };

  const getExtension = (blob: Blob) => {
    if (blob.type.includes('mp3')) return 'mp3';
    if (blob.type.includes('wav')) return 'wav';
    if (blob.type.includes('webm')) return 'webm';
    if (blob.type.includes('mp4')) return 'mp4';
    if (blob.type.includes('ogg')) return 'ogg';
    if (blob.type.includes('mpeg')) return 'mp3';
    if (blob.type.includes('quicktime')) return 'mov';
    return 'dat';
  };

  const handlePrompt = useCallback(async (text: string) => {
    console.log('Prompt:', text);
  }, []);

  const startTranscription = useCallback(async () => {
    setTranscribedText('');
    setIsRecording(true);
    recordedChunksRef.current = [];

    const t = await createTranscriber(setTranscribedText, () => {}, handlePrompt);
    if (!t) {
      console.error('Failed to create transcriber');
      return;
    }

    await t.connect();

    const constraints: MediaStreamConstraints = {
      audio: recordingMode === 'audio' || recordingMode === 'both',
      video: recordingMode === 'video' || recordingMode === 'both'
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if ((recordingMode === 'video' || recordingMode === 'both') && videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      if (recordingMode === 'audio' || recordingMode === 'both') {
    const m = createMicrophone(stream);
    await m.startRecording((audioData: any) => {
      t.sendAudio(audioData);
    });
        setMic(m);
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: recordingMode === 'audio' ? 'audio/webm' : 'video/webm'
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: recordingMode === 'audio' ? 'audio/webm' : 'video/webm'
        });
        const url = URL.createObjectURL(blob);
        setMediaBlobUrl(url);
        setShowNameModal(true);
      };

      mediaRecorder.start();
    setTranscriber(t);
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setIsRecording(false);
    }
  }, [handlePrompt, recordingMode]);

  const stopTranscription = useCallback(async () => {
    setIsRecording(false);
    mic?.stopRecording();
    await transcriber?.close(false);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setMic(undefined);
    setTranscriber(undefined);
  }, [mic, transcriber]);

  const saveToIndexedDB = async () => {
    if (!mediaBlobUrl) return;

    try {
      const response = await fetch(mediaBlobUrl);
      const originalBlob = await response.blob();
      console.log('Original blob:', {
        type: originalBlob.type,
        size: originalBlob.size
      });

      let processedBlob: Blob = originalBlob;
      let file: File;

      // Process the blob based on recording mode
      if (recordingMode === 'audio') {
        // For audio, convert to WAV format
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = await originalBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Create a new audio buffer
        const offlineContext = new OfflineAudioContext(
          audioBuffer.numberOfChannels,
          audioBuffer.length,
          audioBuffer.sampleRate
        );
        
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        source.start();
        
        const renderedBuffer = await offlineContext.startRendering();
        const wavBlob = audioBufferToWav(renderedBuffer);
        processedBlob = new Blob([wavBlob], { type: 'audio/wav' });
        
        console.log('Converted audio to WAV:', {
          originalType: originalBlob.type,
          newType: processedBlob.type,
          originalSize: originalBlob.size,
          newSize: processedBlob.size
        });

        const now = new Date();
        const dateTime = getDateTimeString(now);
        const safeName = (recordingName || 'Recording').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `${dateTime}_${safeName}.wav`;

        file = new File([processedBlob], fileName, {
          type: 'audio/wav',
          lastModified: now.getTime()
        });
      } else if (recordingMode === 'video' || recordingMode === 'both') {
        // For video, convert to MP4 format
        const video = document.createElement('video');
        video.src = mediaBlobUrl;
        
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = () => reject(new Error('Failed to load video'));
        });
        
        // Create a MediaRecorder with MP4 format
        const stream = (video as any).captureStream();
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'
        });
        
        const chunks: Blob[] = [];
        
        await new Promise<void>((resolve, reject) => {
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunks.push(e.data);
            }
          };
          
          mediaRecorder.onstop = () => {
            processedBlob = new Blob(chunks, { type: 'video/mp4' });
            console.log('Converted video to MP4:', {
              originalType: originalBlob.type,
              newType: processedBlob.type,
              originalSize: originalBlob.size,
              newSize: processedBlob.size
            });
            resolve();
          };
          
          mediaRecorder.onerror = (e) => {
            reject(new Error('Failed to record video: ' + e));
          };
          
          try {
            mediaRecorder.start();
            video.play();
            
            video.onended = () => {
              mediaRecorder.stop();
            };
          } catch (error) {
            reject(new Error('Failed to start recording: ' + error));
          }
        });

        const now = new Date();
        const dateTime = getDateTimeString(now);
        const safeName = (recordingName || 'Recording').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `${dateTime}_${safeName}.mp4`;

        file = new File([processedBlob], fileName, {
          type: 'video/mp4',
          lastModified: now.getTime()
        });
      } else {
        // For unsupported modes, use original blob
        const now = new Date();
        const dateTime = getDateTimeString(now);
        const safeName = (recordingName || 'Recording').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `${dateTime}_${safeName}.${originalBlob.type.split('/')[1] || 'webm'}`;

        file = new File([processedBlob], fileName, {
          type: originalBlob.type,
          lastModified: now.getTime()
        });
      }

      console.log('Saving file to IndexedDB:', {
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified
      });

      // Save the file to IndexedDB
      await saveMedia({
        blob: file,
        type: recordingMode === 'audio' ? 'audio' : 'video',
        name: file.name,
        createdAt: new Date(),
        transcript: transcribedText,
        tags: selectedTags,
      });

      setSaveSuccess(true);
      setShowNameModal(false);
      setMediaBlobUrl(null);
      setRecordingName('');
      setSelectedTags([]);
      setTagInput('');
    } catch (error) {
      console.error('Error saving to IndexedDB:', error);
    }
  };

  return (
    <div className={`p-4 border rounded-lg ${theme === "dark" ? "bg-[#1f2937]" : "bg-white"} ${theme === "dark" ? "shadow-xl" : "shadow-md"}`}>
      <h2 className={`text-xl font-semibold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Live Transcription (AssemblyAI)</h2>
      
      {/* Recording Mode Selection */}
      <div className={`mb-4 flex flex-wrap gap-4 p-2 rounded-md ${theme === "dark" ? "bg-gray-700" : "bg-gray-50"} border ${theme === "dark" ? "border-gray-600" : "border-gray-200"}`}>
        <span className={`text-sm font-medium mr-2 ${theme === "dark" ? "text-white" : "text-gray-700"}`}>Recording Mode:</span>
        <label className={`flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
          <input
            type="radio"
            name="recordingMode"
            value="audio"
            checked={recordingMode === 'audio'}
            onChange={(e) => setRecordingMode(e.target.value as RecordingMode)}
            disabled={isRecording}
            className={`form-radio ${theme === "dark" ? "text-blue-400 focus:ring-blue-400" : "text-blue-600 focus:ring-blue-500"}`}
          />
          <Mic className="w-5 h-5" />
          Audio Only
        </label>
        <label className={`flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
          <input
            type="radio"
            name="recordingMode"
            value="video"
            checked={recordingMode === 'video'}
            onChange={(e) => setRecordingMode(e.target.value as RecordingMode)}
            disabled={isRecording}
            className={`form-radio ${theme === "dark" ? "text-blue-400 focus:ring-blue-400" : "text-blue-600 focus:ring-blue-500"}`}
          />
          <Video className="w-5 h-5" />
          Video Only
        </label>
        <label className={`flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
          <input
            type="radio"
            name="recordingMode"
            value="both"
            checked={recordingMode === 'both'}
            onChange={(e) => setRecordingMode(e.target.value as RecordingMode)}
            disabled={isRecording}
            className={`form-radio ${theme === "dark" ? "text-blue-400 focus:ring-blue-400" : "text-blue-600 focus:ring-blue-500"}`}
          />
          <div className="flex gap-1">
            <Mic className="w-5 h-5" />
            <Video className="w-5 h-5" />
          </div>
          Audio + Video
        </label>
      </div>

      {/* Video Preview */}
      {(recordingMode === 'video' || recordingMode === 'both') && (
        <div className={`mb-4 rounded-lg overflow-hidden ${theme === "dark" ? "bg-gray-700" : "bg-gray-100"} border ${theme === "dark" ? "border-gray-600" : "border-gray-200"}`}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-auto max-h-96 object-contain"
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex md:flex-nowrap flex-wrap gap-3 mb-4">
        <button
          onClick={isRecording ? stopTranscription : startTranscription}
          className={`flex-1 sm:flex-none px-4 py-2 rounded flex items-center gap-2 ${
            isRecording ? 'bg-red-500' : 'bg-blue-500'
          } text-white`}
        >
          {isRecording ? (
            <>
              <Square className="w-5 h-5" />
              Stop Recording
            </>
          ) : (
            <>
              {recordingMode === 'audio' ? (
                <Mic className="w-5 h-5" />
              ) : recordingMode === 'video' ? (
                <Video className="w-5 h-5" />
              ) : (
                <div className="flex gap-1">
                  <Mic className="w-5 h-5" />
                  <Video className="w-5 h-5" />
                </div>
              )}
              Start Recording
            </>
          )}
        </button>
        {mediaBlobUrl && (
          <>
            <button
              onClick={() => setShowNameModal(true)}
              className="flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white rounded-md shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <CheckCircle className="w-5 h-5 inline-block mr-2" />
              Save Recording
            </button>
            <a
              href={mediaBlobUrl}
              download={recordingMode === 'audio' ? 'recording.webm' : 'recording.webm'}
              className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Download className="w-5 h-5 inline-block mr-2" />
              Download
            </a>
          </>
        )}
      </div>

      {/* Recording Preview */}
      {mediaBlobUrl && (
        <div className={`mb-4 ${theme === "dark" ? "bg-gray-700" : "bg-gray-100"} rounded-lg overflow-hidden border ${theme === "dark" ? "border-gray-600" : "border-gray-200"}`}>
          {recordingMode === 'audio' ? (
            <audio src={mediaBlobUrl} controls className="w-full p-2" />
          ) : (
            <video src={mediaBlobUrl} controls className="w-full h-auto max-h-96 object-contain p-2" />
          )}
        </div>
      )}

      {/* Transcription Output */}
      {(recordingMode === 'audio' || recordingMode === 'both') && (
        <div className={`mb-4 min-h-[4em] ${theme === "dark" ? "bg-gray-700" : "bg-gray-50"} p-3 rounded-lg border ${theme === "dark" ? "border-gray-600" : "border-gray-200"} ${theme === "dark" ? "text-white" : "text-gray-800"} text-sm md:text-base break-words overflow-auto`}>
          <span className="font-mono whitespace-pre-wrap">{transcribedText}</span>
        </div>
      )}

      {saveSuccess && (
        <div className={`mb-4 p-3 ${theme === "dark" ? "bg-green-800" : "bg-green-100"} ${theme === "dark" ? "text-white" : "text-green-700"} rounded-lg shadow-md flex items-center`}>
          <CheckCircle className="w-6 h-6 mr-2" />
          Recording and transcript saved!
        </div>
      )}

      {/* Save Modal */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-opacity-60 backdrop-blur-sm p-4">
          <div className={`rounded-xl shadow-2xl p-6 sm:p-8 max-w-sm w-full relative transform transition-all duration-300 scale-100 opacity-100 ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}>
            <button
              className={`absolute top-4 right-4 text-3xl font-bold focus:outline-none transition-colors ${theme === "dark" ? "text-white hover:text-white" : "text-gray-400 hover:text-gray-700"}`}
              onClick={() => setShowNameModal(false)}
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className={`text-xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
              Save New Recording
            </h3>
            <label htmlFor="recordingName" className={`block font-semibold mb-2 ${theme === "dark" ? "text-white" : "text-gray-700"}`}>
              Recording Name:
            </label>
            <input
              id="recordingName"
              type="text"
              className={`border ${theme === "dark" ? "border-gray-600" : "border-gray-300"} rounded-lg px-4 py-2 w-full mb-4 ${theme === "dark" ? "bg-gray-800 text-white" : "bg-white text-gray-900"} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="Enter a name for this recording"
              value={recordingName}
              onChange={(e) => setRecordingName(e.target.value)}
              autoFocus
            />

            {/* Tag selection UI */}
            <div className="mb-6">
              <div className={`font-semibold mb-2 ${theme === "dark" ? "text-white" : "text-gray-700"}`}>Tags:</div>
              {/* Selected tags as chips */}
              <div className="flex flex-wrap gap-2 mb-3 max-h-24 overflow-y-auto pr-2">
                {selectedTags.map((tag, idx) => (
                  <span
                    key={tag.name + idx}
                    className="flex items-center px-3 py-1 rounded-full text-xs font-medium mr-1 shadow-sm"
                    style={{ backgroundColor: tag.color, color: '#fff' }}
                  >
                    {tag.name}
                    <button
                      type="button"
                      className="ml-2 text-white hover:text-gray-200 focus:outline-none p-0.5 rounded-full hover:bg-black hover:bg-opacity-20 transition-colors"
                      onClick={() => setSelectedTags(selectedTags.filter((t, i) => i !== idx))}
                      aria-label={`Remove tag ${tag.name}`}
                    >
                      <XCircle className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              {/* Searchable tag input */}
              <input
                type="text"
                className={`border ${theme === "dark" ? "border-gray-600" : "border-gray-300"} rounded-lg px-4 py-2 w-full mb-2 ${theme === "dark" ? "bg-gray-800 text-white" : "bg-white text-gray-900"} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="Search or add tag (e.g., Urgent)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    const exists = selectedTags.some(t => t.name.toLowerCase() === tagInput.trim().toLowerCase());
                    if (!exists && selectedTags.length < 100) {
                      const found = predefinedTags.find(t => t.name.toLowerCase() === tagInput.trim().toLowerCase());
                      const newTag: Tag = found || { name: tagInput.trim(), color: '#607d8b' };
                      setSelectedTags([...selectedTags, newTag]);
                      setTagInput('');
                    }
                    e.preventDefault();
                  }
                }}
              />
              {/* Tag suggestions dropdown */}
              {tagInput.trim() && (
                <div className={`absolute left-0 right-0 mt-1 ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} rounded-lg shadow-xl max-h-40 overflow-y-auto z-10`}>
                  {predefinedTags
                    .filter(
                      t =>
                        t.name.toLowerCase().includes(tagInput.trim().toLowerCase()) &&
                        !selectedTags.some(st => st.name.toLowerCase() === t.name.toLowerCase())
                    )
                    .map(tag => (
                      <button
                        key={tag.name}
                        type="button"
                        className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${theme === "dark" ? "hover:bg-gray-700 text-white" : "hover:bg-gray-100 text-gray-800"}`}
                        style={{ color: tag.color }}
                        onClick={() => {
                          setSelectedTags([...selectedTags, tag]);
                          setTagInput('');
                        }}
                      >
                        {tag.name}
                      </button>
                    ))}
                  {/* Option to add new tag if not found */}
                  {!predefinedTags.some(t => t.name.toLowerCase() === tagInput.trim().toLowerCase()) &&
                    !selectedTags.some(t => t.name.toLowerCase() === tagInput.trim().toLowerCase()) && (
                      <button
                        type="button"
                        className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${theme === "dark" ? "hover:bg-gray-700 text-white" : "hover:bg-gray-100 text-gray-700"}`}
                        onClick={() => {
                          setSelectedTags([
                            ...selectedTags,
                            { name: tagInput.trim(), color: '#607d8b' },
                          ]);
                          setTagInput('');
                        }}
                      >
                        <>Add "<span className="font-semibold">{tagInput.trim()}</span>"</>
                      </button>
                    )}
                </div>
              )}
              <div className={`text-xs mt-2 ${theme === "dark" ? "text-white" : "text-gray-500"}`}>
                Select up to 100 tags. Type to search or add new tags.
              </div>
            </div>

            <div className={`flex justify-end gap-3 pt-4 border-t ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
              <button
                className={`px-5 py-2 rounded-md hover:bg-gray-300 transition-colors ${theme === "dark" ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-gray-200 text-gray-800"}`}
                onClick={() => {
                  setShowNameModal(false);
                  setRecordingName('');
                  setSelectedTags([]);
                  setTagInput('');
                }}
              >
                Cancel
              </button>
              <button
                className={`px-5 py-2 bg-blue-600 text-white rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === "dark" ? "focus:ring-offset-gray-800" : "focus:ring-offset-2"} transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
                onClick={saveToIndexedDB}
                disabled={!recordingName.trim()}
              >
                Save Recording
              </button>
            </div>
          </div>
      </div>
      )}
    </div>
  );
};

export default AssemblyAITranscriber;
