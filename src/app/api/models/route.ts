import { NextResponse } from 'next/server';
import axios from 'axios';

interface OpenRouterModelResponse {
  data: { id: string; name: string }[];
}

const openRouterApi = axios.create({
  baseURL: 'https://openrouter.ai/api/v1',
  headers: {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

export async function GET() {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key is not configured' },
        { status: 500 }
      );
    }

    const response = await openRouterApi.get<OpenRouterModelResponse>('/models');
    const models = response.data.data.map((model) => ({
      id: model.id,
      name: model.name,
    }));

    return NextResponse.json(models);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch models: ' + errorMessage },
      { status: 500 }
    );
  }
}