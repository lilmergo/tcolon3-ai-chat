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
    const allModels = response.data.data.map((model) => ({
      id: model.id,
      name: model.name,
    }));

    // Filter to include only our recommended models
    const recommendedModelIds = [
      'meta-llama/llama-4-maverick:free',        // Meta's newest flagship model
      'meta-llama/llama-3.3-70b-instruct:free',  // Powerful large model from Meta
      'qwen/qwen3-235b-a22b:free',               // Qwen's largest model
      'deepseek/deepseek-r1:free',               // DeepSeek's flagship model
      'google/gemma-3-27b-it:free',              // Google's largest Gemma model
      'rekaai/reka-flash-3:free',                // Reka's latest model </reasoning>
      'moonshotai/kimi-dev-72b:free',            // Moonshot AI's large model, reasoning ◁/think▷
      'microsoft/phi-4-reasoning-plus:free',      // Microsoft's reasoning model <reasoning>
    ];

    // Filter models to only include recommended ones
    const recommendedModels = allModels.filter(model =>
      recommendedModelIds.includes(model.id)
    );

    // If we couldn't find any of our recommended models, return all free models
    if (recommendedModels.length === 0) {
      return NextResponse.json(allModels.filter(model => model.name.includes('(free)')));
    }

    return NextResponse.json(recommendedModels);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch models: ' + errorMessage },
      { status: 500 }
    );
  }
}
