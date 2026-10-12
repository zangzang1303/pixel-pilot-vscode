import React, { useState, useEffect } from 'react';
import {
  SettingsSidebar,
  ModelItem,
  GenerationSettings,
  StudioTab
} from './components/SettingsSidebar';
import { PromptInput } from './components/PromptInput';
import { Canvas } from './components/Canvas';
import { vscode } from './utils/vscode';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  thought?: string;
}

export const App: React.FC = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<StudioTab>('generate');

  // Connection state
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [serverUrl, setServerUrl] = useState<string>('http://127.0.0.1:9090');

  // Models state
  const [models, setModels] = useState<ModelItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');

  // Prompt state
  const [prompt, setPrompt] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>('');

  // Generation settings
  const [settings, setSettings] = useState<GenerationSettings>({
    width: 512,
    height: 512,
    steps: 25,
    cfgScale: 7.5,
    seed: Math.floor(Math.random() * 1000000),
    randomSeed: true
  });

  // Generation status
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [progressPercentage, setProgressPercentage] = useState<number | undefined>(undefined);

  // Upscale status
  const [isUpscaling, setIsUpscaling] = useState<boolean>(false);

  // Action processing status (Edit & Dev Tools)
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const [processingLabel, setProcessingLabel] = useState<string>('');

  // Active Image & Saved path
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | undefined>(undefined);
  const [snippetInserted, setSnippetInserted] = useState<boolean>(false);

  // Copilot Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatThinking, setIsChatThinking] = useState<boolean>(false);

  // Handle messages from Extension Host
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!message || (!message.command && !message.type)) return;

      const cmd = message.command || message.type;

      switch (cmd) {
        case 'pingResult':
          setIsOnline(message.isOnline);
          if (message.serverUrl) setServerUrl(message.serverUrl);
          break;

        case 'modelsLoaded':
          if (Array.isArray(message.models)) {
            setModels(message.models);
            if (message.models.length > 0 && !selectedModel) {
              setSelectedModel(message.models[0].key);
            }
          }
          break;

        case 'setImage':
        case 'SET_CURRENT_IMAGE':
          setCurrentImageUrl(message.dataUrl || message.payload?.imageUri);
          setSavedPath(message.filePath || message.payload?.fileName);
          setSnippetInserted(false);
          setIsProcessingAction(false);
          break;

        case 'generationStarted':
          setIsGenerating(true);
          setProgressStatus('Starting generation...');
          setProgressPercentage(10);
          setSnippetInserted(false);
          break;

        case 'generationProgress':
          setProgressStatus(message.status);
          if (typeof message.percentage === 'number') {
            setProgressPercentage(message.percentage);
          }
          break;

        case 'generationComplete':
          setIsGenerating(false);
          setCurrentImageUrl(message.dataUrl);
          setSavedPath(message.savedPath);
          setSnippetInserted(Boolean(message.snippetInserted));
          setProgressPercentage(100);
          break;

        case 'generationError':
          setIsGenerating(false);
          setProgressStatus('');
          setProgressPercentage(undefined);
          break;

        case 'upscaleStarted':
          setIsUpscaling(true);
          break;

        case 'upscaleProgress':
          setProgressStatus(message.status);
          if (typeof message.percentage === 'number') {
            setProgressPercentage(message.percentage);
          }
          break;

        case 'upscaleComplete':
          setIsUpscaling(false);
          setCurrentImageUrl(message.dataUrl);
          setSavedPath(message.savedPath);
          break;

        case 'upscaleError':
          setIsUpscaling(false);
          break;

        case 'actionStarted':
        case 'UPDATE_AI_PROGRESS':
          setIsProcessingAction(true);
          setProcessingLabel(message.label || message.payload?.status || 'Đang xử lý AI...');
          break;

        case 'actionComplete':
        case 'AI_ACTION_SUCCESS':
          setIsProcessingAction(false);
          if (message.dataUrl || message.payload?.outputUri) {
            setCurrentImageUrl(message.dataUrl || message.payload?.outputUri);
          }
          if (message.savedPath) {
            setSavedPath(message.savedPath);
          }
          break;

        case 'actionError':
        case 'AI_ACTION_ERROR':
          setIsProcessingAction(false);
          break;

        case 'chatReply':
          setIsChatThinking(false);
          setChatMessages((prev) => [
            ...prev,
            { role: 'assistant', text: message.text, thought: message.thought }
          ]);
          if (message.updatedImage) {
            setCurrentImageUrl(message.updatedImage);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Initial ping & fetch
    vscode.postMessage({ command: 'ping' });
    vscode.postMessage({ command: 'getModels' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [selectedModel]);

  // Trigger Text-to-Image Generation
  const handleGenerate = () => {
    if (!prompt.trim() || isGenerating) return;

    const chosenModel = models.find((m) => m.key === selectedModel) || selectedModel;

    vscode.postMessage({
      command: 'generate',
      prompt: prompt.trim(),
      model: chosenModel,
      options: {
        negativePrompt: negativePrompt.trim(),
        width: settings.width,
        height: settings.height,
        steps: settings.steps,
        cfgScale: settings.cfgScale,
        seed: settings.seed,
      }
    });
  };

  // Trigger 2x Upscale on current image
  const handleUpscale = () => {
    if (!currentImageUrl || isUpscaling) return;

    vscode.postMessage({
      command: 'upscale',
      dataUrl: currentImageUrl,
      factor: 2
    });
  };

  // Trigger Unified AI Actions (Tách nền, Inpaint, Recolor, Vectorize, Dev tools)
  const handleApplyAction = (action: string, options?: any) => {
    if (!currentImageUrl && action !== 'openImage') return;

    setIsProcessingAction(true);
    setProcessingLabel(`Đang thực hiện ${action}...`);

    vscode.postMessage({
      command: 'applyAction',
      action,
      dataUrl: currentImageUrl,
      options: options || {}
    });
  };

  // Open Image from disk
  const handleOpenImage = () => {
    vscode.postMessage({ command: 'browseImage' });
  };

  // Save Image to disk
  const handleSaveImage = () => {
    if (!currentImageUrl) return;
    vscode.postMessage({
      command: 'exportImage',
      dataUrl: currentImageUrl,
      savedPath
    });
  };

  // Send Copilot Chat Message
  const handleSendMessage = (text: string) => {
    setChatMessages((prev) => [...prev, { role: 'user', text }]);
    setIsChatThinking(true);

    vscode.postMessage({
      command: 'chatMessage',
      text,
      currentImage: currentImageUrl
    });
  };

  // Re-ping InvokeAI server
  const handlePing = () => {
    vscode.postMessage({ command: 'ping' });
    vscode.postMessage({ command: 'getModels' });
  };

  // Insert code snippet manually
  const handleInsertSnippet = () => {
    if (savedPath) {
      vscode.postMessage({
        command: 'insertSnippet',
        relativePath: savedPath,
        altText: prompt ? prompt.substring(0, 30) : 'Generated Image'
      });
      setSnippetInserted(true);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100">
      {/* Settings & Tools Sidebar with Tabs */}
      <SettingsSidebar
        isOnline={isOnline}
        serverUrl={serverUrl}
        models={models}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        settings={settings}
        setSettings={setSettings}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        onRefreshModels={() => vscode.postMessage({ command: 'getModels' })}
        onPing={handlePing}
        hasActiveImage={Boolean(currentImageUrl)}
        onUpscale={handleUpscale}
        isUpscaling={isUpscaling}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onApplyAction={handleApplyAction}
        isProcessingAction={isProcessingAction}
        processingLabel={processingLabel}
        onOpenImage={handleOpenImage}
        chatMessages={chatMessages}
        onSendMessage={handleSendMessage}
        isChatThinking={isChatThinking}
      />

      {/* Main Studio Canvas Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Canvas Display Viewport */}
        <Canvas
          imageUrl={currentImageUrl}
          isGenerating={isGenerating || isProcessingAction}
          progressStatus={isProcessingAction ? processingLabel : progressStatus}
          progressPercentage={progressPercentage}
          savedPath={savedPath}
          onInsertSnippet={handleInsertSnippet}
          snippetInserted={snippetInserted}
          onOpenImage={handleOpenImage}
          onSaveImage={handleSaveImage}
          onApplyAction={handleApplyAction}
        />

        {/* Bottom Prompt Bar (available in Generation and Edit mode) */}
        {activeTab !== 'chat' && (
          <PromptInput
            prompt={prompt}
            setPrompt={setPrompt}
            negativePrompt={negativePrompt}
            setNegativePrompt={setNegativePrompt}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
          />
        )}
      </main>
    </div>
  );
};

export default App;
