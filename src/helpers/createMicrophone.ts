import { mergeBuffers } from './mergeBuffers';

export function createMicrophone(stream: MediaStream) {
  let audioWorkletNode;
  let audioContext: AudioContext;
  let source;
  let audioBufferQueue = new Int16Array(0);
  return {
    async startRecording(onAudioCallback: any) {
      audioContext = new AudioContext({
        sampleRate: 16_000,
        latencyHint: 'balanced',
      });
      source = audioContext.createMediaStreamSource(stream);

      await audioContext.audioWorklet.addModule('audio-processor.js');
      audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor');

      source.connect(audioWorkletNode);
      audioWorkletNode.connect(audioContext.destination);
      audioWorkletNode.port.onmessage = (event) => {
        const currentBuffer = new Int16Array(event.data.audio_data);
        audioBufferQueue = mergeBuffers(audioBufferQueue, currentBuffer);

        const bufferDuration =
          (audioBufferQueue.length / audioContext.sampleRate) * 1000;

        // wait until we have 100ms of audio data
        if (bufferDuration >= 100) {
          const totalSamples = Math.floor(audioContext.sampleRate * 0.1);

          const finalBuffer = new Uint8Array(
            audioBufferQueue.subarray(0, totalSamples).buffer
          );

          // Debugging: Log properties of the final audio buffer
          console.log('[Audio Buffer Debug] Length:', finalBuffer.length);
          if (finalBuffer.length > 0) {
            let sum = 0;
            let min = 255;
            let max = 0;
            // Sample a portion to avoid excessive logging
            const sampleSize = Math.min(finalBuffer.length, 500);
            for (let i = 0; i < sampleSize; i++) {
              sum += finalBuffer[i];
              if (finalBuffer[i] < min) min = finalBuffer[i];
              if (finalBuffer[i] > max) max = finalBuffer[i];
            }
            console.log('[Audio Buffer Debug] First 500 bytes (Min/Max/Avg):', `Min: ${min}, Max: ${max}, Avg: ${(sum / sampleSize).toFixed(2)}`);

            // Check if buffer is effectively silent (all zeros or near zeros)
            const isSilent = finalBuffer.every(value => value === 0);
            if (isSilent) {
                console.warn('[Audio Buffer Debug] Buffer appears silent (all zeros).');
            }
          }

          audioBufferQueue = audioBufferQueue.subarray(totalSamples);
          if (onAudioCallback) onAudioCallback(finalBuffer);
        }
      };
    },
    stopRecording() {
      stream?.getTracks().forEach((track) => track.stop());
      audioContext?.close();
      audioBufferQueue = new Int16Array(0);
    },
  };
}