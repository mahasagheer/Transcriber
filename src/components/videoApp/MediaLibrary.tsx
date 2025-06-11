import React, { useEffect, useState, useCallback } from 'react';
import { getAllMedia, updateMedia, deleteMedia, Media, Tag } from '../../lib/db';
import MediaEditModal from './MediaEditModal';
import { useTheme } from '../../context/ThemeContext';
import { Search, SlidersHorizontal, Trash2, Pencil, Tag as TagIcon, AudioWaveform, Video, MoreHorizontal, Shrink } from 'lucide-react';

interface MediaWithDuration extends Media {
  duration?: number;
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

  const { theme, toggleTheme } = useTheme();

  // Helper to calculate media duration
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
    // This useEffect now triggers filterMedia when filter states change
    filterMedia();
  }, [searchQuery, mediaList, minDurationFilter, maxDurationFilter, selectedFilterTags]);

  useEffect(() => {
    // Derive all unique tags from mediaList
    const tagsSet = new Map<string, Tag>();
    mediaList.forEach(m => (m.tags || []).forEach(tag => tagsSet.set(tag.name, tag)));
    setAllTags(Array.from(tagsSet.values()));
  }, [mediaList]);

  const filterMedia = useCallback(() => {
    let currentFilteredList = mediaList;

    // 1. Search Filter
    const query = searchQuery.toLowerCase();
    if (query) {
      currentFilteredList = currentFilteredList.filter((m) => m.name.toLowerCase().includes(query));
    }

    // 2. Duration Filter
    const minDuration = parseFloat(minDurationFilter);
    const maxDuration = parseFloat(maxDurationFilter);

    if (!isNaN(minDuration) && minDuration >= 0) {
      currentFilteredList = currentFilteredList.filter(m => m.duration !== undefined && m.duration >= minDuration);
    }
    if (!isNaN(maxDuration) && maxDuration >= 0) {
      currentFilteredList = currentFilteredList.filter(m => m.duration !== undefined && m.duration <= maxDuration);
    }

    // 3. Tag Filter
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

  return (
    <div className={`p-4 sm:p-6 lg:p-8 rounded-lg shadow-xl ${theme === "dark" ? "bg-gray-800 text-gray-100":"bg-white text-gray-900"}`}>
      {/* <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">Media Library</h2> */}
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
          {/* Duration Filter */}
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

          {/* Tag Filter */}
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

            return (
              <li
                key={media.id}
                className={`relative rounded-lg shadow-md hover:shadow-lg transition-all duration-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-y-4 sm:gap-x-4 overflow-hidden ${isSelected ? `${theme === "dark" ? "ring-blue-400 border-blue-400" : "ring-blue-500 border-blue-500"} ring-2 ring-offset-2` : `${theme === "dark" ? "bg-gray-700 border-gray-700" : "bg-gray-50 border-gray-200"}`}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(media.id!)}
                  className={`form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-2 cursor-pointer flex-shrink-0 ${theme === "dark" ? "focus:ring-blue-400 border-gray-600 bg-gray-800" : "focus:ring-blue-500 border-gray-300 bg-white"} transition-colors`}
                />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3">
                    <div className="flex-1 min-w-0 pr-2 max-w-full overflow-hidden">
                      <div className={`font-semibold text-base sm:text-lg flex items-center mb-1 ${theme === "dark" ? "text-gray-100":"text-gray-900"} break-words`}>
                        {media.type === 'audio' ? (
                          <AudioWaveform size={18} className={`mr-2 ${theme === "dark" ? "text-blue-400":"text-blue-600"}`} />
                        ) : (
                          <Video size={18} className={`mr-2 ${theme === "dark" ? "text-purple-400":"text-purple-600"}`} />
                        )}
                        {media.name}
                      </div>
                      <div className={`text-xs ${theme === "dark" ? "text-gray-400":"text-gray-500"}`}>
                        {new Date(media.createdAt).toLocaleString()} <span className="mx-1">•</span> Duration: {media.duration?.toFixed(1) || 'N/A'}s
                      </div>
                    </div>
                    <button
                      className={`flex items-center text-sm hover:underline px-3 py-1 rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${theme === "dark" ? "text-blue-400 bg-blue-900/20":"text-blue-600 bg-blue-50"}`}
                      onClick={() => openEditModal(media)}
                    >
                      <Pencil size={14} className="mr-1" /> Edit
                    </button>
                  </div>

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3 max-w-full overflow-hidden">
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
                      {tags.length > 3 && showAll && (
                        <button
                          className={`flex items-center px-3 py-1 rounded-full text-xs font-medium border transition-colors shadow-sm ${theme === "dark" ? "bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600":"bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300"}`}
                          onClick={() => setExpandedTags({ ...expandedTags, [media.id!]: false })}
                        >
                          <Shrink size={14} className="mr-1" /> Less
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 items-center sm:items-start mb-3">
                    {media.type === 'audio' ? (
                      <div className={`flex-shrink-0 w-full sm:w-1/2 rounded-lg overflow-hidden shadow-inner max-w-full min-w-0 ${theme === "dark" ? "bg-gray-700":"bg-gray-200"}`}>
                        <audio src={URL.createObjectURL(media.blob)} controls className="w-full" />
                      </div>
                    ) : (
                      <div className={`flex-shrink-0 w-full sm:w-1/2 rounded-lg overflow-hidden shadow-inner max-w-full min-w-0 ${theme === "dark" ? "bg-gray-700":"bg-gray-200"}`}>
                        <video src={URL.createObjectURL(media.blob)} controls className="w-full max-h-40 object-contain" />
                      </div>
                    )}

                    {media.transcript && (
                      <div className={`flex-1 p-3 rounded-lg text-sm border shadow-inner max-h-28 overflow-y-auto w-full ${theme === "dark" ? "bg-gray-900 text-gray-200 border-gray-700":"bg-white text-gray-700 border-gray-200"}`}>
                        <span className={`font-semibold ${theme === "dark" ? "text-gray-100":"text-gray-800"}`}>Transcript:</span> <span className={`break-words whitespace-pre-wrap ${theme === "dark" ? "text-gray-300":"text-gray-700"}`}>{media.transcript}</span>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default MediaLibrary;
