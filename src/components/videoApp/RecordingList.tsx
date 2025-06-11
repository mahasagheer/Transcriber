import React, { useState } from 'react';
import { Media, Tag } from '../../lib/db';
import { format as formatDateFns } from 'date-fns';
import { updateMedia } from '../../lib/db';

interface RecordingListProps {
  recordings: Media[];
  availableTags: Tag[];
  onUpdate?: (updated: Media) => void;
}

function formatTime(date: Date) {
  return formatDateFns(date, 'h:mm a');
}

const RecordingList: React.FC<RecordingListProps> = ({ recordings, availableTags, onUpdate }) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [expandedTags, setExpandedTags] = useState<{ [id: number]: boolean }>({});
  const [editingTagsId, setEditingTagsId] = useState<number | null>(null);
  const [editingTags, setEditingTags] = useState<Tag[]>([]);

  // Save name edit
  const handleSaveName = async (rec: Media) => {
    const updated = { ...rec, name: editingName };
    await updateMedia(updated);
    setEditingId(null);
    if (onUpdate) onUpdate(updated);
  };

  // Save tags edit
  const handleSaveTags = async (rec: Media) => {
    const updated = { ...rec, tags: editingTags };
    await updateMedia(updated);
    setEditingTagsId(null);
    if (onUpdate) onUpdate(updated);
  };

  return (
    <ul className="space-y-4">
      {recordings.map((rec) => {
        const tags = rec.tags || [];
        const showAll = expandedTags[rec.id!];
        const visibleTags = showAll ? tags : tags.slice(0, 3);
        const hiddenCount = tags.length - 3;
        return (
          <li key={rec.id} className="border rounded-lg p-4 bg-gray-50 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              {/* Name + edit */}
              <div className="flex items-center gap-2 min-w-0">
                {editingId === rec.id ? (
                  <>
                    <input
                      className="border rounded px-2 py-1 text-sm w-40"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveName(rec);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                    />
                    <button
                      className="ml-1 px-2 py-1 bg-blue-600 text-white rounded text-xs"
                      onClick={() => handleSaveName(rec)}
                    >
                      Save
                    </button>
                    <button
                      className="ml-1 px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="font-medium text-base truncate max-w-[160px]" title={rec.name}>{rec.name}</span>
                    <button
                      className="ml-1 text-gray-400 hover:text-blue-600"
                      onClick={() => { setEditingId(rec.id!); setEditingName(rec.name); }}
                      title="Edit name"
                    >
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" d="M16.475 5.408a2.1 2.1 0 1 1 2.97 2.97l-9.192 9.192a2 2 0 0 1-.707.464l-3.11 1.11a.5.5 0 0 1-.64-.64l1.11-3.11a2 2 0 0 1 .464-.707l9.192-9.192Z"/></svg>
                    </button>
                  </>
                )}
              </div>
              <div className="text-xs text-gray-400 ml-2 whitespace-nowrap">{formatTime(new Date(rec.createdAt))}</div>
            </div>
            {/* Tags */}
            <div className="flex flex-wrap gap-2 items-center mb-2">
              {editingTagsId === rec.id ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map(tag => {
                      const selected = editingTags.some(t => t.name === tag.name);
                      return (
                        <button
                          key={tag.name}
                          type="button"
                          className={`px-2 py-1 rounded-full text-xs font-medium border focus:outline-none transition-colors ${selected ? 'ring-2 ring-offset-2 ring-blue-400 border-blue-600' : 'border-gray-300'}`}
                          style={{ backgroundColor: tag.color, color: '#fff', opacity: selected ? 1 : 0.7, borderColor: selected ? tag.color : undefined }}
                          onClick={() => {
                            setEditingTags(selected
                              ? editingTags.filter(t => t.name !== tag.name)
                              : editingTags.length < 100 ? [...editingTags, tag] : editingTags
                            );
                          }}
                          aria-pressed={selected}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    className="ml-2 px-2 py-1 bg-blue-600 text-white rounded text-xs"
                    onClick={() => handleSaveTags(rec)}
                  >
                    Save
                  </button>
                  <button
                    className="ml-1 px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs"
                    onClick={() => setEditingTagsId(null)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {visibleTags.map((tag, idx) => (
                    <span
                      key={tag.name + idx}
                      className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: tag.color, color: '#fff' }}
                    >
                      {tag.name}
                    </span>
                  ))}
                  {tags.length > 3 && !showAll && (
                    <button
                      className="px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700 border border-gray-300 hover:bg-gray-300"
                      onClick={() => setExpandedTags({ ...expandedTags, [rec.id!]: true })}
                    >
                      ... More
                    </button>
                  )}
                  {tags.length > 3 && showAll && (
                    <button
                      className="px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700 border border-gray-300 hover:bg-gray-300"
                      onClick={() => setExpandedTags({ ...expandedTags, [rec.id!]: false })}
                    >
                      Show Less
                    </button>
                  )}
                  <button
                    className="ml-1 text-gray-400 hover:text-blue-600"
                    onClick={() => { setEditingTagsId(rec.id!); setEditingTags(tags); }}
                    title="Edit tags"
                  >
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" d="M16.475 5.408a2.1 2.1 0 1 1 2.97 2.97l-9.192 9.192a2 2 0 0 1-.707.464l-3.11 1.11a.5.5 0 0 1-.64-.64l1.11-3.11a2 2 0 0 1 .464-.707l9.192-9.192Z"/></svg>
                  </button>
                </>
              )}
            </div>
            {/* Play/download */}
            <div className="flex gap-2 mt-2">
              {rec.type === 'audio' ? (
                <audio src={URL.createObjectURL(rec.blob)} controls className="w-40" />
              ) : (
                <video src={URL.createObjectURL(rec.blob)} controls className="w-40 max-h-28" />
              )}
              <a
                href={URL.createObjectURL(rec.blob)}
                download={rec.name}
                className="ml-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium"
              >
                Download
              </a>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default RecordingList; 