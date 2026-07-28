'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

export interface UseSpeechRecognitionOptions {
  onFinalText?: (text: string) => void
  onPartialText?: (text: string) => void
}

export function useSpeechRecognition({ onFinalText, onPartialText }: UseSpeechRecognitionOptions = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [partialText, setPartialText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const finalTextRef = useRef('')
  const shouldCloseWsRef = useRef(false)

  const stopRecording = useCallback(() => {
    console.log('[ASR] stopRecording called')
    
    // 发送 finish 指令
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('[ASR] sending finish command')
      wsRef.current.send(JSON.stringify({ type: 'finish' }))
    }

    // 停止音频采集
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect()
      scriptProcessorRef.current = null
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setIsRecording(false)
  }, [])

  const startRecording = useCallback(async () => {
    const token = useAuthStore.getState().accessToken
    if (!token) {
      setError('请先登录')
      return
    }

    // 安全上下文 + API 可用性检查：非 HTTPS/localhost 直接禁用语音，但不影响文字输入
    if (!navigator.mediaDevices?.getUserMedia) {
      const isSecure = typeof window !== 'undefined' && window.isSecureContext
      setError(isSecure
        ? '当前浏览器不支持麦克风访问'
        : '语音功能需要 HTTPS 或 localhost 环境，可继续使用文字输入'
      )
      return
    }

    setError(null)
    setPartialText('')
    finalTextRef.current = ''
    shouldCloseWsRef.current = false
    setIsConnecting(true)

    let ws: WebSocket | null = null
    try {
      const wsUrl = `${API_BASE.replace(/^http/, 'ws')}/agent/asr?token=${encodeURIComponent(token)}`
      console.log('[ASR] Connecting to', wsUrl)
      ws = new WebSocket(wsUrl)
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[ASR] WebSocket opened')
        ws!.send(JSON.stringify({ type: 'start' }))
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          console.log('[ASR] Received message:', msg.type, msg)

          switch (msg.type) {
            case 'connected':
              setIsConnecting(false)
              setIsRecording(true)
              startAudioCapture()
              break
            case 'partial':
              setPartialText(msg.text || '')
              onPartialText?.(msg.text || '')
              break
            case 'final':
              finalTextRef.current = msg.text || ''
              setPartialText(msg.text || '')
              onFinalText?.(msg.text || '')
              break
            case 'error':
              console.error('[ASR] Error:', msg.message)
              setError(msg.message || '识别错误')
              stopRecording()
              break
            case 'done':
              console.log('[ASR] Done, final text:', finalTextRef.current)
              stopRecording()
              if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
              }
              break
          }
        } catch (parseErr) {
          console.error('[ASR] Message parse error:', parseErr)
        }
      }

      ws.onerror = (ev) => {
        console.error('[ASR] WebSocket error:', ev)
        setError('语音识别连接失败，可继续使用文字输入')
        setIsConnecting(false)
        setIsRecording(false)
        stopRecording()
      }

      ws.onclose = (ev) => {
        console.log('[ASR] WebSocket closed, code:', ev.code, 'reason:', ev.reason)
        setIsRecording(false)
        setIsConnecting(false)
      }
    } catch (e) {
      console.error('[ASR] Exception:', e)
      setError('无法启动语音识别，可继续使用文字输入')
      setIsConnecting(false)
      setIsRecording(false)
      if (ws) {
        try { ws.close() } catch {}
        wsRef.current = null
      }
    }
  }, [onFinalText, onPartialText, stopRecording])

  const startAudioCapture = async () => {
    try {
      console.log('[ASR] Starting audio capture...')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source

      const processor = audioContext.createScriptProcessor(2048, 1, 1)
      scriptProcessorRef.current = processor

      source.connect(processor)
      processor.connect(audioContext.destination)

      console.log('[ASR] Audio capture started, sample rate:', audioContext.sampleRate)
      let frameCount = 0

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
        const inputData = e.inputBuffer.getChannelData(0)
        const buffer = floatTo16BitPCM(inputData)
        wsRef.current.send(buffer)
        frameCount++
        if (frameCount % 50 === 0) {
          console.log('[ASR] Sent', frameCount, 'audio frames, last size:', buffer.byteLength, 'bytes')
        }
      }
    } catch (e) {
      console.error('[ASR] Audio capture error:', e)
      setError('无法访问麦克风，可继续使用文字输入')
      setIsConnecting(false)
      setIsRecording(false)
      stopRecording()
    }
  }

  const clearError = useCallback(() => setError(null), [])

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      stopRecording()
    }
  }, [stopRecording])

  return {
    isRecording,
    isConnecting,
    partialText,
    error,
    startRecording,
    stopRecording,
    clearError,
    finalText: finalTextRef.current,
  }
}

function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const output = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return output.buffer
}
