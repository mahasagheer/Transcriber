import React, { useState, useRef, useEffect } from 'react';
import { ReactMediaRecorder } from 'react-media-recorder';
import { saveMedia, Tag } from '../../lib/db';
import { useTheme } from '../../context/ThemeContext';
import { Mic, Square, X, Download, CheckCircle, Trash2, Video, PlusCircle, XCircle } from 'lucide-react';

const isBrowser = typeof window !== 'undefined';
// @ts-ignore
const SpeechRecognition =
  isBrowser && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

const MediaRecorderWithSpeechRecognition: React.FC = () => {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [mediaBlobUrl, setMediaBlobUrl] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const recognitionRef = useRef<any>(null);
  const lastSavedBlobUrl = useRef<string | null>(null);
  const [mode, setMode] = useState<'audio' | 'video' | 'both'>('video');
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingBlobUrl, setPendingBlobUrl] = useState<string | null>(null);
  const [pendingTranscript, setPendingTranscript] = useState<string>('');
  const [recordingName, setRecordingName] = useState('');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState('');
  const { theme } = useTheme();

  const predefinedTags: Tag[] = [
    { name: 'Angry', color: '#f44336' },
    { name: 'Meeting', color: '#1976d2' },
    { name: 'Urgent', color: '#ff9800' },
    { name: 'Feedback', color: '#4caf50' },
    { name: 'Client Call', color: '#9c27b0' },
  ];

  // Helper to format date and time
  function getDateTimeString(date: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return (
      date.getFullYear() +
      '-' + pad(date.getMonth() + 1) +
      '-' + pad(date.getDate()) +
      '_' + pad(date.getHours()) +
      '-' + pad(date.getMinutes()) +
      '-' + pad(date.getSeconds())
    );
  }

  // Helper to get extension from blob type
  function getExtension(blob: Blob) {
    if (blob.type.includes('mp3')) return 'mp3';
    if (blob.type.includes('wav')) return 'wav';
    if (blob.type.includes('webm')) return 'webm';
    if (blob.type.includes('mp4')) return 'mp4';
    if (blob.type.includes('ogg')) return 'ogg';
    if (blob.type.includes('mpeg')) return 'mp3';
    if (blob.type.includes('quicktime')) return 'mov';
    return 'dat';
  }

  // Start speech recognition
  const startRecognition = () => {
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) {
        setTranscript(prev => (prev ? prev + ' ' : '') + final.trim());
      }
      setInterimTranscript(interim);
    };
    recognition.onerror = (event: any) => {
      // Optionally handle errors
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  // Stop speech recognition
  const stopRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setInterimTranscript('');
  };

  // Reset transcript on new recording
  useEffect(() => {
    if (!recording) {
      setInterimTranscript('');
    } else {
      setTranscript('');
      setInterimTranscript('');
      setSaveSuccess(false);
    }
  }, [recording]);

  // Save to IndexedDB when user confirms name in modal
  const saveToIndexedDB = async (blobUrl: string, transcript: string, name: string, tags: Tag[]) => {
    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      const ext = getExtension(blob);
      const now = new Date();
      const dateTime = getDateTimeString(now);
      const safeName = (name || 'Recording').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `${dateTime}_${safeName}.${ext}`;
      await saveMedia({
        blob,
        type: mode === 'audio' ? 'audio' : 'video',
        name: fileName,
        createdAt: now,
        transcript,
        tags,
      });
      setSaveSuccess(true);
      lastSavedBlobUrl.current = blobUrl;
    } catch (err) {
      setSaveSuccess(false);
    }
  };

  return (
    <div className={`mb-8 p-4 border rounded-lg ${ theme === "dark" ? "bg-[#1f2937]":"bg-white"} ${theme === "dark" ? "shadow-xl":"shadow-md"}`}>
      <h2 className={`text-xl sm:text-2xl font-semibold mb-4 ${theme === "dark" ? "text-white":"text-gray-900"}`}>Recorder with Live Transcription</h2>
      {/* Mode selection */}
      <div className={`mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 p-2 rounded-md ${theme === "dark" ? "bg-gray-700":"bg-gray-50"} border ${theme === "dark" ? "border-gray-600":"border-gray-200"}`}>
        <span className={`text-sm font-medium mr-2 ${theme === "dark" ? "text-white":"text-gray-700"}`}>Recording Mode:</span>
        <label className={`flex items-center gap-1 ${theme === "dark" ? "text-white":"text-gray-800"}`}>
          <input
            type="radio"
            name="mode"
            value="audio"
            checked={mode === 'audio'}
            onChange={() => setMode('audio')}
            disabled={recording}
            className={`form-radio ${theme === "dark" ? "text-blue-400 focus:ring-blue-400":"text-blue-600 focus:ring-blue-500"}`}
          />
          Audio Only
        </label>
        <label className={`flex items-center gap-1 ${theme === "dark" ? "text-white":"text-gray-800"}`}>
          <input
            type="radio"
            name="mode"
            value="video"
            checked={mode === 'video'}
            onChange={() => setMode('video')}
            disabled={recording}
            className={`form-radio ${theme === "dark" ? "text-blue-400 focus:ring-blue-400":"text-blue-600 focus:ring-blue-500"}`}
          />
          Video Only
        </label>
        <label className={`flex items-center gap-1 ${theme === "dark" ? "text-white":"text-gray-800"}`}>
          <input
            type="radio"
            name="mode"
            value="both"
            checked={mode === 'both'}
            onChange={() => setMode('both')}
            disabled={recording}
            className={`form-radio ${theme === "dark" ? "text-blue-400 focus:ring-blue-400":"text-blue-600 focus:ring-blue-500"}`}
          />
          Audio + Video
        </label>
      </div>
      <ReactMediaRecorder
        video={mode === 'video' || mode === 'both'}
        audio={mode === 'audio' || mode === 'both'}
        render={({
          status,
          startRecording,
          stopRecording,
          mediaBlobUrl: blobUrl,
          previewStream,
          clearBlobUrl,
        }) => {
          // Start/stop recognition based on recording state
          useEffect(() => {
            if (status === 'recording') {
              setRecording(true);
              startRecognition();
            } else {
              setRecording(false);
              stopRecognition();
            }
          }, [status]);

          useEffect(() => {
            setMediaBlobUrl(blobUrl || null);
            // When recording stops and we have a new blobUrl, show the name modal
            if (status === 'stopped' && blobUrl && blobUrl !== lastSavedBlobUrl.current) {
              setPendingBlobUrl(blobUrl);
              setPendingTranscript(transcript);
              setShowNameModal(true);
              setRecordingName('');
              setSelectedTags([]);
              setTagInput('');
            }
          }, [blobUrl, status, transcript]);

          return (
            <div>
              <div className={`mb-4 ${theme === "dark" ? "text-white":"text-gray-800"}`}>
                <span className="font-medium">Status:</span> {status}
                {status === 'recording' && (
                  <span className={`ml-4 font-bold animate-pulse ${theme === "dark" ? "text-red-400":"text-red-600"}`}>● Recording...</span>
                )}
              </div>
              {/* Only show video preview if video is enabled */}
              {(mode === 'video' || mode === 'both') && (
                <div className={`mb-4 ${theme === "dark" ? "bg-gray-700":"bg-gray-100"} rounded-lg overflow-hidden border ${theme === "dark" ? "border-gray-600":"border-gray-200"} shadow-inner ${theme === "dark" ? "shadow-none":"shadow-inner"} min-h-[150px] sm:min-h-[200px]`} style={{ display: previewStream ? 'block' : 'none' }}>
                  <video
                    style={{ width: '100%', height: 'auto', background: '#eee' }}
                    ref={videoEl => {
                      if (videoEl && previewStream) {
                        if (videoEl.srcObject !== previewStream) {
                          videoEl.srcObject = previewStream;
                          videoEl.play();
                        }
                      }
                    }}
                    muted
                    autoPlay
                    playsInline
                    className="object-cover w-full h-full"
                  />
                </div>
              )}
              <div className="flex md:flex-nowrap flex-wrap gap-3 mb-4">
                <button
                  onClick={startRecording}
                  className={`flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === "dark" ? "focus:ring-offset-gray-800":"focus:ring-offset-2"} transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
                  disabled={status === 'recording'}
                >
                  {(mode === 'video' || mode === 'both') ? (
                    <Video className="w-5 h-5 inline-block mr-2" />
                  ) : (
                    <Mic className="w-5 h-5 inline-block mr-2" />
                  )}
                  Start Recording
                </button>
                <button
                  onClick={stopRecording}
                  className={`flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white rounded-md shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 ${theme === "dark" ? "focus:ring-offset-gray-800":"focus:ring-offset-2"} transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
                  disabled={status !== 'recording'}
                >
                  <Square className="w-5 h-5 inline-block mr-2" />
                  Stop Recording
                </button>
                <button
                  onClick={clearBlobUrl}
                  className={`flex-1 sm:flex-none px-4 py-2 bg-gray-500 text-white rounded-md shadow-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 ${theme === "dark" ? "focus:ring-offset-gray-800":"focus:ring-offset-2"} transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
                  disabled={status === 'recording'}
                >
                  <Trash2 className="w-5 h-5 inline-block mr-2" />
                  Clear
                </button>
                {mediaBlobUrl && (
                  <a
                    href={mediaBlobUrl}
                    download={mode === 'audio' ? 'recording.wav' : 'recording.webm'}
                    className={`flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white rounded-md shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 ${theme === "dark" ? "focus:ring-offset-gray-800":"focus:ring-offset-2"} transition-all duration-200`}
                  >
                    <Download className="w-5 h-5 inline-block mr-2" />
                    Download
                  </a>
                )}
              </div>
              {mediaBlobUrl && (
                <div className={`mb-4 ${theme === "dark" ? "bg-gray-700":"bg-gray-100"} rounded-lg overflow-hidden border ${theme === "dark" ? "border-gray-600":"border-gray-200"} shadow-inner ${theme === "dark" ? "shadow-none":"shadow-inner"}`}>
                  {mode === 'audio' ? (
                    <audio src={mediaBlobUrl} controls className="w-full p-2" />
                  ) : (
                    <video src={mediaBlobUrl} controls className="w-full h-auto max-h-96 object-contain p-2" />
                  )}
                </div>
              )}
              {/* Live transcript below the recorder */}
              <div className={`mb-4 min-h-[4em] ${theme === "dark" ? "bg-gray-700":"bg-gray-50"} p-3 rounded-lg border ${theme === "dark" ? "border-gray-600":"border-gray-200"} ${theme === "dark" ? "text-white":"text-gray-800"} text-sm md:text-base break-words overflow-auto shadow-inner ${theme === "dark" ? "shadow-none":"shadow-inner"}`}>
                <span className="font-mono whitespace-pre-wrap">{transcript} {recording && interimTranscript ? <span className={`text-gray-400 ${theme === "dark" ? "text-white":"text-gray-500"} animate-pulse-slow`}>{interimTranscript}</span> : null}</span>
              </div>
              {saveSuccess && (
                <div className={`mb-4 p-3 ${theme === "dark" ? "bg-green-800":"bg-green-100"} ${theme === "dark" ? "text-white":"text-green-700"} rounded-lg shadow-md flex items-center`}>
                  <CheckCircle className="w-6 h-6 mr-2" />
                  Recording and transcript saved!
                </div>
              )}
              {/* Name modal popup */}
              {showNameModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-opacity-60 backdrop-blur-sm p-4">
                  <div className={`rounded-xl shadow-2xl p-6 sm:p-8 max-w-sm w-full relative transform transition-all duration-300 scale-100 opacity-100 ${theme === "dark" ? "bg-gray-900":"bg-white"}`}>
                    <button
                      className={`absolute top-4 right-4 text-3xl font-bold focus:outline-none transition-colors ${theme === "dark" ? "text-white hover:text-white":"text-gray-400 hover:text-gray-700"}`}
                      onClick={() => setShowNameModal(false)}
                      aria-label="Close"
                    ><X className="w-6 h-6" /></button>
                    <h3 className={`text-xl font-bold mb-4 ${theme === "dark" ? "text-white":"text-gray-900"}`}>
                      Save New Recording
                    </h3>
                    <label htmlFor="recordingName" className={`block font-semibold mb-2 ${theme === "dark" ? "text-white":"text-gray-700"}`}>Recording Name:</label>
                    <input
                      id="recordingName"
                      type="text"
                      className={`border ${theme === "dark" ? "border-gray-600":"border-gray-300"} rounded-lg px-4 py-2 w-full mb-4 ${theme === "dark" ? "bg-gray-800 text-white":"bg-white text-gray-900"} focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === "dark" ? "focus:ring-blue-400":""} transition-colors`}
                      placeholder="Enter a name for this recording (e.g., Meeting Summary)"
                      value={recordingName}
                      onChange={e => setRecordingName(e.target.value)}
                      autoFocus
                    />
                    {/* Tag selection UI */}
                    <div className="mb-6">
                      <div className={`font-semibold mb-2 ${theme === "dark" ? "text-white":"text-gray-700"}`}>Tags:</div>
                      {/* Selected tags as chips */}
                      <div className="flex flex-wrap gap-2 mb-3 max-h-24 overflow-y-auto pr-2">
                        {selectedTags.map((tag, idx) => (
                          <span
                            key={tag.name + idx}
                            className={`flex items-center px-3 py-1 rounded-full text-xs font-medium mr-1 ${theme === "dark" ? "bg-blue-800 text-white":"bg-blue-100 text-blue-800"} shadow-sm`}
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
                        className={`border ${theme === "dark" ? "border-gray-600":"border-gray-300"} rounded-lg px-4 py-2 w-full mb-2 ${theme === "dark" ? "bg-gray-800 text-white":"bg-white text-gray-900"} focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === "dark" ? "focus:ring-blue-400":""} transition-colors`}
                        placeholder="Search or add tag (e.g., Urgent)"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && tagInput.trim()) {
                            // Add new tag if not already selected
                            const exists = selectedTags.some(t => t.name.toLowerCase() === tagInput.trim().toLowerCase());
                            if (!exists && selectedTags.length < 100) {
                              // Check if tag exists in predefinedTags
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
                        <div className={`absolute left-0 right-0 mt-1 ${theme === "dark" ? "bg-gray-800 border-gray-700":"bg-white border-gray-200"} rounded-lg shadow-xl max-h-40 overflow-y-auto z-10`}>
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
                                className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${theme === "dark" ? "hover:bg-gray-700 text-white":"hover:bg-gray-100 text-gray-800"}`}
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
                                className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${theme === "dark" ? "hover:bg-gray-700 text-white":"hover:bg-gray-100 text-gray-700"}`}
                                onClick={() => {
                                  setSelectedTags([
                                    ...selectedTags,
                                    { name: tagInput.trim(), color: '#607d8b' }, // default color for new tags
                                  ]);
                                  setTagInput('');
                                }}
                              >
                                <>Add "<span className="font-semibold">{tagInput.trim()}</span>"</>
                              </button>
                            )}
                        </div>
                      )}
                      <div className={`text-xs mt-2 ${theme === "dark" ? "text-white":"text-gray-500"}`}>Select up to 100 tags. Type to search or add new tags.</div>
                    </div>
                    <div className={`flex justify-end gap-3 pt-4 border-t ${theme === "dark" ? "border-gray-700":"border-gray-200"}`}>
                      <button
                        className={`px-5 py-2 rounded-md hover:bg-gray-300 transition-colors ${theme === "dark" ? "bg-gray-700 hover:bg-gray-600 text-white":"bg-gray-200 text-gray-800"}`}
                        onClick={() => { setShowNameModal(false); setPendingBlobUrl(null); setPendingTranscript(''); setRecordingName(''); setSelectedTags([]); setTagInput(''); }}
                      >
                        Cancel
                      </button>
                      <button
                        className={`px-5 py-2 bg-blue-600 text-white rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === "dark" ? "focus:ring-offset-gray-800":"focus:ring-offset-2"} transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
                        onClick={async () => {
                          if (pendingBlobUrl) {
                            await saveToIndexedDB(pendingBlobUrl, pendingTranscript, recordingName, selectedTags);
                          }
                          setShowNameModal(false);
                          setPendingBlobUrl(null);
                          setPendingTranscript('');
                          setRecordingName('');
                          setSelectedTags([]);
                          setTagInput('');
                        }}
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
        }}
      />
    </div>
  );
};

export default MediaRecorderWithSpeechRecognition; 