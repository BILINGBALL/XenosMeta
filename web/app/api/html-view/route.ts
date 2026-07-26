import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 })
  }

  try {
    const res = await fetch(url)
    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch: ${res.status}` }, { status: res.status })
    }

    const buf = await res.arrayBuffer()
    // 强制以 UTF-8 解码，解决后端未指定 charset 导致的乱码
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Fetch error' }, { status: 500 })
  }
}
