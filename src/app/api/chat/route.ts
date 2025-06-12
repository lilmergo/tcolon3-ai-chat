import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

interface ChatRequestBody {
  model: string;
  messages: { role: string; content: string }[];
  apiKey?: string;
}

const openRouterApi = axios.create({
  baseURL: 'https://openrouter.ai/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function POST(request: NextRequest) {
  try {
    const { model, messages, apiKey }: ChatRequestBody = await request.json();

    if (!model || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid request: model and messages are required' },
        { status: 400 }
      );
    }

    const headers = apiKey
      ? { Authorization: `Bearer ${apiKey}` }
      : { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` };

    if (!headers.Authorization || headers.Authorization === 'Bearer ') {
      return NextResponse.json(
        { error: 'No valid API key provided. Please enter an OpenRouter API key.' },
        { status: 401 }
      );
    }

    const response = await openRouterApi.post<{ choices: { message: { content: string } }[] }>(
      '/chat/completions',
      { model, messages },
      { headers }
    );

    return NextResponse.json({ content: response.data.choices[0].message.content });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('401')) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your OpenRouter API key.' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to send message: ' + errorMessage },
      { status: 500 }
    );
  }
}