
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { ThinkingStep, KnowledgeBaseReference } from '@/types/chat';
import { KnowledgeBaseManager } from './knowledgeBase';
import { OpenRouterLLM } from './openRouterLLM';

// Define the state interface for our thinking pipeline
interface ThinkingState {
  messages: BaseMessage[];
  userQuery: string;
  currentStep: string;
  thinkingSteps: ThinkingStep[];
  knowledgeBaseReferences: KnowledgeBaseReference[];
  webSearchResults: any[];
  needsKnowledgeBase: boolean;
  needsWebSearch: boolean;
  finalResponse: string;
  userId: string;
  chatId: string;
}

export class LangGraphThinkingPipeline {
  private graph: { invoke: (state: ThinkingState) => Promise<ThinkingState> };
  private llm: OpenRouterLLM;
  private kbManager: KnowledgeBaseManager;

  constructor(userId: string, apiKey?: string) {
    // Initialize the language model with OpenRouter
    this.llm = new OpenRouterLLM({
      apiKey: apiKey || process.env.OPENROUTER_API_KEY,
      modelName: 'meta-llama/llama-3.2-3b-instruct',
      temperature: 0.1,
    });

    this.kbManager = new KnowledgeBaseManager(userId);
    this.graph = this.buildGraph();
  }

  private buildGraph(): any {
    // Simplified implementation without complex LangGraph features
    // This will be a simple sequential processor for now
    return {
      invoke: async (state: ThinkingState) => {
        // Simple sequential execution
        let currentState = state;

        currentState = { ...currentState, ...(await this.analyzeQuery(currentState)) };
        currentState = { ...currentState, ...(await this.planApproach(currentState)) };

        if (currentState.needsKnowledgeBase) {
          currentState = { ...currentState, ...(await this.queryKnowledgeBase(currentState)) };
        }

        if (currentState.needsWebSearch) {
          currentState = { ...currentState, ...(await this.performWebSearch(currentState)) };
        }

        currentState = { ...currentState, ...(await this.synthesizeInformation(currentState)) };
        currentState = { ...currentState, ...(await this.generateResponse(currentState)) };

        return currentState;
      }
    };
  }

  /**
   * Step 1: Analyze the user's query to understand intent and complexity
   */
  private async analyzeQuery(state: ThinkingState): Promise<Partial<ThinkingState>> {
    const startTime = Date.now();
    
    const analysisPrompt = `
    Analyze the following user query and determine:
    1. The main intent and topic
    2. The complexity level (simple, moderate, complex)
    3. What type of information might be needed
    4. Whether it requires current/real-time information
    5. Whether it might benefit from domain-specific knowledge

    User Query: "${state.userQuery}"

    Provide your analysis in a structured format.
    `;

    const response = await this.llm.invoke([
      new SystemMessage('You are an expert query analyzer. Provide clear, structured analysis.'),
      new HumanMessage(analysisPrompt)
    ]);

    const thinkingStep: ThinkingStep = {
      id: `step-${Date.now()}`,
      stepType: 'analysis',
      title: 'Query Analysis',
      content: response.content as string,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
    };

    // Call the callback if provided
    const onStepComplete = (state as any).onStepComplete;
    if (onStepComplete) {
      onStepComplete(thinkingStep);
    }

    return {
      currentStep: 'analyze_query',
      thinkingSteps: [...state.thinkingSteps, thinkingStep],
      messages: [...state.messages, response],
    };
  }

  /**
   * Step 2: Plan the approach based on the analysis
   */
  private async planApproach(state: ThinkingState): Promise<Partial<ThinkingState>> {
    const startTime = Date.now();
    
    const planningPrompt = `
    Based on the query analysis, create a plan for answering the user's question.
    
    User Query: "${state.userQuery}"
    Previous Analysis: ${state.thinkingSteps[state.thinkingSteps.length - 1]?.content}

    Determine:
    1. Do we need to search the user's knowledge base? (YES/NO)
    2. Do we need to perform a web search for current information? (YES/NO)
    3. What's the best approach to structure the response?

    Respond with:
    KNOWLEDGE_BASE: YES/NO
    WEB_SEARCH: YES/NO
    APPROACH: [your reasoning approach]
    `;

    const response = await this.llm.invoke([
      new SystemMessage('You are a strategic planner. Make clear decisions about information needs.'),
      new HumanMessage(planningPrompt)
    ]);

    const responseText = response.content as string;
    const needsKnowledgeBase = responseText.includes('KNOWLEDGE_BASE: YES');
    const needsWebSearch = responseText.includes('WEB_SEARCH: YES');

    const thinkingStep: ThinkingStep = {
      id: `step-${Date.now()}`,
      stepType: 'planning',
      title: 'Approach Planning',
      content: responseText,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
    };

    // Call the callback if provided
    const onStepComplete = (state as any).onStepComplete;
    if (onStepComplete) {
      onStepComplete(thinkingStep);
    }

    return {
      currentStep: 'plan_approach',
      thinkingSteps: [...state.thinkingSteps, thinkingStep],
      needsKnowledgeBase,
      needsWebSearch,
      messages: [...state.messages, response],
    };
  }

  /**
   * Route to next step based on needs
   */
  private routeBasedOnNeeds(state: ThinkingState): string {
    if (state.needsKnowledgeBase) {
      return 'knowledge_base';
    } else if (state.needsWebSearch) {
      return 'web_search';
    } else {
      return 'synthesize';
    }
  }

  /**
   * Step 3a: Query the knowledge base if needed
   */
  private async queryKnowledgeBase(state: ThinkingState): Promise<Partial<ThinkingState>> {
    const startTime = Date.now();
    
    try {
      // Query the knowledge base
      const relevantDocs = await this.kbManager.queryKnowledgeBase(state.userQuery, 3);
      
      const kbReferences: KnowledgeBaseReference[] = relevantDocs.map(doc => ({
        documentId: doc.id,
        documentTitle: doc.metadata.title || doc.originalFileName,
        relevanceScore: 0.8, // TODO: Implement proper scoring
        excerpt: doc.metadata.title || '',
        chunkId: `${doc.id}-chunk-0`,
      }));

      const thinkingStep: ThinkingStep = {
        id: `step-${Date.now()}`,
        stepType: 'knowledge_query',
        title: 'Knowledge Base Search',
        content: `Found ${relevantDocs.length} relevant documents in knowledge base:\n${
          relevantDocs.map(doc => `- ${doc.metadata.title || doc.originalFileName}`).join('\n')
        }`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };

      return {
        currentStep: 'query_knowledge_base',
        thinkingSteps: [...state.thinkingSteps, thinkingStep],
        knowledgeBaseReferences: kbReferences,
      };
    } catch (error) {
      const thinkingStep: ThinkingStep = {
        id: `step-${Date.now()}`,
        stepType: 'knowledge_query',
        title: 'Knowledge Base Search',
        content: `Error querying knowledge base: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };

      return {
        currentStep: 'query_knowledge_base',
        thinkingSteps: [...state.thinkingSteps, thinkingStep],
        knowledgeBaseReferences: [],
      };
    }
  }

  /**
   * Step 3b: Perform web search if needed
   */
  private async performWebSearch(state: ThinkingState): Promise<Partial<ThinkingState>> {
    const startTime = Date.now();
    
    try {
      // Call the existing web search API
      const searchResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: state.userQuery }),
      });

      if (!searchResponse.ok) {
        throw new Error(`Search failed: ${searchResponse.status}`);
      }

      const { results } = await searchResponse.json();

      const thinkingStep: ThinkingStep = {
        id: `step-${Date.now()}`,
        stepType: 'web_search',
        title: 'Web Search',
        content: `Found ${results?.length || 0} web search results for current information.`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };

      return {
        currentStep: 'perform_web_search',
        thinkingSteps: [...state.thinkingSteps, thinkingStep],
        webSearchResults: results || [],
      };
    } catch (error) {
      const thinkingStep: ThinkingStep = {
        id: `step-${Date.now()}`,
        stepType: 'web_search',
        title: 'Web Search',
        content: `Error performing web search: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };

      return {
        currentStep: 'perform_web_search',
        thinkingSteps: [...state.thinkingSteps, thinkingStep],
        webSearchResults: [],
      };
    }
  }

  /**
   * Step 4: Synthesize information from all sources
   */
  private async synthesizeInformation(state: ThinkingState): Promise<Partial<ThinkingState>> {
    const startTime = Date.now();
    
    const synthesisPrompt = `
    Synthesize information from multiple sources to prepare a comprehensive response.

    User Query: "${state.userQuery}"
    
    Available Information:
    ${state.knowledgeBaseReferences.length > 0 ? `
    Knowledge Base References:
    ${state.knowledgeBaseReferences.map(ref => `- ${ref.documentTitle}: ${ref.excerpt}`).join('\n')}
    ` : ''}
    
    ${state.webSearchResults.length > 0 ? `
    Web Search Results:
    ${state.webSearchResults.map((result: any) => `- ${result.title}: ${result.snippet}`).join('\n')}
    ` : ''}

    Create a synthesis that:
    1. Identifies key themes and insights
    2. Resolves any conflicts between sources
    3. Highlights the most relevant information
    4. Notes any gaps that still exist
    `;

    const response = await this.llm.invoke([
      new SystemMessage('You are an expert information synthesizer. Create clear, coherent summaries.'),
      new HumanMessage(synthesisPrompt)
    ]);

    const thinkingStep: ThinkingStep = {
      id: `step-${Date.now()}`,
      stepType: 'synthesis',
      title: 'Information Synthesis',
      content: response.content as string,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
    };

    return {
      currentStep: 'synthesize_information',
      thinkingSteps: [...state.thinkingSteps, thinkingStep],
      messages: [...state.messages, response],
    };
  }

  /**
   * Step 5: Generate the final response
   */
  private async generateResponse(state: ThinkingState): Promise<Partial<ThinkingState>> {
    const startTime = Date.now();
    
    const responsePrompt = `
    Generate a comprehensive, helpful response to the user's query based on all the analysis and information gathered.

    User Query: "${state.userQuery}"
    
    Synthesis: ${state.thinkingSteps[state.thinkingSteps.length - 1]?.content}
    
    Create a response that:
    1. Directly addresses the user's question
    2. Is well-structured and easy to understand
    3. Cites sources when appropriate
    4. Acknowledges limitations if any exist
    5. Is helpful and actionable
    `;

    const response = await this.llm.invoke([
      new SystemMessage('You are a helpful AI assistant. Provide clear, accurate, and useful responses.'),
      new HumanMessage(responsePrompt)
    ]);

    const thinkingStep: ThinkingStep = {
      id: `step-${Date.now()}`,
      stepType: 'reasoning',
      title: 'Response Generation',
      content: 'Generated final response based on synthesized information.',
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
    };

    // Call the callback if provided
    const onStepComplete = (state as any).onStepComplete;
    if (onStepComplete) {
      onStepComplete(thinkingStep);
    }

    return {
      currentStep: 'generate_response',
      thinkingSteps: [...state.thinkingSteps, thinkingStep],
      finalResponse: response.content as string,
      messages: [...state.messages, response],
    };
  }

  /**
   * Execute the thinking pipeline
   */
  async executeThinking(
    userQuery: string,
    userId: string,
    chatId: string,
    conversationHistory: BaseMessage[] = [],
    onStepComplete?: (step: ThinkingStep) => void
  ): Promise<{
    response: string;
    thinkingSteps: ThinkingStep[];
    knowledgeBaseReferences: KnowledgeBaseReference[];
    webSearchResults: any[];
  }> {
    const initialState: ThinkingState = {
      messages: conversationHistory,
      userQuery,
      currentStep: '',
      thinkingSteps: [],
      knowledgeBaseReferences: [],
      webSearchResults: [],
      needsKnowledgeBase: false,
      needsWebSearch: false,
      finalResponse: '',
      userId,
      chatId,
    };

    // Store the callback in the state for access in step functions
    (initialState as any).onStepComplete = onStepComplete;

    const finalState = await this.graph.invoke(initialState);

    return {
      response: finalState.finalResponse,
      thinkingSteps: finalState.thinkingSteps,
      knowledgeBaseReferences: finalState.knowledgeBaseReferences,
      webSearchResults: finalState.webSearchResults,
    };
  }
}
