import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabase';
import type { ParsedCarListing } from './types';

async function getSettings() {
  try {
    // Get provider first
    const { data: provider, error: providerError } = await supabase.rpc('get_ai_provider');
    if (providerError) throw providerError;

    const currentProvider = provider || 'gemini';
    
    // Get settings based on provider
    switch (currentProvider) {
      case 'gemini': {
        const [
          { data: apiKey, error: apiKeyError },
          { data: prompt, error: promptError }
        ] = await Promise.all([
          supabase.rpc('get_gemini_apikey'),
          supabase.rpc('get_gemini_prompt')
        ]);
        if (apiKeyError) throw apiKeyError;
        if (promptError) throw promptError;
        return {
          gemini_api_key: apiKey || '',
          gemini_prompt: prompt || '',
          ai_provider: 'gemini'
        };
      }
      case 'deepseek': {
        const [
          { data: apiKey, error: apiKeyError },
          { data: prompt, error: promptError }
        ] = await Promise.all([
          supabase.rpc('get_deepseek_apikey'),
          supabase.rpc('get_deepseek_prompt')
        ]);
        if (apiKeyError) throw apiKeyError;
        if (promptError) throw promptError;
        return {
          deepseek_api_key: apiKey || '',
          deepseek_prompt: prompt || '',
          ai_provider: 'deepseek'
        };
      }
      case 'openrouter': {
        const [
          { data: apiKey, error: apiKeyError },
          { data: prompt, error: promptError },
          { data: siteUrl, error: siteUrlError },
          { data: siteName, error: siteNameError }
        ] = await Promise.all([
          supabase.rpc('get_openrouter_apikey'),
          supabase.rpc('get_openrouter_prompt'),
          supabase.rpc('get_openrouter_site_url'),
          supabase.rpc('get_openrouter_site_name')
        ]);
        if (apiKeyError) throw apiKeyError;
        if (promptError) throw promptError;
        if (siteUrlError) throw siteUrlError;
        if (siteNameError) throw siteNameError;
        return {
          openrouter_api_key: apiKey || '',
          openrouter_prompt: prompt || '',
          site_url: siteUrl || window.location.origin,
          site_name: siteName || 'BananaDB',
          ai_provider: 'openrouter'
        };
      }
      default:
        throw new Error(`Unknown AI provider: ${currentProvider}`);
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
    throw error instanceof Error ? error : new Error('Failed to load AI settings');
  }
}

export async function parseCarListing(input: string): Promise<ParsedCarListing[]> {
  const settings = await getSettings();

  switch (settings.ai_provider) {
    case 'gemini': {
      if (!settings.gemini_api_key?.trim()) {
        throw new Error('Gemini API key is required');
      }

      console.log('Initializing Gemini...');
      const genAI = new GoogleGenerativeAI(settings.gemini_api_key.trim());
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      try {
        console.log('Sending request to Gemini with prompt:', settings.gemini_prompt);
        const result = await model.generateContent([
          settings.gemini_prompt,
          input
        ]);
        const response = await result.response;
        const text = response.text();
        
        console.log('Raw Gemini response:', text);
        return parseAIResponse(text);
      } catch (error) {
        console.error('Gemini parsing error:', error);
        throw error;
      }
    }

    case 'deepseek': {
      if (!settings.deepseek_api_key?.trim()) {
        throw new Error('Deepseek API key is required');
      }

      console.log('Initializing Deepseek...');
      
      try {
        console.log('Sending request to Deepseek with prompt:', settings.deepseek_prompt);
        
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.deepseek_api_key.trim()}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              {
                role: "system",
                content: settings.deepseek_prompt
              },
              {
                role: "user",
                content: input
              }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
          })
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('Deepseek error response:', error);
          throw new Error(error.error?.message || 'Failed to get response from Deepseek');
        }

        const data = await response.json();
        console.log('Raw Deepseek response:', data);

        const content = data.choices[0]?.message?.content;
        
        if (!content) {
          throw new Error('No content in Deepseek response');
        }

        console.log('Deepseek content:', content);
        return parseAIResponse(content);
      } catch (error) {
        console.error('Deepseek parsing error:', error);
        throw error;
      }
    }

    case 'openrouter': {
      if (!settings.openrouter_api_key?.trim()) {
        throw new Error('OpenRouter API key is required');
      }

      console.log('Initializing OpenRouter...');
      
      try {
        console.log('Sending request to OpenRouter with prompt:', settings.openrouter_prompt);
        
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.openrouter_api_key.trim()}`,
            'HTTP-Referer': settings.site_url || window.location.origin,
            'X-Title': settings.site_name || 'BananaDB'
          },
          body: JSON.stringify({
            model: "anthropic/claude-2",
            messages: [
              {
                role: "system",
                content: settings.openrouter_prompt
              },
              {
                role: "user",
                content: input
              }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
          })
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('OpenRouter error response:', error);
          throw new Error(error.error?.message || 'Failed to get response from OpenRouter');
        }

        const data = await response.json();
        console.log('Raw OpenRouter response:', data);

        const content = data.choices[0]?.message?.content;
        
        if (!content) {
          throw new Error('No content in OpenRouter response');
        }

        console.log('OpenRouter content:', content);
        return parseAIResponse(content);
      } catch (error) {
        console.error('OpenRouter parsing error:', error);
        throw error;
      }
    }

    default:
      throw new Error(`Unknown AI provider: ${settings.ai_provider}`);
  }
}

function parseAIResponse(text: string): ParsedCarListing[] {
  try {
    // Try to parse as JSON
    const data = JSON.parse(text);

    // Check if we have a listings array
    if (!data.listings || !Array.isArray(data.listings)) {
      throw new Error('Response does not contain a listings array');
    }

    // Validate each listing
    const validListings = data.listings.filter((listing: any) => {
      return (
        listing &&
        typeof listing.make === 'string' &&
        typeof listing.model === 'string' &&
        typeof listing.year === 'number' &&
        typeof listing.mileage === 'number' &&
        typeof listing.price === 'number'
      );
    });

    if (validListings.length === 0) {
      throw new Error('No valid listings found in response');
    }

    return validListings;
  } catch (error) {
    console.error('Error parsing AI response:', error);
    throw new Error('Failed to parse AI response');
  }
}