import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { messages, max_tokens, temperature } = await req.json();

    // 模拟官网的请求头
    const headers = {
      "accept": "*/*",
      "accept-language": "en,zh-CN;q=0.9,zh;q=0.8,zh-TW;q=0.7",
      "content-type": "application/json",
      "dnt": "1",
      "origin": "https://ai.internxt.com",
      "priority": "u=1, i",
      "referer": "https://ai.internxt.com/",
      "sec-ch-ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    };

    const response = await fetch("https://backendai.internxt.com/", {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages,
        max_tokens: max_tokens || 4000,
        temperature: temperature || 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `Backend returned ${response.status}: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("AI Proxy Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
