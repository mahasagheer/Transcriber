import React, { useEffect, useState, useCallback } from 'react';
import { getAllMedia, updateMedia, deleteMedia, Media, Tag, getMediaById } from '../../lib/db';
import MediaEditModal from './MediaEditModal';
import TranscriptionResultsModal from './TranscriptionResultsModal';
import { useTheme } from '../../context/ThemeContext';
import { Search, SlidersHorizontal, Trash2, Pencil, Tag as TagIcon, AudioWaveform, Video, MoreHorizontal, Shrink, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { analyzeMedia } from '../../helpers/assemblyAI';

const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2;
  const buffer2 = new ArrayBuffer(44 + length);
  const view = new DataView(buffer2);
  const channels = [];
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
      let sample = Math.max(-1, Math.min(1, channels[i][pos]));
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
};

interface MediaWithDuration extends Media {
  duration?: number;
  transcript?: string;
  summary?: string;
  sentiment?: {
    overall: string;
    confidence: number;
    details?: {
      positive: number;
      negative: number;
      neutral: number;
    };
  };
}

const MediaLibrary: React.FC = () => {
  const [mediaList, setMediaList] = useState<MediaWithDuration[]>([]);
  const [filteredMediaList, setFilteredMediaList] = useState<MediaWithDuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTags, setExpandedTags] = useState<{ [id: number]: boolean }>({});
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [minDurationFilter, setMinDurationFilter] = useState<string>('');
  const [maxDurationFilter, setMaxDurationFilter] = useState<string>('');
  const [selectedFilterTags, setSelectedFilterTags] = useState<Set<string>>(new Set());
  const [analyzingMediaId, setAnalyzingMediaId] = useState<number | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [transcriptionResults, setTranscriptionResults] = useState<{
    transcript: string;
    summary: string;
    sentiment: {
      overall: string;
      confidence: number;
      details?: {
        positive: number;
        negative: number;
        neutral: number;
      };
    };
  } | null>(null);
  const [pendingMediaId, setPendingMediaId] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const { theme, toggleTheme } = useTheme();

  const toggleExpand = (id: number) => {
    console.log('Toggle expand called for id:', id);
    console.log('Current expandedItems:', Array.from(expandedItems));
    
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      console.log('New expandedItems:', Array.from(next));
      return next;
    });
  };

  const calculateMediaDuration = useCallback(async (media: Media): Promise<number | undefined> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(media.blob);
      const mediaElement = media.type.startsWith('audio') ? new Audio() : document.createElement('video');
      mediaElement.src = url;
      mediaElement.onloadedmetadata = () => {
        console.log(`Media ${media.name} loaded metadata, duration: ${mediaElement.duration}`);
        resolve(mediaElement.duration);
        URL.revokeObjectURL(url);
      };
      mediaElement.onerror = (e) => {
        console.error(`Error loading media ${media.name}:`, e);
        resolve(undefined);
        URL.revokeObjectURL(url);
      };
    });
  }, []);

  const fetchMedia = useCallback(async () => {
    console.log('Fetching media...');
    setLoading(true);
    try {
      const media = await getAllMedia();
      console.log('Got media from DB:', media);
      const mediaWithDurations: MediaWithDuration[] = await Promise.all(
        media.map(async (m) => ({
          ...m,
          duration: await calculateMediaDuration(m),
        }))
      );
      const sorted = mediaWithDurations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMediaList(sorted);
      console.log('Media list updated with durations:', sorted);
    } catch (error) {
      console.error('Error fetching media:', error);
    } finally {
      setLoading(false);
      console.log('Loading set to false.');
    }
  }, [calculateMediaDuration]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  useEffect(() => {
    filterMedia();
  }, [searchQuery, mediaList, minDurationFilter, maxDurationFilter, selectedFilterTags]);

  useEffect(() => {
    const tagsSet = new Map<string, Tag>();
    mediaList.forEach(m => (m.tags || []).forEach(tag => tagsSet.set(tag.name, tag)));
    setAllTags(Array.from(tagsSet.values()));
  }, [mediaList]);

  const filterMedia = useCallback(() => {
    let currentFilteredList = mediaList;

    const query = searchQuery.toLowerCase();
    if (query) {
      currentFilteredList = currentFilteredList.filter((m) => m.name.toLowerCase().includes(query));
    }

    const minDuration = parseFloat(minDurationFilter);
    const maxDuration = parseFloat(maxDurationFilter);

    if (!isNaN(minDuration) && minDuration >= 0) {
      currentFilteredList = currentFilteredList.filter(m => m.duration !== undefined && m.duration >= minDuration);
    }
    if (!isNaN(maxDuration) && maxDuration >= 0) {
      currentFilteredList = currentFilteredList.filter(m => m.duration !== undefined && m.duration <= maxDuration);
    }

    if (selectedFilterTags.size > 0) {
      currentFilteredList = currentFilteredList.filter(m =>
        m.tags && m.tags.some(tag => selectedFilterTags.has(tag.name))
      );
    }

    setFilteredMediaList(currentFilteredList);
  }, [searchQuery, mediaList, minDurationFilter, maxDurationFilter, selectedFilterTags]);

  const toggleSelect = (id: number) => {
    const updated = new Set(selectedMediaIds);
    updated.has(id) ? updated.delete(id) : updated.add(id);
    setSelectedMediaIds(updated);
  };

  const handleDelete = async () => {
    if (selectedMediaIds.size === 0) return;
    if (!confirm(`Delete ${selectedMediaIds.size} selected file(s)?`)) return;

    for (const id of selectedMediaIds) {
      await deleteMedia(id);
    }

    await fetchMedia();
    setSelectedMediaIds(new Set());
  };

  const openEditModal = (media: Media) => {
    setSelectedMedia(media);
    setEditModalOpen(true);
  };

  const handleEditSave = async (name: string, tags: Tag[]) => {
    if (!selectedMedia) return;
    await updateMedia({ ...selectedMedia, name, tags });
    setEditModalOpen(false);
    setSelectedMedia(null);
    await fetchMedia();
  };

  const toggleFilterTag = (tagName: string) => {
    setSelectedFilterTags(prev => {
      const next = new Set(prev);
      next.has(tagName) ? next.delete(tagName) : next.add(tagName);
      return next;
    });
  };
  const handleGenerateSummary = async (media: Media) => {
    if (!media.id) return;
    
    setAnalyzingMediaId(media.id);
    setAnalysisError(null);
    
    try {
      console.log('Starting analysis for media:', {
        id: media.id,
        name: media.name,
        type: media.type
      });
  
      if (media.type !== 'audio' && !media.blob.type.startsWith('audio/')) {
        throw new Error(`Unsupported media type: ${media.type}. Only audio files are supported.`);
      }
  
      let audioFile: File;
      if (media.blob.type === 'audio/wav') {
        audioFile = new File([media.blob], media.name, {
          type: 'audio/wav'
        });
      } else {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = await media.blob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
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
        const wavBlobWithType = new Blob([wavBlob], { type: 'audio/wav' });
        
        audioFile = new File([wavBlobWithType], media.name.replace(/\.[^/.]+$/, '.wav'), {
          type: 'audio/wav'
        });
      }
  
      const transcriptionResult = await analyzeMedia(audioFile);
      console.log('Transcription result:', transcriptionResult);
  
      const updatedMedia = {
        ...media,
        transcript: transcriptionResult.text || transcriptionResult.transcript,
        summary: transcriptionResult.summary,
        sentiment: {
          overall: transcriptionResult.sentiment ? 'positive' : 'negative',
          confidence: 1.0,
          details: {
            positive: transcriptionResult.sentiment ? 1.0 : 0.0,
            negative: transcriptionResult.sentiment ? 0.0 : 1.0,
            neutral: 0.0
          }
        }
      };
  
      // Update state and immediately expand the accordion
      setMediaList(prevList => 
        prevList.map(item => item.id === media.id ? updatedMedia : item)
      );
  
      setFilteredMediaList(prevList => 
        prevList.map(item => item.id === media.id ? updatedMedia : item)
      );
  
      // Force the accordion to expand by adding the media ID to expandedItems
      setExpandedItems(prev => {
        const newSet = new Set(prev);
        newSet.add(media.id!);
        return newSet;
      });
  
    } catch (error) {
      console.error('Error in analysis process:', error);
      setAnalysisError(error instanceof Error ? error.message : 'Failed to analyze media. Please try again.');
    } finally {
      setAnalyzingMediaId(null);
    }
  };
  const handleSaveResults = async () => {
    if (!pendingMediaId || !transcriptionResults) return;

    try {
      await updateTranscriptionData(pendingMediaId, transcriptionResults);
      await fetchMedia();
      setShowResultsModal(false);
      setTranscriptionResults(null);
      setPendingMediaId(null);
    } catch (error) {
      console.error('Error saving transcription results:', error);
      setAnalysisError('Failed to save transcription results. Please try again.');
    }
  };

  const updateTranscriptionData = async (id: number, transcription: { 
    transcript: string; 
    summary: string; 
    sentiment: { 
      overall: string; 
      confidence: number; 
      details?: { 
        positive: number; 
        negative: number; 
        neutral: number; 
      }; 
    }; 
  }) => {
    console.log('updateTranscriptionData called with ID:', id);
    try {
      const existingMedia = await getMediaById(id);
      if (!existingMedia) {
        console.error(`Media with ID ${id} not found`);
        throw new Error('Media not found');
      }
      
      const updatedMedia = {
        ...existingMedia,
        transcript: transcription.transcript,
        summary: transcription.summary,
        sentiment: transcription.sentiment
      };
      
      await updateMedia(updatedMedia);
      console.log('Media record updated successfully');
    } catch (error) {
      console.error(`Error in updateTranscriptionData for media ${id}:`, error);
      throw error;
    }
  };

  return (
    <div className={`p-4 sm:p-6 lg:p-8 rounded-lg shadow-xl ${theme === "dark" ? "bg-gray-800 text-gray-100":"bg-white text-gray-900"}`}>
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 sm:gap-6">
        <div className="relative w-full sm:w-64 md:w-80 lg:w-96">
          <Search size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme === "dark" ? "text-gray-500":"text-gray-400"}`} />
          <input
            type="text"
            placeholder="Search recordings..."
            className={`pl-10 pr-4 py-2 rounded-full w-full border shadow-sm transition-all focus:outline-none focus:ring-2 ${theme === "dark" ? "border-gray-600 bg-gray-700 text-gray-100 focus:ring-blue-400":"border-gray-300 bg-white text-gray-900 focus:ring-blue-500"}`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            className={`flex items-center justify-center px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 ${theme === "dark" ? "bg-gray-700 text-gray-200 hover:bg-gray-600 focus:ring-gray-500":"bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-400"}`}
            onClick={() => setShowFilters(!showFilters)}
            aria-label={showFilters ? 'Hide Filters' : 'Show Filters'}
          >
            <SlidersHorizontal size={16} />
            <span className="sr-only">{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
          </button>
          <button
            className={`flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-full text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm ${theme === "dark" ? "focus:ring-offset-gray-800":"focus:ring-offset-white"}`}
            disabled={selectedMediaIds.size === 0}
            onClick={handleDelete}
            aria-label={`Delete Selected (${selectedMediaIds.size})`}
          >
            <Trash2 size={16} className="mr-2" />
            <span className="sr-only">Delete Selected</span> ({selectedMediaIds.size})
          </button>
        </div>
      </div>

      {showFilters && (
        <div className={`mb-8 p-4 md:p-6 rounded-lg transition-all duration-300 ease-in-out ${theme === "dark" ? "border-gray-700 bg-gray-800 shadow-none":"border-gray-200 bg-gray-50 shadow-inner"}`}>
          <h3 className={`text-lg font-semibold mb-4 ${theme === "dark" ? "text-gray-200":"text-gray-800"}`}>Filters</h3>
          <div className={`mb-4 p-4 rounded-md border ${theme === "dark" ? "bg-gray-700 border-gray-600":"bg-gray-100 border-gray-200"}`}>
            <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-200":"text-gray-700"}`}>Duration (seconds):</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="number"
                placeholder="Min (s)"
                className={`px-4 py-2 rounded-lg w-full sm:w-1/2 text-sm shadow-sm focus:outline-none focus:ring-2 ${theme === "dark" ? "border-gray-600 bg-gray-700 text-gray-100 focus:ring-blue-400":"border-gray-300 bg-white text-gray-900 focus:ring-blue-500"}`}
                value={minDurationFilter}
                onChange={(e) => setMinDurationFilter(e.target.value)}
              />
              <input
                type="number"
                placeholder="Max (s)"
                className={`px-4 py-2 rounded-lg w-full sm:w-1/2 text-sm shadow-sm focus:outline-none focus:ring-2 ${theme === "dark" ? "border-gray-600 bg-gray-700 text-gray-100 focus:ring-blue-400":"border-gray-300 bg-white text-gray-900 focus:ring-blue-500"}`}
                value={maxDurationFilter}
                onChange={(e) => setMaxDurationFilter(e.target.value)}
              />
            </div>
          </div>

          <div className={`p-4 rounded-md border ${theme === "dark" ? "bg-gray-700 border-gray-600":"bg-gray-100 border-gray-200"}`}>
            <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-200":"text-gray-700"}`}>Filter by Tags:</label>
            {allTags.length === 0 ? (
              <div className={`text-sm p-2 rounded-md ${theme === "dark" ? "text-gray-400 bg-gray-700":"text-gray-500 bg-gray-100"}`}>No tags available.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => {
                  const isSelected = selectedFilterTags.has(tag.name);
                  return (
                    <button
                      key={tag.name}
                      className={`flex items-center px-4 py-2 rounded-full text-xs font-medium border transition-all duration-200 shadow-sm whitespace-nowrap
                        ${isSelected
                          ? `${theme === "dark" ? "ring-blue-600 border-blue-400" : "ring-blue-400 border-blue-600"} ring-2 ring-offset-2 text-white transform scale-105`
                          : `${theme === "dark" ? "border-gray-600 text-gray-200 bg-gray-700 hover:bg-gray-600" : "border-gray-300 text-gray-700 bg-gray-100 hover:bg-gray-200"}
                        `}`}
                      style={isSelected ? { backgroundColor: tag.color } : {}}
                      onClick={() => toggleFilterTag(tag.name)}
                    >
                      <TagIcon size={14} className="mr-1" />
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <MediaEditModal
        open={editModalOpen}
        initialName={selectedMedia?.name || ''}
        initialTags={selectedMedia?.tags || []}
        availableTags={allTags}
        mode="edit"
        onSave={handleEditSave}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedMedia(null);
        }}
      />

      <TranscriptionResultsModal
        isOpen={showResultsModal}
        onClose={() => {
          setShowResultsModal(false);
          setTranscriptionResults(null);
          setPendingMediaId(null);
        }}
        onSave={handleSaveResults}
        results={transcriptionResults!}
      />

      {loading ? (
        <div className={`text-center text-lg py-10 ${theme === "dark" ? "text-gray-300":"text-gray-700"}`}>Loading recordings...</div>
      ) : filteredMediaList.length === 0 ? (
        <div className={`text-center text-lg py-10 ${theme === "dark" ? "text-gray-400":"text-gray-500"}`}>No recordings found matching your filters.</div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {filteredMediaList.map((media) => {
            const tags = media.tags || [];
            const showAll = expandedTags[media.id!];
            const visibleTags = showAll ? tags : tags.slice(0, 3);
            const isSelected = selectedMediaIds.has(media.id!);
            const isAnalyzing = analyzingMediaId === media.id;
            const isExpanded = expandedItems.has(media.id!);
            const hasAnalysis = Boolean(media.transcript || media.summary);
            const isAudio = media.type === 'audio';

            console.log('Media Debug:', {
              id: media.id,
              name: media.name,
              hasAnalysis,
              isAnalyzing,
              transcript: media.transcript,
              summary: media.summary,
              analyzingMediaId,
              expandedItems: Array.from(expandedItems)
            });

            return (
              <li
                key={media.id}
                className={`relative rounded-lg shadow-md hover:shadow-lg transition-all duration-200 p-4 sm:p-5 flex flex-col gap-y-4 sm:gap-x-4 overflow-hidden ${isSelected ? `${theme === "dark" ? "ring-blue-400 border-blue-400" : "ring-blue-500 border-blue-500"} ring-2 ring-offset-2` : `${theme === "dark" ? "bg-gray-700 border-gray-700" : "bg-gray-50 border-gray-200"}`}`}
              >
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(media.id!)}
                    className={`form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-2 cursor-pointer flex-shrink-0 ${theme === "dark" ? "focus:ring-blue-400 border-gray-600 bg-gray-800" : "focus:ring-blue-500 border-gray-300 bg-white"} transition-colors`}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`font-semibold text-base sm:text-lg flex items-center ${theme === "dark" ? "text-gray-100":"text-gray-900"} break-words`}>
                        {isAudio ? (
                          <AudioWaveform size={18} className={`mr-2 ${theme === "dark" ? "text-blue-400":"text-blue-600"}`} />
                        ) : (
                          <Video size={18} className={`mr-2 ${theme === "dark" ? "text-purple-400":"text-purple-600"}`} />
                        )}
                        {media.name}
                      </div>
                      <div className="flex gap-2">
                        <button
                          className={`flex items-center text-sm hover:underline px-3 py-1 rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${theme === "dark" ? "text-blue-400 bg-blue-900/20":"text-blue-600 bg-blue-50"}`}
                          onClick={() => openEditModal(media)}
                        >
                          <Pencil size={14} className="mr-1" /> Edit
                        </button>
                        {!hasAnalysis && isAudio && (
                          <button
                            className={`flex items-center text-sm hover:underline px-3 py-1 rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${theme === "dark" ? "text-purple-400 bg-purple-900/20":"text-purple-600 bg-purple-50"} ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => handleGenerateSummary(media)}
                            disabled={isAnalyzing}
                          >
                            <Sparkles size={14} className="mr-1" />
                            {isAnalyzing ? 'Analyzing...' : 'Generate Summary'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className={`text-xs ${theme === "dark" ? "text-gray-400":"text-gray-500"}`}>
                      {new Date(media.createdAt).toLocaleString()} <span className="mx-1">•</span> Duration: {media.duration?.toFixed(1) || 'N/A'}s
                    </div>

                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {visibleTags.map((tag, idx) => (
                          <span
                            key={tag.name + idx}
                            className="flex items-center px-3 py-1 rounded-full text-xs font-medium shadow-sm"
                            style={{ backgroundColor: tag.color, color: '#fff' }}
                          >
                            <TagIcon size={12} className="mr-1" /> {tag.name}
                          </span>
                        ))}
                        {tags.length > 3 && !showAll && (
                          <button
                            className={`flex items-center px-3 py-1 rounded-full text-xs font-medium border transition-colors shadow-sm ${theme === "dark" ? "bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600":"bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300"}`}
                            onClick={() => setExpandedTags({ ...expandedTags, [media.id!]: true })}
                          >
                            <MoreHorizontal size={14} className="mr-1" /> More
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {(hasAnalysis || isAnalyzing) && (
                  <div className="mt-4">
                    <button
                      onClick={() => toggleExpand(media.id!)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${theme === "dark" ? "bg-gray-600 hover:bg-gray-500" : "bg-gray-100 hover:bg-gray-200"}`}
                      disabled={isAnalyzing}
                    >
                      <span className="font-medium">
                        {isAnalyzing ? 'Analysis in progress...' : 'Analysis Results'}
                      </span>
                      {!isAnalyzing && (isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />)}
                    </button>
                    
                    {isExpanded && !isAnalyzing && (
                      <div className={`mt-4 space-y-4 ${theme === "dark" ? "text-gray-200" : "text-gray-700"}`}>
                        {media.summary ? (
                          <div className={`p-4 rounded-lg ${theme === "dark" ? "bg-gray-600" : "bg-gray-100"}`}>
                            <h4 className="font-semibold mb-2">Summary</h4>
                            <p className="text-sm">{media.summary}</p>
                          </div>
                        ) : (
                          <div className={`p-4 rounded-lg ${theme === "dark" ? "bg-gray-600" : "bg-gray-100"}`}>
                            <p className="text-sm">Generating summary...</p>
                          </div>
                        )}
                        
                        {media.transcript && (
                          <div className={`p-4 rounded-lg ${theme === "dark" ? "bg-gray-600" : "bg-gray-100"}`}>
                            <h4 className="font-semibold mb-2">Transcript</h4>
                            <p className="text-sm whitespace-pre-wrap">{media.transcript}</p>
                          </div>
                        )}
                        
                        {media.sentiment && (
                          <div className={`p-4 rounded-lg ${theme === "dark" ? "bg-gray-600" : "bg-gray-100"}`}>
                            <h4 className="font-semibold mb-2">Sentiment Analysis</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="font-medium">Overall:</p>
                                <p className="capitalize">{media.sentiment.overall}</p>
                              </div>
                              <div>
                                <p className="font-medium">Confidence:</p>
                                <p>{(media.sentiment.confidence * 100).toFixed(1)}%</p>
                              </div>
                              {media.sentiment.details && (
                                <>
                                  <div>
                                    <p className="font-medium">Positive:</p>
                                    <p>{(media.sentiment.details.positive * 100).toFixed(1)}%</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Negative:</p>
                                    <p>{(media.sentiment.details.negative * 100).toFixed(1)}%</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Neutral:</p>
                                    <p>{(media.sentiment.details.neutral * 100).toFixed(1)}%</p>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex-shrink-0 w-full sm:w-1/2 rounded-lg overflow-hidden shadow-inner max-w-full min-w-0">
                  {isAudio ? (
                    <audio src={URL.createObjectURL(media.blob)} controls className="w-full" />
                  ) : (
                    <video src={URL.createObjectURL(media.blob)} controls className="w-full max-h-40 object-contain" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {analysisError && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg flex items-center ${theme === "dark" ? "bg-red-900 text-white" : "bg-red-100 text-red-700"}`}>
          <span>{analysisError}</span>
          <button 
            onClick={() => setAnalysisError(null)}
            className="ml-4"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default MediaLibrary;