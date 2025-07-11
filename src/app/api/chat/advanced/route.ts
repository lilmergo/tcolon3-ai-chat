import { NextRequest, NextResponse } from 'next/server';
import { adminDb, getUserFromRequest } from '@/lib/firebase-admin';
import { LangGraphThinkingPipeline } from '@/lib/langGraphPipeline';
import { ConversationMemoryManager } from '@/lib/conversationMemory';
import { EnhancedChat, EnhancedChatMessage } from '@/types/chat';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { encryptMessage, generateEncryptionKey } from '@/lib/encryption';

interface AdvancedChatRequestBody {
  chatId: string;
  userId: string;
  message: string;
  model?: string;
  apiKey?: string;
  advancedThinking?: boolean;
  knowledgeBaseEnabled?: boolean;
  webSearchEnabled?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user first
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body: AdvancedChatRequestBody = await request.json();
    const {
      chatId,
      userId,
      message,
      model = 'gpt-4',
      apiKey,
      advancedThinking = false,
      knowledgeBaseEnabled = false,
      webSearchEnabled = false
    } = body;

    // Validate required fields
    if (!chatId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: chatId, message' },
        { status: 400 }
      );
    }

    // Ensure the authenticated user matches the request
    if (userId && userId !== user.uid) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // Use authenticated user's ID
    const authenticatedUserId = user.uid;

    // Get chat configuration using admin SDK
    const chatDoc = await adminDb.collection('chats').doc(chatId).get();
    if (!chatDoc.exists) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    const chatData = chatDoc.data() as EnhancedChat;

    // Check if user has access to this chat
    if (!chatData.participants.includes(authenticatedUserId)) {
      return NextResponse.json(
        { error: 'Unauthorized access to chat' },
        { status: 403 }
      );
    }

    // Initialize memory manager - prioritize environment variable
    const actualApiKey = process.env.OPENROUTER_API_KEY || apiKey;

    const memoryManager = new ConversationMemoryManager(
      chatId,
      authenticatedUserId,
      chatData.memoryStrategy || 'summary',
      chatData.maxMemoryTokens || 4000,
      actualApiKey
    );

    // Get conversation context
    const conversationHistory = await memoryManager.getConversationContext();

    let response: string;
    let thinkingSteps: any[] = [];
    let knowledgeBaseReferences: any[] = [];
    let webSearchResults: any[] = [];
    let processingMetadata: any = {
      model,
      processingTime: 0,
      advancedMode: advancedThinking,
    };

    const startTime = Date.now();

    if (advancedThinking) {
      // Use LangGraph thinking pipeline - prioritize environment variable
      const actualApiKey = process.env.OPENROUTER_API_KEY || apiKey;
      const thinkingPipeline = new LangGraphThinkingPipeline(authenticatedUserId, actualApiKey);

      // Create a streaming response for thinking steps
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Create initial message in Firebase for streaming updates
            const assistantMessageRef = await adminDb.collection('chats').doc(chatId).collection('messages').add({
              role: 'assistant',
              encryptedContent: encryptMessage('', generateEncryptionKey(authenticatedUserId)),
              timestamp: new Date().toISOString(),
              uid: 'assistant',
              thinkingSteps: [],
              processingMetadata: {
                model,
                processingTime: 0,
                advancedMode: true,
                langGraphState: 'processing',
              },
            });

            let currentThinkingSteps: any[] = [];

            const result = await thinkingPipeline.executeThinking(
              message,
              authenticatedUserId,
              chatId,
              conversationHistory,
              // Streaming callback for each completed step
              async (step) => {
                console.log('Advanced API: Streaming thinking step:', step.title);
                currentThinkingSteps.push(step);

                // Update Firebase with new thinking step
                await assistantMessageRef.update({
                  thinkingSteps: currentThinkingSteps,
                });

                // Send step to client via stream
                const stepData = JSON.stringify({
                  type: 'thinking_step',
                  step: step,
                }) + '\n';
                controller.enqueue(new TextEncoder().encode(stepData));
                console.log('Advanced API: Sent thinking step to client');
              }
            );

            // Update with final response
            await assistantMessageRef.update({
              encryptedContent: encryptMessage(result.response, generateEncryptionKey(authenticatedUserId)),
              thinkingSteps: result.thinkingSteps,
              knowledgeBaseReferences: result.knowledgeBaseReferences,
              processingMetadata: {
                model,
                processingTime: Date.now() - startTime,
                advancedMode: true,
                langGraphState: 'completed',
              },
            });

            // Send final response
            const finalData = JSON.stringify({
              type: 'final_response',
              response: result.response,
              thinkingSteps: result.thinkingSteps,
              knowledgeBaseReferences: result.knowledgeBaseReferences,
              webSearchResults: result.webSearchResults,
              processingMetadata: {
                model,
                processingTime: Date.now() - startTime,
                advancedMode: true,
                langGraphState: 'completed',
              },
            }) + '\n';
            controller.enqueue(new TextEncoder().encode(finalData));
            controller.close();

          } catch (error) {
            console.error('Advanced thinking stream error:', error);
            controller.error(error);
          }
        }
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Use simple OpenRouter API call (existing logic)
      const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${actualApiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'AI Chat Cloneathon',
        },
        body: JSON.stringify({
          model,
          messages: [
            ...conversationHistory.map(msg => ({
              role: msg.constructor.name === 'HumanMessage' ? 'user' : 'assistant',
              content: msg.content
            })),
            { role: 'user', content: message }
          ],
        }),
      });

      if (!openRouterResponse.ok) {
        throw new Error(`OpenRouter API error: ${openRouterResponse.status}`);
      }

      const openRouterData = await openRouterResponse.json();
      response = openRouterData.choices[0]?.message?.content || 'No response generated';

      // Handle web search if enabled
      if (webSearchEnabled) {
        try {
          const searchResponse = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: message }),
          });

          if (searchResponse.ok) {
            const { results } = await searchResponse.json();
            webSearchResults = results || [];
          }
        } catch (error) {
          console.error('Web search failed:', error);
        }
      }
    }

    processingMetadata.processingTime = Date.now() - startTime;

    // Add the new message to memory
    await memoryManager.addMessage(new HumanMessage(message));
    await memoryManager.addMessage(new AIMessage(response));

    // Update chat's last activity using admin SDK
    await adminDb.collection('chats').doc(chatId).update({
      updatedAt: new Date().toISOString(),
    });

    // Return the enhanced response
    const enhancedResponse = {
      response,
      thinkingSteps,
      knowledgeBaseReferences,
      webSearchResults,
      processingMetadata,
      memoryContext: {
        tokenCount: processingMetadata.processingTime, // Placeholder
        summaryGenerated: false,
        contextWindow: [], // Would contain message IDs
      },
    };

    return NextResponse.json(enhancedResponse);

  } catch (error) {
    console.error('Advanced chat API error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        response: 'I apologize, but I encountered an error processing your request. Please try again.',
        thinkingSteps: [],
        knowledgeBaseReferences: [],
        webSearchResults: [],
        processingMetadata: {
          model: 'error',
          processingTime: 0,
          advancedMode: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve chat configuration and memory stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');
    const userId = searchParams.get('userId');

    if (!chatId || !userId) {
      return NextResponse.json(
        { error: 'Missing chatId or userId' },
        { status: 400 }
      );
    }

    // Get chat configuration using admin SDK
    const chatDoc = await adminDb.collection('chats').doc(chatId).get();
    if (!chatDoc.exists) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    const chatData = chatDoc.data() as EnhancedChat;
    
    // Check access
    if (!chatData.participants.includes(userId)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get memory statistics
    const memoryManager = new ConversationMemoryManager(
      chatId,
      userId,
      chatData.memoryStrategy || 'summary'
    );

    const memoryStats = await memoryManager.getMemoryStats();

    return NextResponse.json({
      chatConfig: {
        advancedThinkingEnabled: chatData.advancedThinkingEnabled || false,
        knowledgeBaseEnabled: chatData.knowledgeBaseEnabled || false,
        memoryStrategy: chatData.memoryStrategy || 'simple',
        maxMemoryTokens: chatData.maxMemoryTokens || 4000,
        settings: chatData.settings || {
          webSearchEnabled: false,
          thinkingStepsVisible: true,
          knowledgeBaseWeight: 0.5,
        },
      },
      memoryStats,
    });

  } catch (error) {
    console.error('Get chat config error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT endpoint to update chat configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId, userId, config } = body;

    if (!chatId || !userId || !config) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get chat document using admin SDK
    const chatDoc = await adminDb.collection('chats').doc(chatId).get();
    if (!chatDoc.exists) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    const chatData = chatDoc.data() as EnhancedChat;
    
    // Check if user is the creator or has permission to modify
    if (chatData.createdBy !== userId && !chatData.participants.includes(userId)) {
      return NextResponse.json(
        { error: 'Unauthorized to modify chat' },
        { status: 403 }
      );
    }

    // Update chat configuration
    const updateData: Partial<EnhancedChat> = {
      advancedThinkingEnabled: config.advancedThinkingEnabled,
      knowledgeBaseEnabled: config.knowledgeBaseEnabled,
      memoryStrategy: config.memoryStrategy,
      maxMemoryTokens: config.maxMemoryTokens,
      settings: {
        ...chatData.settings,
        ...config.settings,
      },
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection('chats').doc(chatId).update(updateData);

    // If memory strategy changed, update the memory manager
    if (config.memoryStrategy && config.memoryStrategy !== chatData.memoryStrategy) {
      const memoryManager = new ConversationMemoryManager(chatId, userId);
      await memoryManager.updateMemoryStrategy(config.memoryStrategy);
    }

    return NextResponse.json({ 
      success: true,
      message: 'Chat configuration updated successfully'
    });

  } catch (error) {
    console.error('Update chat config error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
