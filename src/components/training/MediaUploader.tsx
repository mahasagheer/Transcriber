"use client";

import { useState, useRef, useEffect } from "react";
import { saveMedia } from "../../lib/db";

interface MediaUploaderProps {
  onMediaSaved: () => void;
}

export default function MediaUploader({ onMediaSaved }: MediaUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    const file = files[0];

    // Check if file is a video
    if (!file.type.startsWith("video/")) {
      setError("Please select a video file");
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    // Check file size (limit to 100MB)
    if (file.size > 100 * 1024 * 1024) {
      setError("File size exceeds 100MB limit");
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    setError(null);
    setSelectedFile(file);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Reset upload progress
    setUploadProgress(0);
  };

  // Clear selected file
  const handleClearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    setUploadProgress(0);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Save uploaded file to IndexedDB
  const handleSaveMedia = async () => {
    if (!selectedFile) {
      setError("No file selected");
      return;
    }

    try {
      setIsUploading(true);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const newProgress = prev + 10;
          return newProgress > 90 ? 90 : newProgress;
        });
      }, 200);

      // Convert file to blob
      const blob = await selectedFile
        .arrayBuffer()
        .then((buffer) => new Blob([buffer], { type: selectedFile.type }));

      // Save to IndexedDB
      const mediaId = await saveMedia({
        blob,
        type: "video",
        name: selectedFile.name,
        createdAt: new Date(),
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      console.log(`Saved media with ID: ${mediaId}`);
      onMediaSaved();

      // Clear selection after successful save
      setTimeout(() => {
        handleClearSelection();
        setIsUploading(false);
      }, 1000);
    } catch (err) {
      console.error("Error saving media:", err);
      setError(
        "Failed to save media: " +
          (err instanceof Error ? err.message : String(err))
      );
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Clean up object URL when component unmounts or when preview changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className="mb-8 p-4 border rounded-lg bg-white shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Media Uploader</h2>

      {error && (
        <div className="p-3 mb-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="block mb-2 font-medium">Upload Video:</label>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="video/*"
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
          disabled={isUploading}
        />
        <p className="mt-1 text-sm text-gray-500">
          Supported formats: MP4, WebM, MOV, etc. (Max size: 100MB)
        </p>
      </div>

      {previewUrl && (
        <div className="mb-4 bg-gray-100 rounded overflow-hidden">
          <video
            src={previewUrl}
            controls
            playsInline
            className="w-full h-auto"
            onError={() => {
              setError(
                "Error previewing video. The format may not be supported."
              );
            }}
          />
        </div>
      )}

      {isUploading && (
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {uploadProgress < 100 ? "Uploading..." : "Upload complete!"}
          </p>
        </div>
      )}

      <div className="flex space-x-3">
        {selectedFile && !isUploading && (
          <>
            <button
              onClick={handleSaveMedia}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-300"
            >
              Save Video
            </button>
            <button
              onClick={handleClearSelection}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              Clear
            </button>
          </>
        )}
      </div>
    </div>
  );
}
