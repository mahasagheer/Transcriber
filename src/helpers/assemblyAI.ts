import axios from 'axios';

const BASE_URL = 'https://api.assemblyai.com';

interface SentimentAnalysis {
  overall: string;
  confidence: number;
  details?: {
    positive: number;
    negative: number;
    neutral: number;
  };
}

async function convertToAudioFile(blob: Blob): Promise<Blob> {
  console.log('Starting audio conversion...');
  console.log('Input blob:', {
    type: blob.type,
    size: blob.size
  });

  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        console.log('File read complete, starting audio processing...');
        const arrayBuffer = e.target?.result as ArrayBuffer;
        console.log('ArrayBuffer size:', arrayBuffer.byteLength);

        // Create a temporary audio element to ensure proper decoding
        const audio = new Audio();
        const audioUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: blob.type }));
        audio.src = audioUrl;

        await new Promise((resolve, reject) => {
          audio.onloadedmetadata = resolve;
          audio.onerror = () => reject(new Error('Failed to load audio'));
        });

        // Create a MediaRecorder to capture the audio
        const stream = (audio as any).captureStream();
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        
        const audioChunks: Blob[] = [];
        let webmBlob: Blob = new Blob([], { type: 'audio/webm' });
        
        await new Promise<void>((resolve, reject) => {
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              audioChunks.push(e.data);
            }
          };
          
          mediaRecorder.onstop = () => {
            webmBlob = new Blob(audioChunks, { type: 'audio/webm' });
            console.log('WebM audio captured:', {
              type: webmBlob.type,
              size: webmBlob.size
            });
            resolve();
          };
          
          mediaRecorder.onerror = (e) => {
            reject(new Error('Failed to record audio: ' + e));
          };
          
          try {
            mediaRecorder.start();
            audio.play();
            
            // Wait for the audio to finish playing
            audio.onended = () => {
              mediaRecorder.stop();
            };
          } catch (error) {
            reject(new Error('Failed to start recording: ' + error));
          }
        });

        // Convert the WebM audio to WAV
        const audioBuffer = await audioContext.decodeAudioData(await webmBlob.arrayBuffer());
        console.log('Audio decoded successfully:', {
          numberOfChannels: audioBuffer.numberOfChannels,
          length: audioBuffer.length,
          sampleRate: audioBuffer.sampleRate,
          duration: audioBuffer.duration
        });

        // Create a new audio buffer with the same data
        const offlineContext = new OfflineAudioContext(
          audioBuffer.numberOfChannels,
          audioBuffer.length,
          audioBuffer.sampleRate
        );

        // Create a buffer source
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        source.start();

        // Render the audio
        console.log('Rendering audio...');
        const renderedBuffer = await offlineContext.startRendering();
        console.log('Audio rendered successfully');

        // Convert to WAV format
        console.log('Converting to WAV format...');
        const wavBlob = audioBufferToWav(renderedBuffer);
        const finalBlob = new Blob([wavBlob], { type: 'audio/wav' });
        
        console.log('Conversion complete. Final blob:', {
          type: finalBlob.type,
          size: finalBlob.size
        });

        // Clean up
        URL.revokeObjectURL(audioUrl);
        resolve(finalBlob);
      } catch (error) {
        console.error('Error during audio conversion:', error);
        reject(new Error('Failed to convert audio: ' + error));
      }
    };

    reader.onerror = (error) => {
      console.error('Error reading file:', error);
      reject(new Error('Failed to read file'));
    };

    console.log('Reading file as ArrayBuffer...');
    reader.readAsArrayBuffer(blob);
  });
}

