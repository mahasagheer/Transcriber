import React from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface TranscriptionResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  results: {
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
  };
}

const TranscriptionResultsModal: React.FC<TranscriptionResultsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  results
}) => {
  const { theme } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`relative w-full max-w-2xl mx-4 p-6 rounded-lg shadow-xl ${theme === "dark" ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"}`}>
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-full hover:bg-opacity-10 ${theme === "dark" ? "hover:bg-white" : "hover:bg-gray-900"}`}
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold mb-6">Transcription Results</h2>

        <div className="space-y-6">
          {/* Summary Section */}
          <div>
            <h3 className={`text-lg font-semibold mb-2 ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>Summary</h3>
            <div className={`p-4 rounded-lg ${theme === "dark" ? "bg-gray-700" : "bg-gray-50"}`}>
              {results.summary}
            </div>
          </div>

          {/* Transcript Section */}
          <div>
            <h3 className={`text-lg font-semibold mb-2 ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>Transcript</h3>
            <div className={`p-4 rounded-lg max-h-40 overflow-y-auto ${theme === "dark" ? "bg-gray-700" : "bg-gray-50"}`}>
              {results.transcript}
            </div>
          </div>

          {/* Sentiment Analysis Section */}
          <div>
            <h3 className={`text-lg font-semibold mb-2 ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>Sentiment Analysis</h3>
            <div className={`p-4 rounded-lg ${theme === "dark" ? "bg-gray-700" : "bg-gray-50"}`}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-medium">Overall Sentiment:</p>
                  <p className="capitalize">{results.sentiment.overall}</p>
                </div>
                <div>
                  <p className="font-medium">Confidence:</p>
                  <p>{(results.sentiment.confidence * 100).toFixed(1)}%</p>
                </div>
                {results.sentiment.details && (
                  <>
                    <div>
                      <p className="font-medium">Positive:</p>
                      <p>{(results.sentiment.details.positive * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="font-medium">Negative:</p>
                      <p>{(results.sentiment.details.negative * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="font-medium">Neutral:</p>
                      <p>{(results.sentiment.details.neutral * 100).toFixed(1)}%</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end space-x-4">
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg ${theme === "dark" ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-200 hover:bg-gray-300"}`}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Results
          </button>
        </div>
      </div>
    </div>
  );
};

export default TranscriptionResultsModal; 