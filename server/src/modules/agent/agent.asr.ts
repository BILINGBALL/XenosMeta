/**
 * 豆包流式语音识别 2.0 代理（官方二进制协议版）
 * 
 * 前端 <--WebSocket--> 本代理 <--WebSocket--> 火山引擎 ASR
 * 
 * 协议：火山引擎官方二进制协议
 * - 4 字节 header（含版本、消息类型、flags、序列化方式等）
 * - 4 字节 payload size（大端）
 * - payload 内容
 * 
 * 前端 -> 后端 消息：
 *   { type: 'start' }                    // 开始识别
 *   <二进制帧>                            // PCM 16kHz 16bit mono 音频
 *   { type: 'finish' }                   // 结束录音
 * 
 * 后端 -> 前端 消息：
 *   { type: 'connected' }                // 建连成功
 *   { type: 'partial', text: '...' }      // 中间识别结果
 *   { type: 'final', text: '...' }        // 最终识别结果
 *   { type: 'error', message: '...' }     // 错误
 *   { type: 'done' }                     // 结束
 */

import crypto from 'crypto'
import WebSocket from 'ws'
import { logger } from '@common/logger'

const ASR_WS_URL = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async'
const APP_ID = process.env.VOLC_ASR_APP_ID || '2812907694'
const ACCESS_TOKEN = process.env.VOLC_ASR_ACCESS_TOKEN || 'gvI45RFvt9UV_8EhsKMYu61gZ7EBlNnd'
const RESOURCE_ID = process.env.VOLC_ASR_RESOURCE_ID || 'volc.seedasr.sauc.duration'

/**
 * 构建火山引擎 ASR 二进制协议包头 (4 bytes)
 * 
 * Header 结构:
 *  byte 0: [protocol version:4][header size:4]
 *  byte 1: [message type:4][flags:4]
 *  byte 2: [serialization:4][compression:4]
 *  byte 3: [reserved:8]
 */
function buildHeader(
    messageType: number,
    flags: number = 0,
    serialization: number = 0,
    compression: number = 0,
): Buffer {
    const header = Buffer.alloc(4)
    const version = 1   // protocol version 1
    const headerSize = 1 // header size = 1 * 4 = 4 bytes

    header[0] = ((version & 0x0F) << 4) | (headerSize & 0x0F)
    header[1] = ((messageType & 0x0F) << 4) | (flags & 0x0F)
    header[2] = ((serialization & 0x0F) << 4) | (compression & 0x0F)
    header[3] = 0 // reserved

    return header
}

/** 构建 full client request 包（第一个包，JSON 格式） */
function buildFullClientRequest(uid: string): Buffer {
    const payload = JSON.stringify({
        user: {
            uid,
            platform: 'web',
        },
        audio: {
            format: 'pcm',
            codec: 'raw',
            rate: 16000,
            bits: 16,
            channel: 1,
        },
        request: {
            model_name: 'bigmodel',
            enable_itn: true,
            enable_punc: true,
            enable_ddc: false,
            show_utterances: false,
            result_type: 'full',
        },
    })

    const payloadBuf = Buffer.from(payload, 'utf-8')
    const header = buildHeader(
        1,    // message type: full client request
        0,    // flags
        1,    // serialization: JSON
        0,    // compression: none
    )
    const sizeBuf = Buffer.alloc(4)
    sizeBuf.writeUInt32BE(payloadBuf.length, 0)

    return Buffer.concat([header, sizeBuf, payloadBuf])
}

/** 构建音频数据包 */
function buildAudioPacket(audioData: Buffer, isLast: boolean = false): Buffer {
    const header = buildHeader(
        2,    // message type: audio only request
        isLast ? 2 : 0, // flags: 2 = last packet (负包)
        0,    // serialization: none
        0,    // compression: none
    )
    const sizeBuf = Buffer.alloc(4)
    sizeBuf.writeUInt32BE(audioData.length, 0)

    return Buffer.concat([header, sizeBuf, audioData])
}

/** 解析服务端返回的二进制包 */
function parseServerPacket(data: Buffer): { type: number; payload: Buffer; seq?: number } | null {
    if (data.length < 8) return null

    const byte0 = data[0]
    const byte1 = data[1]
    const byte2 = data[2]

    const messageType = (byte1 >> 4) & 0x0F
    const flags = byte1 & 0x0F
    const headerSize = (byte0 & 0x0F) * 4

    // 检查是否带有 sequence number（flags 的 bit 0 或 bit 1 为 1）
    const hasSeq = (flags & 0x01) !== 0 || (flags & 0x02) !== 0
    let offset = headerSize
    let seq: number | undefined

    if (hasSeq && data.length >= offset + 4) {
        seq = data.readInt32BE(offset)
        offset += 4
    }

    if (data.length < offset + 4) return null

    const payloadSize = data.readUInt32BE(offset)
    offset += 4
    const payloadStart = offset

    if (data.length < payloadStart + payloadSize) return null

    const payload = data.slice(payloadStart, payloadStart + payloadSize)
    return { type: messageType, payload, seq }
}

/**
 * 处理一个客户端 ASR 连接
 * @param clientWs 前端 WebSocket 连接
 * @param userId 用户 ID
 */
