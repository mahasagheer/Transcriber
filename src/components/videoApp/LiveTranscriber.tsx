"use client"
import { useEffect, useRef, useState } from "react"

const ASSEMBLYAI_API_KEY = process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY

export default function LiveTranscriber() {
  const [transcript, setTranscript] = useState("")
  const socketRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startTranscription = async () => {
    const socket = new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000`, [
      "token",
      ASSEMBLYAI_API_KEY!,
    ])
    socketRef.current = socket

    socket.onopen = async () => {
      console.log("WebSocket connected")

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      const mediaRecorder = new (window as any).MediaRecorder(stream, {
        mimeType: "audio/webm",
      })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.addEventListener("dataavailable", async (event: BlobEvent) => {
        if (socket.readyState === WebSocket.OPEN) {
          const reader = new FileReader()
          reader.readAsArrayBuffer(event.data)
          reader.onloadend = () => {
            if (reader.result instanceof ArrayBuffer) {
              socket.send(reader.result)
            }
          }
        }
      })

      mediaRecorder.start(250) // send every 250ms
    }

    socket.onmessage = (message) => {
      const res = JSON.parse(message.data)
      if (res.text) {
        setTranscript((prev) => prev + " " + res.text)
      }
    }

    socket.onclose = () => console.log("WebSocket closed")
    socket.onerror = (err) => console.error("WebSocket error:", err)
  }

  const stopTranscription = () => {
    mediaRecorderRef.current?.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    socketRef.current?.close()
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">Live Transcription</h2>
      <button onClick={startTranscription} className="bg-blue-500 px-4 py-2 text-white rounded mr-2">
        Start
      </button>
      <button onClick={stopTranscription} className="bg-red-500 px-4 py-2 text-white rounded">
        Stop
      </button>
      <p className="mt-4 whitespace-pre-wrap">{transcript}</p>
    </div>
  )
}
