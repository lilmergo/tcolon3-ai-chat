import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

interface SearchRequestBody {
    query: string;
}

function shouldPerformWebSearch(query: string): boolean {
    const lowerQuery = query.toLowerCase().trim();

    // Keywords indicating real-time or factual information needs
    const searchIndicators = [
        'latest', 'recent', 'news', 'current', 'update', 'today', 'this week', 'this month', 'this year',
        'stock price', 'weather', 'event', 'trend', 'breaking',
        'search for', 'find information', 'look up'
    ];
    const containsIndicator = searchIndicators.some(indicator => lowerQuery.includes(indicator));

    const isQuestion = /^(how|what|why|when|where|which|who)\b/i.test(lowerQuery) ||
                       /\?$/.test(lowerQuery.trim());

    // Exclude queries that are conversational or unlikely to need web search
    const excludePatterns = [
        'your name', 'who are you', 'what can you do', 'how are you',
        'what is your', 'tell me a joke', 'how do you feel'
    ];
    const isExcluded = excludePatterns.some(pattern => lowerQuery.includes(pattern));

    // Include queries with named entities or time-sensitive terms
    const hasNamedEntity = /[A-Z][a-z]+ [A-Z][a-z]+/.test(query) || // e.g., "The Beatles"
                          /\d{4}/.test(query) || // e.g., "2025"
                          /price|cost|value|weather|event/i.test(lowerQuery);

    return (containsIndicator || isQuestion || hasNamedEntity) && !isExcluded;
}

function refineSearchQuery(query: string): string {
    let refined = query.toLowerCase().trim();

    const fillerWords = [
        'hey', 'hi', 'hello', 'please', 'could you', 'can you', 'i want to know',
        'tell me', 'what\'s going on with', 'give me', 'about', 'like', 'um', 'uh'
    ];
    const fillerRegex = new RegExp(`\\b(${fillerWords.join('|')})\\b`, 'gi');
    refined = refined.replace(fillerRegex, '').replace(/\s+/g, ' ').trim();
    refined = refined.replace(/[^\w\s\'\?\-]/g, ' ').replace(/\s+/g, ' ').trim();

    const keyTerms = refined.split(' ').filter(term => {
        return term.length > 2 && (
            /[A-Z]/.test(term[0]) ||
            /\d/.test(term) ||
            !/^(is|are|was|were|in|on|at|the|a|an)$/i.test(term)
        );
    });
    
    refined = keyTerms.join(' ');

    const currentYear = new Date().getFullYear();
    if (/latest|recent|current|today|this week|this month|this year/i.test(query)) {
        refined += ` ${currentYear}`;
    }

    if (refined.length > 80) {
        refined = refined.substring(0, 80).trim();
        const lastSpace = refined.lastIndexOf(' ');
        if (lastSpace > 50) refined = refined.substring(0, lastSpace);
    }
    return refined || query.trim();
}

export async function POST(request: NextRequest) {
    console.log('Search API: Received search request');
    try {
        const { query }: SearchRequestBody = await request.json();

        if (!process.env.SERPER_API_KEY) {
            console.error('Search API: No SERPER_API_KEY provided');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        if (!query || typeof query !== 'string') {
            console.error('Search API: Invalid query', { query });
            return NextResponse.json({ error: 'Invalid search query' }, { status: 400 });
        }
        
        // Check if query warrants web search
        if (!shouldPerformWebSearch(query)) {
            console.log('Search API: Query does not warrant web search', { query });
            return NextResponse.json({ results: [], searchPerformed: false }, { status: 200 });
        }
        
        // Refine the query for better search results
        const refinedQuery = refineSearchQuery(query);
        console.log('Search API: Refined query', { original: query, refined: refinedQuery });

        const config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://google.serper.dev/search?q=${encodeURIComponent(refinedQuery)}&apiKey=${process.env.SERPER_API_KEY}`,
            headers: {}
        };

        const searchResponse = await axios.request(config);
        
        // Extract only the necessary data to avoid circular references
        const results = searchResponse.data.organic?.slice(0, 3).map((result: { link: string; title: string; snippet: string }) => ({
            url: result.link,
            title: result.title,
            snippet: result.snippet,
        })) || [];

        console.log('Search API: Successfully fetched results', { resultCount: results.length });

        return NextResponse.json({ results, searchPerformed: true }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Search API: Failed to fetch search results', {
            error: errorMessage,
            status: axios.isAxiosError(error) ? error.response?.status : undefined,
        });
        return NextResponse.json(
            { error: 'Failed to fetch search results: ' + errorMessage },
            { status: axios.isAxiosError(error) ? error.response?.status || 500 : 500 }
        );
    }
}
