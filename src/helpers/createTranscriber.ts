import { RealtimeTranscriber, RealtimeTranscript } from 'assemblyai';
import { getAssemblyToken } from './getAssemblyToken';
import { Dispatch, SetStateAction } from 'react';

export async function createTranscriber(
  setTranscribedText: Dispatch<SetStateAction<string>>,
  setLlamaActive: Dispatch<SetStateAction<boolean>>,
  processPrompt: (prompt: string) => void
): Promise<RealtimeTranscriber | undefined> {
  const token = await getAssemblyToken();
  console.log('Assembly token: ', token);
  if (!token) {
    console.error('No token found');
    return;
  }
  const transcriber = new RealtimeTranscriber({
    sampleRate: 16_000,
    token: token,
    wordBoost: ['Llama'],
    endUtteranceSilenceThreshold: 1000,
    //   encoding: 'pcm_mulaw',
  });

  transcriber.on('open', ({ sessionId }) => {
    console.log(`Transcriber opened with session ID: ${sessionId}`);
  });

  transcriber.on('error', (error: Error) => {
    console.error('Transcriber error:', error);
    // TODO: close transcriber
    // await transcriber.close();
  });

  transcriber.on('close', (code: number, reason: string) => {
    console.log(`Transcriber closed with code ${code} and reason: ${reason}`);
    // TODO: clean up
    // transcriber = null;
  });

  // Variables to manage transcription display
  let finalTranscripts: string[] = [];
  let currentPartialText: string = '';

  transcriber.on('transcript', (transcript: RealtimeTranscript) => {
    // Debugging: Log the entire incoming transcript object
    console.log('[Full AssemblyAI Transcript Object]:', transcript);

    // Detect if we're asking something for the LLM
    setLlamaActive(transcript.text.toLowerCase().indexOf('llama') > 0);

    if (transcript.message_type === 'PartialTranscript') {
      currentPartialText = transcript.text;
    } else if (transcript.message_type === 'FinalTranscript') {
      if (transcript.text) { // Only add if text is not empty
        finalTranscripts.push(transcript.text);
      }
      currentPartialText = ''; // Clear partial once a final is received
    }

    // Update the displayed text: combine all final transcripts with the current partial
    const newDisplayText = finalTranscripts.join(' ') + (currentPartialText ? ' ' + currentPartialText : '');
    setTranscribedText(newDisplayText.trim());
    console.log('[Transcript] Displayed:', newDisplayText.trim());

    // Original console logs for specific message types (keep for debugging)
    if (transcript.message_type === 'PartialTranscript') {
      console.log('[Transcript] Partial Raw:', transcript.text);
    } else if (transcript.message_type === 'FinalTranscript') {
      console.log('[Transcript] Final Raw:', transcript.text);
      if (transcript.text.toLowerCase().indexOf('llama') > 0) {
        console.log('Setting prompt to: ', transcript.text);
        processPrompt(transcript.text);
      }
    } else {
      console.log('[Transcript] Other Message Type:', transcript.message_type, transcript.text);
    }
  });

  return transcriber;
}