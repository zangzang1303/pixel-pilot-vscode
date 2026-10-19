import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  Layers,
  Wand2,
  Code2,
  MessageSquare,
  Scissors,
  ZoomIn,
  Zap,
  Paintbrush,
  Palette,
  Image as ImageIcon,
  FileCode,
  FileText,
  Sliders,
  Download,
  FolderOpen,
  FolderArchive,
  Settings,
  Maximize2,
  Scan,
  Eye,
  PenTool,
  Plus,
  Pencil,
  Trash2
} from 'lucide-react';

export interface ModelItem {
  key: string;
  name: string;
  base_model?: string;
  type?: string;
  description?: string;
}

export interface GenerationSettings {
  width: number;
  height: number;
  steps: number;
  cfgScale: number;
  seed: number;
  randomSeed: boolean;
}

export type StudioTab = 'generate' | 'edit' | 'dev' | 'chat';

interface SettingsSidebarProps {
  isOnline: boolean;
  comfyOnline: boolean;
  serverUrl: string;
  models: ModelItem[];
  selectedModel: string;
  setSelectedModel: (modelKey: string) => void;
  settings: GenerationSettings;
  setSettings: React.Dispatch<React.SetStateAction<GenerationSettings>>;
  onGenerate: () => void;
  isGenerating: boolean;
  onRefreshModels: () => void;
  onPing: () => void;
  hasActiveImage: boolean;
  onUpscale: () => void;
  isUpscaling: boolean;
  // New Unified Props
  activeTab: StudioTab;
  setActiveTab: (tab: StudioTab) => void;
  onApplyAction: (action: string, options?: any) => void;
  isProcessingAction: boolean;
  processingLabel: string;
  onOpenImage: () => void;
  // Chat Props
  sessions: Array<{ sessionId: string; title: string; updatedAt: number; messageCount: number }>;
  activeSessionId: string;
  onNewSession: () => void;
  onSwitchSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onDeleteSession: (sessionId: string) => void;
  // API Key Status
  hasApiKey?: boolean;
  apiKeyMasked?: string;
}

