"use client";

import { useState, useEffect } from "react";
import { Media, getAllMedia, deleteMedia } from "../../lib/db";

interface MediaPlayerProps {
  refreshTrigger: number;
}

export default function MediaPlayer({ refreshTrigger }: MediaPlayerProps) {
  const [mediaItems, setMediaItems] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);

  // Load media from IndexedDB
  useEffect(() => {
    const loadMedia = async () => {
      try {
        setLoading(true);
        const items = await getAllMedia();
        setMediaItems(items);
        setError(null);
      } catch (err) {
        console.error("Error loading media:", err);
        setError("Failed to load media from database");
      } finally {
        setLoading(false);
      }
    };

    loadMedia();
  }, [refreshTrigger]);

  // Handle media selection
  const handleSelectMedia = (media: Media) => {
    setSelectedMedia(media);
  };

  // Handle media deletion
  const handleDeleteMedia = async (id: number) => {
    try {
      await deleteMedia(id);
      setMediaItems((prev) => prev.filter((item) => item.id !== id));

      // Clear selection if the deleted item was selected
      if (selectedMedia?.id === id) {
        setSelectedMedia(null);
      }
    } catch (err) {
      console.error("Error deleting media:", err);
      setError("Failed to delete media");
    }
  };

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  // Store for object URLs to prevent recreation and enable cleanup
  const [objectUrls, setObjectUrls] = useState<Record<number, string>>({});

  // Create object URL for blob
  const getMediaUrl = (media: Media) => {
    if (!media.id) return "";

    // Return cached URL if available
    if (objectUrls[media.id]) {
      return objectUrls[media.id];
    }

    // Create and cache the URL
    const url = URL.createObjectURL(media.blob);
    setObjectUrls((prev) => ({
      ...prev,
      [media.id!]: url,
    }));
    return url;
  };

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      // Revoke all URLs when component unmounts
      Object.values(objectUrls).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [objectUrls]);

  return (
    <div className="mb-8 p-4 border rounded-lg bg-white shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Media Library</h2>

      {error && (
        <div className="p-3 mb-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-4">Loading media...</div>
      ) : mediaItems.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          No videos found. Upload a video to see it here.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* Media Player */}
          {selectedMedia ? (
            <div className="mb-6 bg-gray-50 rounded-lg p-4 shadow-sm border">
              <h3 className="font-medium text-lg mb-3 text-gray-800">
                Now Playing: {selectedMedia.name}
              </h3>
              <div className="bg-black rounded-lg overflow-hidden">
                {selectedMedia.type === "video" ? (
                  <video
                    src={getMediaUrl(selectedMedia)}
                    controls
                    autoPlay
                    playsInline
                    className="w-full h-auto max-h-[500px] object-contain"
                    onError={(e) => {
                      console.error("Video playback error:", e);
                      setError(
                        "Error playing video. The format may not be supported."
                      );
                    }}
                    onLoadedData={() => {
                      console.log("Video loaded successfully");
                    }}
                  />
                ) : (
                  <audio
                    src={getMediaUrl(selectedMedia)}
                    controls
                    autoPlay
                    className="w-full"
                    onError={(e) => {
                      console.error("Audio playback error:", e);
                      setError(
                        "Error playing audio. The format may not be supported."
                      );
                    }}
                    onLoadedData={() => {
                      console.log("Audio loaded successfully");
                    }}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
              <p className="text-center">
                Click on a video in the list below to review it here.
              </p>
            </div>
          )}

          {/* Media List */}
          <div className="overflow-hidden border rounded">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mediaItems.map((media) => (
                  <tr key={media.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          media.type === "video"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {media.type === "video" ? "Video" : "Audio"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {media.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(media.createdAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleSelectMedia(media)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        Play
                      </button>
                      <button
                        onClick={() => handleDeleteMedia(media.id!)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
