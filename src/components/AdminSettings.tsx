import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2, Check, X, Bug } from 'lucide-react';
import { DataSourcesManager } from './DataSourcesManager';
import { AdminUsers } from './AdminUsers';
import { supabase } from '../lib/supabase';

const inputClassName = "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm";

interface AIStatus {
  loading: boolean;
  error: string | null;
  settings: {
    provider: string;
    hasKey: boolean;
    hasPrompt: boolean;
  } | null;
}

type SettingsTab = 'ai' | 'users' | 'data-sources';

export function AdminSettings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [aiResponse, setAiResponse] = useState<{
    raw: string;
    parsed?: any;
    error?: string;
  } | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus>({
    loading: true,
    error: null,
    settings: null
  });
  const [settings, setSettings] = useState({
    gemini_api_key: '',
    gemini_prompt: '',
    deepseek_api_key: '',
    deepseek_prompt: '',
    openrouter_api_key: '',
    openrouter_prompt: '',
    site_url: window.location.origin,
    site_name: 'BananaDB',
    ai_provider: 'gemini' as 'gemini' | 'deepseek' | 'openrouter'
  });
  const [isUpdatingProvider, setIsUpdatingProvider] = useState(false);
  const [isSavingGemini, setIsSavingGemini] = useState(false);
  const [isSavingDeepseek, setIsSavingDeepseek] = useState(false);
  const [isSavingOpenRouter, setIsSavingOpenRouter] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Load all settings in parallel
        const [
          { data: geminiApiKey, error: geminiKeyError },
          { data: geminiPrompt, error: geminiPromptError },
          { data: deepseekApiKey, error: deepseekKeyError },
          { data: deepseekPrompt, error: deepseekPromptError },
          { data: openrouterApiKey, error: openrouterKeyError },
          { data: openrouterPrompt, error: openrouterPromptError },
          { data: siteUrl, error: siteUrlError },
          { data: siteName, error: siteNameError },
          { data: provider, error: providerError }
        ] = await Promise.all([
          supabase.rpc('get_gemini_apikey'),
          supabase.rpc('get_gemini_prompt'),
          supabase.rpc('get_deepseek_apikey'),
          supabase.rpc('get_deepseek_prompt'),
          supabase.rpc('get_openrouter_apikey'),
          supabase.rpc('get_openrouter_prompt'),
          supabase.rpc('get_openrouter_site_url'),
          supabase.rpc('get_openrouter_site_name'),
          supabase.rpc('get_ai_provider')
        ]);

        // Check for errors
        const errors = [
          geminiKeyError,
          geminiPromptError,
          deepseekKeyError,
          deepseekPromptError,
          openrouterKeyError,
          openrouterPromptError,
          siteUrlError,
          siteNameError,
          providerError
        ].filter(Boolean);

        if (errors.length > 0) {
          throw errors[0];
        }

        // Update settings state
        setSettings({
          gemini_api_key: geminiApiKey || '',
          gemini_prompt: geminiPrompt || '',
          deepseek_api_key: deepseekApiKey || '',
          deepseek_prompt: deepseekPrompt || '',
          openrouter_api_key: openrouterApiKey || '',
          openrouter_prompt: openrouterPrompt || '',
          site_url: siteUrl || window.location.origin,
          site_name: siteName || 'BananaDB',
          ai_provider: (provider || 'gemini') as 'gemini' | 'deepseek' | 'openrouter'
        });

        await checkAISettings();
      } catch (err) {
        console.error('Error loading settings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const checkAISettings = async () => {
    try {
      setAiStatus(prev => ({ ...prev, loading: true, error: null }));
      
      // Get provider first
      const { data: provider, error: providerError } = await supabase.rpc('get_ai_provider');
      if (providerError) throw providerError;

      const currentProvider = provider || 'gemini';
      let hasKey = false;
      let hasPrompt = false;

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
          hasKey = !!apiKey;
          hasPrompt = !!prompt;
          break;
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
          hasKey = !!apiKey;
          hasPrompt = !!prompt;
          break;
        }
        case 'openrouter': {
          const [
            { data: apiKey, error: apiKeyError },
            { data: prompt, error: promptError }
          ] = await Promise.all([
            supabase.rpc('get_openrouter_apikey'),
            supabase.rpc('get_openrouter_prompt')
          ]);
          if (apiKeyError) throw apiKeyError;
          if (promptError) throw promptError;
          hasKey = !!apiKey;
          hasPrompt = !!prompt;
          break;
        }
      }

      setAiStatus({
        loading: false,
        error: null,
        settings: {
          provider: currentProvider,
          hasKey,
          hasPrompt
        }
      });
    } catch (err) {
      console.error('Error checking AI settings:', err);
      setAiStatus({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to check AI settings',
        settings: null
      });
    }
  };

  const handleUpdateProvider = async (provider: typeof settings.ai_provider) => {
    if (provider === settings.ai_provider || isUpdatingProvider) return;
    
    setIsUpdatingProvider(true);
    setMessage(null);

    try {
      const { error } = await supabase.rpc('set_ai_provider', { p_value: provider });

      if (error) throw error;

      setSettings(prev => ({ ...prev, ai_provider: provider }));
      setMessage({
        type: 'success',
        text: `Switched to ${provider} provider successfully!`
      });
      
      await checkAISettings();
    } catch (err) {
      console.error('Error updating AI provider:', err);
      setMessage({
        type: 'error',
        text: 'Failed to update AI provider. Please try again.'
      });
    } finally {
      setIsUpdatingProvider(false);
    }
  };

  const handleSaveGemini = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGemini(true);
    setMessage(null);

    try {
      const [apiKeyError, promptError] = await Promise.all([
        supabase.rpc('set_gemini_apikey', { p_value: settings.gemini_api_key }),
        supabase.rpc('set_gemini_prompt', { p_value: settings.gemini_prompt })
      ]);

      if (apiKeyError?.error) throw apiKeyError.error;
      if (promptError?.error) throw promptError.error;

      setMessage({
        type: 'success',
        text: 'Gemini settings saved successfully!'
      });
      
      await checkAISettings();
    } catch (err) {
      console.error('Error saving Gemini settings:', err);
      setMessage({
        type: 'error',
        text: 'Failed to save Gemini settings. Please try again.'
      });
    } finally {
      setIsSavingGemini(false);
    }
  };

  const handleSaveDeepseek = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDeepseek(true);
    setMessage(null);

    try {
      const [apiKeyError, promptError] = await Promise.all([
        supabase.rpc('set_deepseek_apikey', { p_value: settings.deepseek_api_key }),
        supabase.rpc('set_deepseek_prompt', { p_value: settings.deepseek_prompt })
      ]);

      if (apiKeyError?.error) throw apiKeyError.error;
      if (promptError?.error) throw promptError.error;

      setMessage({
        type: 'success',
        text: 'Deepseek settings saved successfully!'
      });
      
      await checkAISettings();
    } catch (err) {
      console.error('Error saving Deepseek settings:', err);
      setMessage({
        type: 'error',
        text: 'Failed to save Deepseek settings. Please try again.'
      });
    } finally {
      setIsSavingDeepseek(false);
    }
  };

  const handleSaveOpenRouter = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingOpenRouter(true);
    setMessage(null);

    try {
      const [apiKeyError, promptError, siteUrlError, siteNameError] = await Promise.all([
        supabase.rpc('set_openrouter_apikey', { p_value: settings.openrouter_api_key }),
        supabase.rpc('set_openrouter_prompt', { p_value: settings.openrouter_prompt }),
        supabase.rpc('set_openrouter_site_url', { p_value: settings.site_url }),
        supabase.rpc('set_openrouter_site_name', { p_value: settings.site_name })
      ]);

      if (apiKeyError?.error) throw apiKeyError.error;
      if (promptError?.error) throw promptError.error;
      if (siteUrlError?.error) throw siteUrlError.error;
      if (siteNameError?.error) throw siteNameError.error;

      setMessage({
        type: 'success',
        text: 'OpenRouter settings saved successfully!'
      });
      
      await checkAISettings();
    } catch (err) {
      console.error('Error saving OpenRouter settings:', err);
      setMessage({
        type: 'error',
        text: 'Failed to save OpenRouter settings. Please try again.'
      });
    } finally {
      setIsSavingOpenRouter(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
          >
            <Bug className="h-4 w-4 mr-2" />
            Toggle Debug Info
          </button>
        </div>

        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('ai')}
              className={`${
                activeTab === 'ai'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              AI Settings
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`${
                activeTab === 'users'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('data-sources')}
              className={`${
                activeTab === 'data-sources'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Data Sources
            </button>
          </nav>
        </div>

        {activeTab === 'ai' && (
          <>
            {/* AI Status Panel */}
            {aiStatus.loading ? (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg flex items-center">
                <Loader2 className="h-5 w-5 text-gray-400 animate-spin mr-3" />
                <p className="text-sm text-gray-600">Checking AI configuration...</p>
              </div>
            ) : aiStatus.error ? (
              <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                  <div className="ml-3">
                    <p className="text-sm text-red-700">Error checking AI settings: {aiStatus.error}</p>
                  </div>
                </div>
              </div>
            ) : aiStatus.settings && (
              <div className="mb-6 bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">AI Configuration Status</h3>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="text-sm text-gray-600 w-32">Active Provider:</span>
                    <span className="text-sm font-medium capitalize">{aiStatus.settings.provider}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-600 w-32">API Key:</span>
                    {aiStatus.settings.hasKey ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-600 w-32">Prompt:</span>
                    {aiStatus.settings.hasPrompt ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                AI Provider
              </label>
              <div className="flex items-center space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="gemini"
                    checked={settings.ai_provider === 'gemini'}
                    onChange={(e) => handleUpdateProvider(e.target.value as typeof settings.ai_provider)}
                    className="form-radio h-4 w-4 text-primary"
                  />
                  <span className="ml-2">Gemini</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="deepseek"
                    checked={settings.ai_provider === 'deepseek'}
                    onChange={(e) => handleUpdateProvider(e.target.value as typeof settings.ai_provider)}
                    className="form-radio h-4 w-4 text-primary"
                  />
                  <span className="ml-2">Deepseek</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="openrouter"
                    checked={settings.ai_provider === 'openrouter'}
                    onChange={(e) => handleUpdateProvider(e.target.value as typeof settings.ai_provider)}
                    className="form-radio h-4 w-4 text-primary"
                  />
                  <span className="ml-2">OpenRouter</span>
                </label>
              </div>
            </div>

            {message && (
              <div className={`mt-6 p-4 rounded-md ${
                message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
              }`}>
                <p className="text-sm">{message.text}</p>
              </div>
            )}

            <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Gemini Settings</h3>
              
              <form onSubmit={handleSaveGemini} className="space-y-4">
                <div>
                  <label htmlFor="geminiApiKey" className="block text-sm font-medium text-gray-700">
                    Gemini API Key
                  </label>
                  <input
                    type="password"
                    id="geminiApiKey"
                    value={settings.gemini_api_key}
                    onChange={(e) => setSettings({ ...settings, gemini_api_key: e.target.value })}
                    className={inputClassName}
                    placeholder="Enter your Gemini API key"
                  />
                </div>

                <div>
                  <label htmlFor="geminiPrompt" className="block text-sm font-medium text-gray-700">
                    Gemini Prompt
                  </label>
                  <textarea
                    id="geminiPrompt"
                    rows={10}
                    value={settings.gemini_prompt}
                    onChange={(e) => setSettings({ ...settings, gemini_prompt: e.target.value })}
                    className={inputClassName}
                    placeholder="Enter the system prompt for Gemini"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingGemini}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-gray-900 bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingGemini ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Save Gemini Settings
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Deepseek Settings</h3>
              
              <form onSubmit={handleSaveDeepseek} className="space-y-4">
                <div>
                  <label htmlFor="deepseekApiKey" className="block text-sm font-medium text-gray-700">
                    Deepseek API Key
                  </label>
                  <input
                    type="password"
                    id="deepseekApiKey"
                    value={settings.deepseek_api_key}
                    onChange={(e) => setSettings({ ...settings, deepseek_api_key: e.target.value })}
                    className={inputClassName}
                    placeholder="Enter your Deepseek API key"
                  />
                </div>

                <div>
                  <label htmlFor="deepseekPrompt" className="block text-sm font-medium text-gray-700">
                    Deepseek Prompt
                  </label>
                  <textarea
                    id="deepseekPrompt"
                    rows={10}
                    value={settings.deepseek_prompt}
                    onChange={(e) => setSettings({ ...settings, deepseek_prompt: e.target.value })}
                    className={inputClassName}
                    placeholder="Enter the system prompt for Deepseek"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingDeepseek}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-gray-900 bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingDeepseek ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Save Deepseek Settings
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">OpenRouter Settings</h3>
              
              <form onSubmit={handleSaveOpenRouter} className="space-y-4">
                <div>
                  <label htmlFor="openrouterApiKey" className="block text-sm font-medium text-gray-700">
                    OpenRouter API Key
                  </label>
                  <input
                    type="password"
                    id="openrouterApiKey"
                    value={settings.openrouter_api_key}
                    onChange={(e) => setSettings({ ...settings, openrouter_api_key: e.target.value })}
                    className={inputClassName}
                    placeholder="Enter your OpenRouter API key"
                  />
                </div>

                <div>
                  <label htmlFor="openrouterPrompt" className="block text-sm font-medium text-gray-700">
                    OpenRouter Prompt
                  </label>
                  <textarea
                    id="openrouterPrompt"
                    rows={10}
                    value={settings.openrouter_prompt}
                    onChange={(e) => setSettings({ ...settings, openrouter_prompt: e.target.value })}
                    className={inputClassName}
                    placeholder="Enter the system prompt for OpenRouter"
                  />
                </div>

                <div>
                  <label htmlFor="siteUrl" className="block text-sm font-medium text-gray-700">
                    Site URL
                  </label>
                  <input
                    type="url"
                    id="siteUrl"
                    value={settings.site_url}
                    onChange={(e) => setSettings({ ...settings, site_url: e.target.value })}
                    className={inputClassName}
                    placeholder={window.location.origin}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Optional. Used for rankings on openrouter.ai
                  </p>
                </div>

                <div>
                  <label htmlFor="siteName" className="block text-sm font-medium text-gray-700">
                    Site Name
                  </label>
                  <input
                    type="text"
                    id="siteName"
                    value={settings.site_name}
                    onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
                    className={inputClassName}
                    placeholder="BananaDB"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Optional. Used for rankings on openrouter.ai
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingOpenRouter}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-gray-900 bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingOpenRouter ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Save OpenRouter Settings
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {activeTab === 'users' && (
          <AdminUsers />
        )}

        {activeTab === 'data-sources' && (
          <DataSourcesManager />
        )}

        {showDebug && aiResponse && (
          <div className="bg-gray-50 border-l-4 border-gray-400 p-4">
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              Debug Information
            </h3>
            <div className="space-y-4">
              {aiResponse.raw && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Raw Input:</h4>
                  <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-100 p-4 rounded">
                    {aiResponse.raw}
                  </pre>
                </div>
              )}
              {aiResponse.parsed && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Parsed Output:</h4>
                  <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-100 p-4 rounded">
                    {JSON.stringify(aiResponse.parsed, null, 2)}
                  </pre>
                </div>
              )}
              {aiResponse.error && (
                <div>
                  <h4 className="text-sm font-medium text-red-700 mb-1">Error:</h4>
                  <pre className="text-sm text-red-600 whitespace-pre-wrap bg-red-50 p-4 rounded">
                    {aiResponse.error}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}