export function handleAsrConnection(clientWs: WebSocket, userId: string): void {
    let upstreamWs: WebSocket | null = null
    let seq = 0
    let isConnected = false

    const connectId = crypto.randomUUID()

    logger.info({ userId, connectId }, 'ASR 客户端连接')

    const sendError = (msg: string) => {
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'error', message: msg }))
        }
    }

    const sendUpstream = (data: Buffer) => {
        if (upstreamWs && upstreamWs.readyState === WebSocket.OPEN) {
            upstreamWs.send(data)
        }
    }

    const connectUpstream = () => {
        if (upstreamWs) return

        logger.info({ userId, connectId }, 'ASR 连接火山引擎')

        upstreamWs = new WebSocket(ASR_WS_URL, {
            headers: {
                'X-Api-App-Key': APP_ID,
                'X-Api-Access-Key': ACCESS_TOKEN,
                'X-Api-Resource-Id': RESOURCE_ID,
                'X-Api-Connect-Id': connectId,
                'X-Api-Sequence': '-1',
            },
        })

        upstreamWs.on('open', () => {
            logger.info({ userId, connectId }, 'ASR 火山引擎建连成功')

            const initPacket = buildFullClientRequest(userId)
            upstreamWs?.send(initPacket)
            isConnected = true

            clientWs.send(JSON.stringify({ type: 'connected' }))
        })

        upstreamWs.on('message', (data: Buffer) => {
            try {
                const parsed = parseServerPacket(data)
                if (!parsed) {
                    logger.warn({ userId, connectId, dataLen: data.length, hex: data.slice(0, 16).toString('hex') }, 'ASR 无法解析上游包')
                    return
                }

                logger.info({ userId, connectId, msgType: parsed.type, seq: parsed.seq, payloadLen: parsed.payload.length }, 'ASR 收到上游消息')

                // message type 9 = full server response
                if (parsed.type === 9) {
                    const text = parsed.payload.toString('utf-8')
                    logger.info({ userId, connectId, raw: text.slice(0, 500) }, 'ASR 上游响应原始 JSON')
                    const result = JSON.parse(text)

                    // 提取识别文本
                    let transcript = ''
                    if (typeof result.result === 'string') {
                        transcript = result.result
                    } else if (result.result?.text) {
                        transcript = result.result.text
                    } else if (Array.isArray(result.result?.utterances)) {
                        transcript = result.result.utterances
                            .map((u: any) => u.text || '')
                            .join('')
                    }

                    if (transcript) {
                        const isFinal = result.is_final || result.definite
                        logger.info({ userId, connectId, transcript: transcript.slice(0, 100), isFinal }, 'ASR 识别结果')

                        if (isFinal) {
                            clientWs.send(JSON.stringify({
                                type: 'final',
                                text: transcript,
                            }))
                        } else {
                            clientWs.send(JSON.stringify({
                                type: 'partial',
                                text: transcript,
                            }))
                        }
                    }
                }
                // message type 15 = error
                else if (parsed.type === 15) {
                    const errText = parsed.payload.toString('utf-8')
                    logger.error({ userId, connectId, errText }, 'ASR 火山引擎返回错误')
                    sendError(`识别服务错误: ${errText}`)
                }
            } catch (err) {
                logger.error({ err, userId, connectId, raw: data.toString('utf-8').slice(0, 200) }, 'ASR 解析服务端消息失败')
            }
        })

        upstreamWs.on('error', (err) => {
            logger.error({ err: (err as Error).message, stack: (err as Error).stack, userId, connectId }, 'ASR 上游连接错误')
            const errObj = err as any
            if (errObj.statusCode) {
                logger.error({ statusCode: errObj.statusCode }, 'ASR HTTP 状态码')
            }
            sendError('语音识别服务连接失败')
        })

        upstreamWs.on('close', () => {
            logger.info({ userId, connectId }, 'ASR 上游连接关闭')
            isConnected = false
            if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ type: 'done' }))
            }
        })
    }

    // 处理前端消息
    clientWs.on('message', (data: Buffer, isBinary: boolean) => {
        if (isBinary) {
            // 二进制帧 = PCM 音频数据
            if (!isConnected || !upstreamWs) {
                sendError('识别未就绪')
                return
            }
            seq++
            const packet = buildAudioPacket(data, false)
            logger.info({ userId, connectId, seq, audioSize: data.length, packetSize: packet.length }, 'ASR 转发音频包')
            sendUpstream(packet)
            return
        }

        try {
            const msg = JSON.parse(data.toString())

            switch (msg.type) {
                case 'start':
                    seq = 0
                    logger.info({ userId, connectId }, 'ASR 收到 start 指令，开始连接上游')
                    connectUpstream()
                    break

                case 'finish':
                    logger.info({ userId, connectId, seq }, 'ASR 收到 finish 指令，发送最后一包')
                    if (upstreamWs && isConnected) {
                        const lastPacket = buildAudioPacket(Buffer.alloc(0), true)
                        sendUpstream(lastPacket)
                    }
                    break

                default:
                    logger.warn({ type: msg.type, userId }, 'ASR 未知消息类型')
            }
        } catch (err) {
            logger.error({ err: (err as Error).message, userId }, 'ASR 处理客户端消息失败')
            sendError('消息处理失败')
        }
    })

    clientWs.on('close', () => {
        logger.info({ userId, connectId }, 'ASR 客户端断开')
        if (upstreamWs && upstreamWs.readyState === WebSocket.OPEN) {
            try {
                const lastPacket = buildAudioPacket(Buffer.alloc(0), true)
                upstreamWs.send(lastPacket)
                setTimeout(() => upstreamWs?.close(), 500)
            } catch {
                upstreamWs.close()
            }
        }
    })

    clientWs.on('error', (err) => {
        logger.error({ err: (err as Error).message, userId }, 'ASR 客户端连接错误')
    })
}
