import React, { useState, useEffect } from 'react';
import { Tag } from '../../lib/db';
import { X, Tag as TagIcon, Plus, Save } from 'lucide-react';

interface MediaEditModalProps {
  open: boolean;
  initialName: string;
  initialTags: Tag[];
  availableTags: Tag[];
  mode: 'create' | 'edit';
  onSave: (name: string, tags: Tag[]) => void;
  onClose: () => void;
}

const MediaEditModal: React.FC<MediaEditModalProps> = ({
  open, initialName, initialTags, availableTags, mode, onSave, onClose
}) => {
  const [name, setName] = useState(initialName);
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [tagInput, setTagInput] = useState('');

  // Ensure state updates when editing a different file
  useEffect(() => {
    setName(initialName);
    setTags(initialTags);
  }, [initialName, initialTags, open]);

  // Add or select tag
  const handleTagAdd = (tag: Tag) => {
    if (!tags.some(t => t.name === tag.name)) setTags([...tags, tag]);
    setTagInput('');
  };

  // Remove tag
  const handleTagRemove = (tag: Tag) => setTags(tags.filter(t => t.name !== tag.name));

  // Filter available tags for search
  const filteredTags = availableTags.filter(
    t => t.name.toLowerCase().includes(tagInput.toLowerCase()) && !tags.some(st => st.name === t.name)
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent bg-opacity-60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 sm:p-8 max-w-sm w-full relative transform transition-all duration-300 scale-100 opacity-100 text-gray-900 dark:text-gray-100">
        <button
          className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-3xl font-bold focus:outline-none transition-colors"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={24} />
        </button>
        <h3 className="text-xl font-bold mb-4">
          {mode === 'create' ? 'Save Recording' : 'Edit Recording'}
        </h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="mediaName" className="block font-semibold mb-2">File Name:</label>
            <input
              id="mediaName"
              type="text"
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
              placeholder="Enter a name for this recording (e.g., Meeting Summary)"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <div className="font-semibold mb-2">Tags:</div>
            <div className="flex flex-wrap gap-2 mb-3 max-h-24 overflow-y-auto pr-2">
              {tags.map((tag, idx) => (
                <span
                  key={tag.name + idx}
                  className="flex items-center px-3 py-1 rounded-full text-xs font-medium shadow-sm"
                  style={{ backgroundColor: tag.color, color: '#fff' }}
                >
                  <TagIcon size={14} className="mr-1" />
                  {tag.name}
                  <button
                    type="button"
                    className="ml-2 text-white hover:text-gray-200 focus:outline-none p-0.5 rounded-full hover:bg-black hover:bg-opacity-20 transition-colors"
                    onClick={() => handleTagRemove(tag)}
                    aria-label={`Remove tag ${tag.name}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 w-full mb-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
              placeholder="Search or add tag (e.g., Important)"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && tagInput.trim()) {
                  const found = availableTags.find(t => t.name.toLowerCase() === tagInput.trim().toLowerCase());
                  handleTagAdd(found || { name: tagInput.trim(), color: '#607d8b' });
                }
              }}
            />
            {tagInput.trim() && (
              <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-40 overflow-y-auto z-10">
                {filteredTags.map(tag => (
                  <button
                    key={tag.name}
                    type="button"
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 flex items-center"
                    style={{ color: tag.color }}
                    onClick={() => handleTagAdd(tag)}
                  >
                    <Plus size={16} className="mr-2" />
                    {tag.name}
                  </button>
                ))}
                {!filteredTags.length && (
                  <button
                    type="button"
                    className="block w-full text-left px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center font-medium"
                    onClick={() => handleTagAdd({ name: tagInput.trim(), color: '#607d8b' })}
                  >
                    <Plus size={16} className="mr-2" />
                    Add "<span className="font-semibold">{tagInput.trim()}</span>"
                  </button>
                )}
              </div>
            )}
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">Press Enter to add new tags.</div>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            className="px-5 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
            onClick={onClose}
          >Cancel</button>
          <button
            className="px-5 py-2 bg-blue-600 text-white rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            onClick={() => onSave(name, tags)}
            disabled={!name.trim()}
          >
            <Save size={18} className="mr-2" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediaEditModal;