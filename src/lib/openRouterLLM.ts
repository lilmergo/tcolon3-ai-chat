import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

/**
 * Custom OpenRouter LLM wrapper for LangChain
 */
export class OpenRouterLLM {
  private apiKey: string;
  private modelName: string;
  private temperature: number;
  private baseURL: string = 'https://openrouter.ai/api/v1';

  constructor(options: {
    apiKey?: string;
    modelName?: string;
    temperature?: number;
  } = {}) {
    // Clean the API key to remove any potential whitespace
    const rawApiKey = options.apiKey || process.env.OPENROUTER_API_KEY || '';
    this.apiKey = rawApiKey.trim();
    this.modelName = options.modelName || 'meta-llama/llama-3.2-3b-instruct'; // Paid model - very cheap but no rate limits
    this.temperature = options.temperature || 0;

    // Debug logging (can be removed in production)
    console.log('OpenRouter LLM initialized with model:', this.modelName);

    if (!this.apiKey) {
      throw new Error('OpenRouter API key is required. Set OPENROUTER_API_KEY environment variable or pass apiKey option.');
    }
  }

  /**
   * Invoke the LLM with a single message or array of messages
   */
  async invoke(messages: BaseMessage | BaseMessage[]): Promise<AIMessage> {
    const messageArray = Array.isArray(messages) ? messages : [messages];
    
    // Convert LangChain messages to OpenRouter format
    const openRouterMessages = messageArray.map(msg => ({
      role: this.getMessageRole(msg),
      content: msg.content as string
    }));

    try {
      const requestBody = {
        model: this.modelName,
        messages: openRouterMessages,
        temperature: this.temperature,
        max_tokens: 500, // Reduced from default 4096 to save credits
        stream: false,
      };

      // Log request for debugging
      console.log(`OpenRouter request: ${this.modelName}, ${openRouterMessages.length} messages`);

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'AI Chat Cloneathon',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.text();

        // Handle rate limiting with retry
        if (response.status === 429) {
          console.log('Rate limited, waiting 60 seconds before retry...');
          await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 60 seconds

          // Retry once
          const retryResponse = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'X-Title': 'AI Chat Cloneathon',
            },
            body: JSON.stringify(requestBody),
          });

          if (!retryResponse.ok) {
            const retryErrorData = await retryResponse.text();
            throw new Error(`OpenRouter API error after retry (${retryResponse.status}): ${retryErrorData}`);
          }

          const retryData = await retryResponse.json();
          const retryContent = retryData.choices?.[0]?.message?.content || '';
          return new AIMessage(retryContent);
        }

        throw new Error(`OpenRouter API error (${response.status}): ${errorData}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      return new AIMessage(content);
    } catch (error) {
      console.error('OpenRouter LLM error:', error);
      throw new Error(`Failed to get response from OpenRouter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a response for conversation summarization
   */
  async generateSummary(conversationText: string): Promise<string> {
    const summaryPrompt = `
    Please create a concise summary of the following conversation. 
    Focus on the main topics, key decisions, and important information that should be remembered for future reference.
    Keep the summary under 200 words.

    Conversation:
    ${conversationText}

    Summary:`;

    const response = await this.invoke([new HumanMessage(summaryPrompt)]);
    return response.content as string;
  }

  /**
   * Generate a response for thinking/reasoning tasks
   */
  async generateThinking(prompt: string, context?: string): Promise<string> {
    const messages: BaseMessage[] = [];
    
    if (context) {
      messages.push(new SystemMessage(`Context: ${context}`));
    }
    
    messages.push(new HumanMessage(prompt));
    
    const response = await this.invoke(messages);
    return response.content as string;
  }

  /**
   * Convert LangChain message types to OpenRouter role format
   */
  private getMessageRole(message: BaseMessage): string {
    if (message instanceof HumanMessage) {
      return 'user';
    } else if (message instanceof AIMessage) {
      return 'assistant';
    } else if (message instanceof SystemMessage) {
      return 'system';
    } else {
      // Fallback for other message types
      return 'user';
    }
  }

  /**
   * Set the model name
   */
  setModel(modelName: string): void {
    this.modelName = modelName;
  }

  /**
   * Set the temperature
   */
  setTemperature(temperature: number): void {
    this.temperature = temperature;
  }

  /**
   * Get current model name
   */
  getModel(): string {
    return this.modelName;
  }

  /**
   * Get current temperature
   */
  getTemperature(): number {
    return this.temperature;
  }
}
