import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

interface ChatRequestBody {
  model: string;
  messages: { role: string; content: string }[];
  apiKey?: string;
}


export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Chat API: Failed to parse request JSON', { 
        error: parseError instanceof Error ? parseError.message : String(parseError) 
      });
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    
    const { model, messages, apiKey }: ChatRequestBody = body;

    // Set up OpenRouter API with proper error handling for API key
    const apiKeyToUse = apiKey || process.env.OPENROUTER_API_KEY;
    
    if (!apiKeyToUse) {
      console.error('Chat API: No API key provided');
      return NextResponse.json({ error: 'No API key provided' }, { status: 401 });
    }
  
    // Create axios instance for OpenRouter
    const openRouterApi = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'Authorization': `Bearer ${apiKeyToUse}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'AI Chat Cloneathon'
      },
      timeout: 60000, // 60 second timeout
    });

    // Make request to OpenRouter with better error handling
    console.log('Chat API: Sending request to OpenRouter', { model });
    
    try {
    
      console.log('Chat API: Sanitized messages for OpenRouter', {
        messageCount: messages.length,
        firstMessagePreview: messages[0] ? 
          `${messages[0].role}: ${messages[0].content.substring(0, 20)}...` : 
          'no messages'
      });
      console.log('Chat API: Messages', messages);

      const response = await openRouterApi.post(
        '/chat/completions',
        { model, messages: messages, stream: true },
        { responseType: 'stream' }
      );
      
      console.log('Chat API: Received response from OpenRouter', { 
        status: response.status,
        headers: response.headers
      });
      
      const stream = new ReadableStream({
        async start(controller) {
          console.log('Chat API: Stream started');
          
          if (!response.data || typeof response.data.on !== 'function') {
            console.error('Chat API: Invalid response data format', {
              dataType: typeof response.data,
              hasOnMethod: response.data && typeof response.data.on === 'function'
            });
            controller.error(new Error('Invalid response data format'));
            return;
          }
          
          let buffer = '';
          
          // Handle data chunks from Node.js stream
          response.data.on('data', (chunk: Buffer) => {
            const chunkText = chunk.toString('utf-8');            
            buffer += chunkText;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            

            let contentChunksFound = 0;
            
            for (const line of lines) {
              if (line.trim() === '') continue;
              if (line.startsWith('data: ')) {
                const dataContent = line.slice(6);
                if (dataContent === '[DONE]') {
                  continue;
                }
                try {
                  const data = JSON.parse(dataContent);
                  const content = data.choices?.[0]?.delta?.content || '';
                  if (content) {
                    contentChunksFound++;
                    controller.enqueue(new TextEncoder().encode(content));
                  }
                } catch (parseError) {
                  console.error('Chat API: JSON parse error', { 
                    line: dataContent.substring(0, 50) + (dataContent.length > 50 ? '...' : ''),
                    error: parseError instanceof Error ? parseError.message : String(parseError)
                  });
                }
              } else {
                // Ignore lines that start with ": " (e.g., ": OPENROUTER PROCESSING")
                if (!line.startsWith(': ')) {
                  console.warn('Chat API: Unexpected line format', { 
                    line: line.substring(0, 50) + (line.length > 50 ? '...' : '')
                  });
                }
              }
            }
          });
          
          // Handle end of stream
          response.data.on('end', () => {
            console.log('Chat API: Stream ended');
            controller.close();
          });
          
          // Handle stream errors
          response.data.on('error', (err: Error) => {
            console.error('Chat API: Stream error', {
              error: err.message,
              stack: err.stack
            });
            controller.error(err);
          });
        }
      });

      console.log('Chat API: Returning stream response');
      return new NextResponse(stream, { 
        headers: { 
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        } 
      });
      
    } catch (openRouterError) {
      console.error('Chat API: OpenRouter request failed', {
        error: openRouterError instanceof Error ? openRouterError.message : String(openRouterError),
        status: axios.isAxiosError(openRouterError) ? openRouterError.response?.status : undefined,
        data: axios.isAxiosError(openRouterError) ? openRouterError.response?.data : undefined
      });
      
      // Handle specific OpenRouter errors
      if (axios.isAxiosError(openRouterError) && openRouterError.response?.status === 401) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      } else if (axios.isAxiosError(openRouterError) && openRouterError.response?.status === 400) {
        return NextResponse.json({ 
          error: 'Bad request to OpenRouter API', 
          details: openRouterError.response?.data
        }, { status: 400 });
      } else {
        return NextResponse.json({ 
          error: 'OpenRouter API error', 
          message: openRouterError instanceof Error ? openRouterError.message : String(openRouterError)
        }, { status: 500 });
      }
    }
    
  } catch (error: unknown) {
    console.error('Chat API: Unhandled exception', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json({ 
      error: 'Server error', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