// Helper function to convert AudioBuffer to WAV format
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const dataLength = buffer.length * numChannels * bytesPerSample;
  const bufferLength = 44 + dataLength;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + dataLength, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, format, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * blockAlign, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataLength, true);

  // Write the PCM samples
  const offset = 44;
  const channelData = [];
  for (let i = 0; i < numChannels; i++) {
    channelData.push(buffer.getChannelData(i));
  }

  let pos = 0;
  while (pos < buffer.length) {
    for (let i = 0; i < numChannels; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i][pos]));
      const val = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset + (pos * blockAlign) + (i * bytesPerSample), val, true);
    }
    pos++;
  }

  return arrayBuffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export const analyzeMedia = async (file: File | Blob) => {
  try {
    const apiKey = '139f487cb42e41e1bf49b72a2fec77c6';
    if (!apiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    const baseUrl = 'https://api.assemblyai.com';
    const headers = {
      authorization: apiKey,
    };

    console.log('Starting media analysis with file:', {
      name: file instanceof File ? file.name : 'blob',
      type: file.type,
      size: file.size
    });

    // Ensure we have a proper audio file
    let audioFile: File;
    if (file instanceof File) {
      if (file.type !== 'audio/wav') {
        // Convert to WAV if not already WAV
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
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
        
        audioFile = new File([wavBlobWithType], file.name.replace(/\.[^/.]+$/, '.wav'), {
          type: 'audio/wav'
        });
      } else {
        audioFile = file;
      }
    } else {
      // If it's a Blob, convert to WAV
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await file.arrayBuffer();
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
      
      audioFile = new File([wavBlobWithType], 'audio.wav', {
        type: 'audio/wav'
      });
    }

    console.log('Prepared audio file for upload:', {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size
    });

    // Read the file as ArrayBuffer
    const audioData = await audioFile.arrayBuffer();

    // Upload the audio file
    console.log('Uploading audio file...');
    const uploadResponse = await axios.post(
      `${baseUrl}/v2/upload`,
      audioData,
      {
        headers: {
          ...headers,
          'Content-Type': 'audio/wav'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    console.log('Upload successful:', {
      uploadUrl: uploadResponse.data.upload_url,
      fileType: audioFile.type
    });

    // Start transcription
    console.log('Starting transcription...');
    const transcriptResponse = await axios.post(
      `${baseUrl}/v2/transcript`,
      {
        audio_url: uploadResponse.data.upload_url,
        summarization: true,
        sentiment_analysis: true,
      },
      {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
      }
    );

    const transcriptId = transcriptResponse.data.id;
    console.log('Transcription started:', { transcriptId });

    // Poll for completion
    let transcript;
    while (true) {
      const statusResponse = await axios.get(
        `${baseUrl}/v2/transcript/${transcriptId}`,
        {
          headers,
        }
      );

      console.log('Transcription status:', {
        status: statusResponse.data.status,
        error: statusResponse.data.error,
        text: statusResponse.data.text,
        summary: statusResponse.data.summary,
        sentiment: statusResponse.data.sentiment_analysis
      });

      if (statusResponse.data.status === 'completed') {
        transcript = statusResponse.data;
        console.log('Transcription completed with data:', {
          text: transcript.text,
          summary: transcript.summary,
          sentiment: transcript.sentiment_analysis
        });
        break;
      } else if (statusResponse.data.status === 'error') {
        throw new Error(`Transcription failed: ${statusResponse.data.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Generate summary using LeMUR
    console.log('Generating summary...');
    const lemurData = {
      prompt: "Provide a brief summary of the transcript.",
      transcript_ids: [transcriptId],
      final_model: "anthropic/claude-3-7-sonnet-20250219",
    };

    const summaryResponse = await axios.post(
      `${baseUrl}/lemur/v3/generate/task`,
      lemurData,
      { headers }
    );

    console.log('Summary generated:', {
      response: summaryResponse.data.response,
      responseType: typeof summaryResponse.data.response,
      responseLength: summaryResponse.data.response?.length
    });

    // Process sentiment analysis
    const sentiment = transcript.sentiment_analysis || {
      overall: 'neutral',
      confidence: 0,
      details: {
        positive: 0,
        negative: 0,
        neutral: 1
      }
    };

    // Ensure we have a valid summary
    const summary = summaryResponse.data.response || transcript.summary || '';
    console.log('Final summary to return:', {
      summary,
      summaryType: typeof summary,
      summaryLength: summary.length
    });

    const result = {
      transcript: transcript.text || '',
      summary: summary,
      sentiment: {
        overall: sentiment.overall || 'neutral',
        confidence: sentiment.confidence || 0,
        details: sentiment.details || {
          positive: 0,
          negative: 0,
          neutral: 1
        }
      }
    };

    console.log('Final analysis result:', {
      hasTranscript: !!result.transcript,
      transcriptLength: result.transcript.length,
      hasSummary: !!result.summary,
      summaryLength: result.summary.length,
      hasSentiment: !!result.sentiment,
      sentimentDetails: result.sentiment
    });

    return result;
  } catch (error) {
    console.error('Error in analyzeMedia:', error);
    throw error;
  }
}; 