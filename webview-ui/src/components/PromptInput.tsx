import React, { useState } from 'react';
import { Sparkles, SlidersHorizontal, Trash2, Wand2 } from 'lucide-react';

interface PromptInputProps {
  prompt: string;
  setPrompt: (value: string) => void;
  negativePrompt: string;
  setNegativePrompt: (value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

const PRESETS = [
  { label: 'Photorealistic', suffix: ', highly detailed, 8k resolution, photorealistic, professional photography, soft lighting' },
  { label: 'Pixel Art', suffix: ', pixel art style, 16-bit, vibrant colors, clean sprite sheet aesthetic' },
  { label: 'Anime/Manga', suffix: ', anime masterpiece, Makoto Shinkai style, studio ghibli color palette, high contrast' },
  { label: 'Cyberpunk', suffix: ', cyberpunk neon lighting, volumetric fog, futuristic city, cinematic composition' },
  { label: 'Vector Icon', suffix: ', flat vector graphic, clean SVG aesthetic, modern minimalist UI icon, transparent background' },
];

export const PromptInput: React.FC<PromptInputProps> = ({
  prompt,
  setPrompt,
  negativePrompt,
  setNegativePrompt,
  onGenerate,
  isGenerating
}) => {
  const [showNegative, setShowNegative] = useState(false);

  const applyPreset = (suffix: string) => {
    if (!prompt.includes(suffix)) {
      setPrompt((prompt + suffix).trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isGenerating && prompt.trim()) {
        onGenerate();
      }
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-slate-900/80 border-t border-slate-800 backdrop-blur-md">
      {/* Quick style enhancement tags */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-slate-400">
        <span className="flex items-center gap-1 font-medium text-slate-500 shrink-0">
          <Wand2 className="w-3.5 h-3.5 text-indigo-400" /> Styles:
        </span>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => applyPreset(preset.suffix)}
            className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/50 shrink-0"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Main Prompt Textarea */}
      <div className="relative">
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the image you want to generate (e.g., 'Retro cyberpunk astronaut floating in neon space, 8k'). Press Ctrl+Enter to generate..."
          className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none shadow-inner"
        />

        {prompt && (
          <button
            onClick={() => setPrompt('')}
            title="Clear prompt"
            className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-slate-200 bg-slate-800/60 rounded-md hover:bg-slate-700/80 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Negative Prompt Collapsible */}
      <div className="flex items-center justify-between text-xs">
        <button
          onClick={() => setShowNegative(!showNegative)}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors font-medium"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
          {showNegative ? 'Hide Negative Prompt' : 'Add Negative Prompt'}
        </button>
        <span className="text-slate-500">Ctrl + Enter to run</span>
      </div>

      {showNegative && (
        <div className="transition-all animate-fadeIn">
          <textarea
            rows={2}
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="Things to avoid (e.g. blurry, low quality, distorted, watermark, bad anatomy)..."
            className="w-full bg-slate-800/60 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none"
          />
        </div>
      )}
    </div>
  );
};