const RESOLUTION_PRESETS = [
  { label: '1:1 Square (512x512)', width: 512, height: 512 },
  { label: '1:1 SDXL (1024x1024)', width: 1024, height: 1024 },
  { label: '3:4 Portrait (512x768)', width: 512, height: 768 },
  { label: '4:3 Landscape (768x512)', width: 768, height: 512 },
  { label: '16:9 Banner (1024x576)', width: 1024, height: 576 },
];

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  isOnline,
  comfyOnline,
  serverUrl,
  models,
  selectedModel,
  setSelectedModel,
  settings,
  setSettings,
  onGenerate,
  isGenerating,
  onRefreshModels,
  onPing,
  hasActiveImage,
  onUpscale,
  isUpscaling,
  activeTab,
  setActiveTab,
  onApplyAction,
  isProcessingAction,
  processingLabel,
  onOpenImage,
  sessions,
  activeSessionId,
  onNewSession,
  onSwitchSession,
  onRenameSession,
  onDeleteSession,
  hasApiKey,
  apiKeyMasked
}) => {
  const [recolorSubject, setRecolorSubject] = useState('hair');
  const [recolorColor, setRecolorColor] = useState('cyan');
  const [selectedStyle, setSelectedStyle] = useState('anime');

  const randomizeSeed = () => {
    setSettings((prev) => ({
      ...prev,
      seed: Math.floor(Math.random() * 2147483647),
    }));
  };

  return (
    <aside className="w-84 h-full flex flex-col bg-slate-900 border-r border-slate-800 text-slate-200 select-none">
      {/* Studio Brand Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              Pixel Pilot
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PRO
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">All-in-One Visual AI Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Cloud AI Key Status Pill */}
          <button
            onClick={() => onApplyAction('openApiKeyPrompt')}
            title={hasApiKey ? `Đã kết nối Runware AI Key: ${apiKeyMasked}` : 'Chưa cấu hình API Key (Bấm để nhập)'}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border ${
              hasApiKey
                ? 'bg-purple-950/60 text-purple-300 border-purple-800/80 hover:bg-purple-900/60'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${hasApiKey ? 'bg-purple-400 animate-pulse' : 'bg-slate-500'}`} />
            {hasApiKey ? (apiKeyMasked || 'Cloud Key') : 'No Key'}
          </button>

          {/* Settings / API Key Button */}
          <button
            onClick={() => onApplyAction('openApiKeyPrompt')}
            title="Cấu hình API Key (Runware / AI)"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-slate-800"
          >
            <Settings className="w-3 h-3" />
          </button>

          {/* Local GPU InvokeAI status pill */}
          <button
            onClick={onPing}
            title={`InvokeAI: ${isOnline ? 'đang chạy' : 'chưa chạy'} (${serverUrl}) · ComfyUI: ${comfyOnline ? 'đang chạy' : 'chưa chạy'} (127.0.0.1:8188)`}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border ${
              isOnline || comfyOnline
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80 hover:bg-emerald-900/60'
                : 'bg-rose-950/60 text-rose-400 border-rose-800/80 hover:bg-rose-900/60'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline || comfyOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            {isOnline ? 'InvokeAI' : comfyOnline ? 'ComfyUI' : 'Offline'}
          </button>
        </div>
      </div>

      {/* Main Studio Navigation Tabs */}
      <div className="grid grid-cols-4 border-b border-slate-800 bg-slate-950/80 text-xs">
        <button
          onClick={() => setActiveTab('generate')}
          className={`py-2.5 flex flex-col items-center justify-center gap-1 font-medium transition-all border-b-2 ${
            activeTab === 'generate'
              ? 'text-indigo-400 border-indigo-500 bg-indigo-500/10'
              : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900'
          }`}
          title="Sinh ảnh mới từ văn bản"
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-[10px]">Sinh ảnh</span>
        </button>

        <button
          onClick={() => setActiveTab('edit')}
          className={`py-2.5 flex flex-col items-center justify-center gap-1 font-medium transition-all border-b-2 ${
            activeTab === 'edit'
              ? 'text-purple-400 border-purple-500 bg-purple-500/10'
              : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900'
          }`}
          title="Bộ công cụ chỉnh sửa ảnh AI (Tách nền, Inpaint, Upscale...)"
        >
          <Wand2 className="w-4 h-4" />
          <span className="text-[10px]">Chỉnh sửa</span>
        </button>

        <button
          onClick={() => setActiveTab('dev')}
          className={`py-2.5 flex flex-col items-center justify-center gap-1 font-medium transition-all border-b-2 ${
            activeTab === 'dev'
              ? 'text-cyan-400 border-cyan-500 bg-cyan-500/10'
              : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900'
          }`}
          title="Tiện ích Code, OCR, Nén ảnh"
        >
          <Code2 className="w-4 h-4" />
          <span className="text-[10px]">Dev Tools</span>
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`py-2.5 flex flex-col items-center justify-center gap-1 font-medium transition-all border-b-2 ${
            activeTab === 'chat'
              ? 'text-emerald-400 border-emerald-500 bg-emerald-500/10'
              : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900'
          }`}
          title="Trò chuyện và điều khiển AI bằng câu lệnh tự nhiên"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="text-[10px]">Copilot</span>
        </button>
      </div>

      {/* Tab Contents Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Quick Open Image Button across all tabs */}
        {!hasActiveImage && activeTab !== 'generate' && (
          <div className="p-3 bg-indigo-950/30 border border-indigo-800/40 rounded-xl text-center flex flex-col items-center gap-2">
            <p className="text-xs text-indigo-200">Chưa có ảnh trên Canvas</p>
            <button
              onClick={onOpenImage}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" /> Mở ảnh từ máy tính
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: SINH ẢNH AI (TEXT-TO-IMAGE)                                        */}
        {/* ========================================================================= */}
        {activeTab === 'generate' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            {/* Model Selection */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  Diffusion Model
                </span>
                <button
                  onClick={onRefreshModels}
                  title="Tải lại danh sách models"
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>

              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {models.length > 0 ? (
                  models.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.name} ({m.base_model || 'sd-1'})
                    </option>
                  ))
                ) : (
                  <option value="">{comfyOnline ? 'Stable Diffusion 1.5 (ComfyUI, tối đa 512px)' : 'Không tìm thấy model (Bật ComfyUI hoặc InvokeAI)'}</option>
                )}
              </select>
            </div>

            {/* Dimension Selection */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-300">Kích thước & Tỉ lệ</span>
              <div className="grid grid-cols-2 gap-1.5">
                {RESOLUTION_PRESETS.map((preset) => {
                  const isSelected = settings.width === preset.width && settings.height === preset.height;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => setSettings((prev) => ({ ...prev, width: preset.width, height: preset.height }))}
                      className={`px-2 py-1.5 text-[11px] rounded-lg border text-left font-medium transition-all ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Steps & CFG */}
            <div className="flex flex-col gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Sampling Steps</span>
                  <span className="font-mono text-indigo-400">{settings.steps}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={settings.steps}
                  onChange={(e) => setSettings((prev) => ({ ...prev, steps: Number(e.target.value) }))}
                  className="accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>CFG Scale</span>
                  <span className="font-mono text-indigo-400">{settings.cfgScale}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={settings.cfgScale}
                  onChange={(e) => setSettings((prev) => ({ ...prev, cfgScale: Number(e.target.value) }))}
                  className="accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                <span>Seed: <span className="font-mono text-slate-400">{settings.seed}</span></span>
                <button
                  onClick={randomizeSeed}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition-colors"
                >
                  Random Seed
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <button
              onClick={onGenerate}
              disabled={isGenerating || !(isOnline || comfyOnline)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 font-semibold text-xs text-white shadow-lg shadow-indigo-500/25 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4" />
              {isGenerating ? 'Đang sinh ảnh GPU...' : 'Sinh ảnh mới (Generate)'}
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: CHỈNH SỬA AI (AI EDIT STUDIO)                                     */}
        {/* ========================================================================= */}
        {activeTab === 'edit' && (
          <div className="flex flex-col gap-3 animate-in fade-in duration-200">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Công cụ thị giác AI (1-Click)
            </span>

            {/* Tách nền SOTA BiRefNet */}
            <button
              onClick={() => onApplyAction('removeBackground')}
              disabled={isProcessingAction || !hasActiveImage}
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 hover:bg-purple-950/20 flex items-center gap-3 transition-all text-left disabled:opacity-50 group"
            >
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Scissors className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200 group-hover:text-purple-300">Tách nền (BiRefNet)</p>
                <p className="text-[10px] text-slate-400">Xóa phông trong suốt 32-bit Alpha chuẩn SOTA</p>
              </div>
            </button>

            {/* Phóng to 2x & 4x */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onApplyAction('upscale', { factor: 2 })}
                disabled={isProcessingAction || !hasActiveImage}
                className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-950/20 flex flex-col items-center gap-1.5 transition-all text-center disabled:opacity-50"
              >
                <ZoomIn className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold text-slate-200">Phóng to 2x</span>
                <span className="text-[9px] text-slate-400">Super Resolution</span>
              </button>

              <button
                onClick={() => onApplyAction('upscale', { factor: 4 })}
                disabled={isProcessingAction || !hasActiveImage}
                className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-950/20 flex flex-col items-center gap-1.5 transition-all text-center disabled:opacity-50"
              >
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-slate-200">Phóng to 4x</span>
                <span className="text-[9px] text-slate-400">Ultra HD</span>
              </button>
            </div>

            {/* Khử mờ / Làm nét HDR */}
            <button
              onClick={() => onApplyAction('enhance', { type: 'clarity' })}
              disabled={isProcessingAction || !hasActiveImage}
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-950/20 flex items-center gap-3 transition-all text-left disabled:opacity-50 group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300">Khử mờ & Làm nét HDR</p>
                <p className="text-[10px] text-slate-400">Tăng độ chi tiết và tương phản thông minh</p>
              </div>
            </button>

            {/* Đổi màu chọn lọc (Recolor) */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <Palette className="w-3.5 h-3.5 text-pink-400" />
                <span>Đổi màu chọn lọc (Bảo vệ da & cách ly nền)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <select
                  value={recolorSubject}
                  onChange={(e) => setRecolorSubject(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-[11px] text-slate-200"
                >
                  <option value="clothes">Trang phục</option>
                  <option value="hair">Mái tóc</option>
                  <option value="background">Phông nền</option>
                  <option value="object">Chi tiết vật thể</option>
                </select>
                <select
                  value={recolorColor}
                  onChange={(e) => setRecolorColor(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-[11px] text-slate-200"
                >
                  <option value="purple">Tím Khói</option>
                  <option value="cyan">Xanh Da Trời (Cyan)</option>
                  <option value="blonde">Vàng Bạch Kim</option>
                  <option value="red">Đỏ Ruby</option>
                  <option value="green">Xanh Ngọc</option>
                  <option value="black">Đen Tuyền</option>
                </select>
              </div>
              <button
                onClick={() => onApplyAction('recolor', { subject: recolorSubject, color: recolorColor })}
                disabled={isProcessingAction || !hasActiveImage}
                className="w-full py-1.5 bg-pink-600/30 hover:bg-pink-600/40 text-pink-300 border border-pink-500/40 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                Thực hiện đổi màu
              </button>
            </div>

            {/* Tiền xử lý ControlNet & Trích xuất (Preprocess / Edge / Lineart / Depth / Mask) */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Scan className="w-3.5 h-3.5 text-cyan-400" />
                Tiền xử lý ControlNet & Phân đoạn (Preprocess)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onApplyAction('canny')}
                  disabled={isProcessingAction || !hasActiveImage}
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-700/80 hover:border-cyan-500/50 text-left transition-all disabled:opacity-50"
                >
                  <span className="text-[11px] font-semibold text-cyan-300 block">Dò biên Canny</span>
                  <span className="text-[9px] text-slate-400">Edge Detection</span>
                </button>

                <button
                  onClick={() => onApplyAction('lineart')}
                  disabled={isProcessingAction || !hasActiveImage}
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-700/80 hover:border-indigo-500/50 text-left transition-all disabled:opacity-50"
                >
                  <span className="text-[11px] font-semibold text-indigo-300 block">Nét vẽ Lineart</span>
                  <span className="text-[9px] text-slate-400">Line Extraction</span>
                </button>

                <button
                  onClick={() => onApplyAction('depth')}
                  disabled={isProcessingAction || !hasActiveImage}
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-700/80 hover:border-emerald-500/50 text-left transition-all disabled:opacity-50"
                >
                  <span className="text-[11px] font-semibold text-emerald-300 block">Độ sâu 3D (Depth)</span>
                  <span className="text-[9px] text-slate-400">Spatial Depth Map</span>
                </button>

                <button
                  onClick={() => onApplyAction('mask')}
                  disabled={isProcessingAction || !hasActiveImage}
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-700/80 hover:border-amber-500/50 text-left transition-all disabled:opacity-50"
                >
                  <span className="text-[11px] font-semibold text-amber-300 block">Mặt nạ AI (Mask)</span>
                  <span className="text-[9px] text-slate-400">Binary Segmentation</span>
                </button>
              </div>
            </div>

            {/* Mở rộng khung hình (Extend / Outpaint) */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                Mở rộng khung hình (Extend / Outpaint)
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => onApplyAction('extend', { direction: 'all' })}
                  disabled={isProcessingAction || !hasActiveImage}
                  className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-medium text-slate-200 transition-colors disabled:opacity-50 text-center"
                >
                  4 Hướng đều
                </button>
                <button
                  onClick={() => onApplyAction('extend', { direction: 'horizontal' })}
                  disabled={isProcessingAction || !hasActiveImage}
                  className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-medium text-slate-200 transition-colors disabled:opacity-50 text-center"
                >
                  Mở rộng ngang
                </button>
                <button
                  onClick={() => onApplyAction('extend', { direction: 'vertical' })}
                  disabled={isProcessingAction || !hasActiveImage}
                  className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-medium text-slate-200 transition-colors disabled:opacity-50 text-center"
                >
                  Mở rộng dọc
                </button>
              </div>
            </div>

            {/* AI Caption & Alt Text */}
            <button
              onClick={() => onApplyAction('caption')}
              disabled={isProcessingAction || !hasActiveImage}
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-teal-500/50 hover:bg-teal-950/20 flex items-center gap-3 transition-all text-left disabled:opacity-50 group"
            >
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200 group-hover:text-teal-300">Tạo mô tả ảnh AI (Caption)</p>
                <p className="text-[10px] text-slate-400">Phân tích thị giác, sinh Alt-text & mô tả nội dung</p>
              </div>
            </button>

            {/* Chuyển phong cách (Style Transfer) */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-300">Chuyển phong cách nghệ thuật</span>
              <select
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-[11px] text-slate-200"
              >
                <option value="anime">Anime Makoto Shinkai</option>
                <option value="pixar">3D Animation Pixar</option>
                <option value="cyberpunk">Cyberpunk Neon</option>
                <option value="sketch">Phác thảo bút chì</option>
                <option value="pixel">Pixel Art 16-bit</option>
              </select>
              <button
                onClick={() => onApplyAction('styleTransfer', { style: selectedStyle })}
                disabled={isProcessingAction || !hasActiveImage}
                className="w-full py-1.5 bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                Áp dụng phong cách
              </button>
            </div>

            {/* Vectorize SVG */}
            <button
              onClick={() => onApplyAction('vectorize')}
              disabled={isProcessingAction || !hasActiveImage}
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-yellow-500/50 hover:bg-yellow-950/20 flex items-center gap-3 transition-all text-left disabled:opacity-50 group"
            >
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 text-yellow-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileCode className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200 group-hover:text-yellow-300">Vector hóa (SVG)</p>
                <p className="text-[10px] text-slate-400">Chuyển ảnh Raster thành Vector đa lớp vô hạn</p>
              </div>
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: TIỆN ÍCH LẬP TRÌNH (DEV TOOLS)                                    */}
        {/* ========================================================================= */}
        {activeTab === 'dev' && (
          <div className="flex flex-col gap-3 animate-in fade-in duration-200">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Tiện ích Dev & Web Performance
            </span>

            {/* Image to Code */}
            <button
              onClick={() => onApplyAction('imageToCode', { framework: 'react-tailwind' })}
              disabled={isProcessingAction || !hasActiveImage}
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-950/20 flex items-center gap-3 transition-all text-left disabled:opacity-50 group"
            >
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Code2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300">Image to Code</p>
                <p className="text-[10px] text-slate-400">Chuyển Mockup/UI thành mã React & Tailwind</p>
              </div>
            </button>

            {/* OCR Text Extraction */}
            <button
              onClick={() => onApplyAction('ocr')}
              disabled={isProcessingAction || !hasActiveImage}
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-amber-950/20 flex items-center gap-3 transition-all text-left disabled:opacity-50 group"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200 group-hover:text-amber-300">Trích xuất chữ (OCR)</p>
                <p className="text-[10px] text-slate-400">Sao chép toàn bộ văn bản trong ảnh vào Clipboard</p>
              </div>
            </button>

            {/* Compress WebP */}
            <button
              onClick={() => onApplyAction('compress', { format: 'webp', quality: 85 })}
              disabled={isProcessingAction || !hasActiveImage}
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-950/20 flex items-center gap-3 transition-all text-left disabled:opacity-50 group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FolderArchive className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300">Nén ảnh tối ưu (WebP 85%)</p>
                <p className="text-[10px] text-slate-400">Giảm 75% dung lượng tải web qua thư viện Sharp</p>
              </div>
            </button>

            {/* Export Web Icons Bundle */}
            <button
              onClick={() => onApplyAction('exportIcons')}
              disabled={isProcessingAction || !hasActiveImage}
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-950/20 flex items-center gap-3 transition-all text-left disabled:opacity-50 group"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300">Xuất bộ Icon Đa kích thước</p>
                <p className="text-[10px] text-slate-400">Tự động tạo bộ icon web 16, 32, 64, 128, 512px</p>
              </div>
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: TRỢ LÝ AI COPILOT (CHAT AGENT)                                     */}
        {/* ========================================================================= */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full gap-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <select value={activeSessionId} onChange={(e) => onSwitchSession(e.target.value)} aria-label="Phiên trò chuyện" className="min-w-0 flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100">
                {sessions.map((session) => <option key={session.sessionId} value={session.sessionId}>{session.title}</option>)}
              </select>
              <button type="button" title="Cuộc trò chuyện mới" onClick={onNewSession} className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800"><Plus className="w-4 h-4" /></button>
              <button type="button" title="Đổi tên phiên" disabled={!activeSessionId} onClick={() => {
                const title = window.prompt('Tên phiên', sessions.find((session) => session.sessionId === activeSessionId)?.title || '');
                if (title?.trim()) onRenameSession(activeSessionId, title.trim());
              }} className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-40"><Pencil className="w-4 h-4" /></button>
              <button type="button" title="Xóa phiên" disabled={!activeSessionId} onClick={() => {
                if (window.confirm('Xóa cuộc trò chuyện này?')) onDeleteSession(activeSessionId);
              }} className="p-1.5 rounded-lg border border-slate-700 hover:bg-red-950 disabled:opacity-40"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 p-1">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lịch sử phiên</p>
              {sessions.map((session) => (
                <button key={session.sessionId} type="button" onClick={() => onSwitchSession(session.sessionId)} className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${session.sessionId === activeSessionId ? 'border-indigo-500/50 bg-indigo-500/15 text-white' : 'border-transparent text-slate-400 hover:bg-slate-800'}`}>
                  <span className="block truncate font-medium">{session.title}</span>
                  <span className="text-[10px] opacity-60">{session.messageCount} tin nhắn</span>
                </button>
              ))}
            </div>

          </div>
        )}

        {/* Action In Progress Banner */}
        {isProcessingAction && (
          <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-800/80 text-xs text-purple-200 flex items-center gap-2 animate-pulse">
            <Sparkles className="w-4 h-4 animate-spin text-purple-400" />
            <span>{processingLabel || 'Đang thực hiện tác vụ AI...'}</span>
          </div>
        )}
      </div>
    </aside>
  );
};
