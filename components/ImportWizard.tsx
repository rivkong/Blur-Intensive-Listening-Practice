
import React, { useState, useRef } from 'react';
import { X, Upload, FileAudio, FileText, Check, Loader2, Music, Clock } from 'lucide-react';
import { Material, Segment } from '../types';

interface ImportWizardProps {
  onClose: () => void;
  onImport: (material: Material) => void;
}

// Strict Sentence Splitting using Intl.Segmenter
// This avoids breaking sentences at commas, ensuring "Sentence Mode" works correctly.
const splitIntoSentences = (text: string): string[] => {
  // Normalize whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();
  
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
      const segmenter = new (Intl as any).Segmenter('en', { granularity: 'sentence' });
      const segments = [...segmenter.segment(normalized)];
      return segments.map((s: any) => s.segment.trim()).filter(s => s.length > 0);
  }

  // Fallback regex for browsers without Segmenter support
  // Splits on . ! ? or Chinese equivalents, keeping the punctuation.
  const processed = normalized.replace(/([.!?。！？])/g, "$1|");
  return processed.split('|').map(s => s.trim()).filter(s => s.length > 0);
};

export const ImportWizard: React.FC<ImportWizardProps> = ({ onClose, onImport }) => {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [offset, setOffset] = useState<string>('0'); 
  const [isProcessing, setIsProcessing] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
    }
  };

  const processImport = async () => {
    if (!title || !text || !audioFile) return;
    setIsProcessing(true);

    try {
      const audioUrl = URL.createObjectURL(audioFile);

      const duration = await new Promise<number>((resolve, reject) => {
        const audio = new Audio(audioUrl);
        audio.onloadedmetadata = () => resolve(audio.duration);
        audio.onerror = () => reject("Could not load audio");
      });

      const offsetSeconds = parseFloat(offset) || 0;
      if (offsetSeconds >= duration) {
        throw new Error("Offset cannot be longer than the audio duration.");
      }

      // Split by Sentence strictly
      const cleanedSegments = splitIntoSentences(text);
      
      if (cleanedSegments.length === 0) {
          throw new Error("Could not find any text segments.");
      }

      // Calculate Timestamps (Proportional Distribution)
      // Note: This is an estimation. Real apps would need manual alignment tools.
      const effectiveDuration = duration - offsetSeconds;
      const totalChars = cleanedSegments.reduce((acc, s) => acc + s.length, 0);
      
      let currentTime = offsetSeconds; 
      
      const segments: Segment[] = cleanedSegments.map((s, i) => {
        const segmentDuration = totalChars > 0 ? (s.length / totalChars) * effectiveDuration : 0;
        const seg: Segment = {
          id: `imp-${Date.now()}-${i}`,
          text: s,
          startTime: currentTime,
          endTime: currentTime + segmentDuration
        };
        currentTime += segmentDuration;
        return seg;
      });

      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      const newMaterial: Material = {
        id: `custom-${Date.now()}`,
        title,
        description: text.slice(0, 150).replace(/\s+/g, ' ') + (text.length > 150 ? "..." : ""),
        category: "Imported",
        difficulty: "Medium",
        duration: durationStr,
        imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(title + " conceptual illustration")}?width=800&height=600&nologo=true`,
        audioUrl,
        segments
      };

      onImport(newMaterial);
    } catch (error) {
      console.error("Import failed", error);
      alert(error instanceof Error ? error.message : "Failed to process audio file.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#1c1c1e] rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 sticky top-0 bg-[#1c1c1e] z-10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Upload size={20} className="text-sky-500" />
            Import Session
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Title Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-zinc-500 tracking-wider">Session Title</label>
            <input 
              type="text" 
              placeholder="e.g., TED Talk: The Power of Vulnerability"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all placeholder:text-zinc-600"
            />
          </div>

          {/* Audio Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-zinc-500 tracking-wider">Audio File</label>
            <div 
              onClick={() => audioInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all group
                ${audioFile ? 'border-sky-500/50 bg-sky-500/10' : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50'}
              `}
            >
              <input 
                ref={audioInputRef}
                type="file" 
                accept="audio/*" 
                className="hidden" 
                onChange={handleFileChange}
              />
              {audioFile ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-sky-500 flex items-center justify-center mb-2 shadow-lg shadow-sky-500/20">
                    <Music className="text-white" size={24} />
                  </div>
                  <p className="text-sky-200 font-medium truncate max-w-full px-4">{audioFile.name}</p>
                  <p className="text-sky-500/60 text-xs mt-1">Click to change</p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-zinc-800 group-hover:bg-zinc-700 flex items-center justify-center mb-2 transition-colors">
                    <FileAudio className="text-zinc-400 group-hover:text-zinc-200" size={24} />
                  </div>
                  <p className="text-zinc-300 font-medium">Click to upload audio</p>
                  <p className="text-zinc-500 text-xs mt-1">MP3, WAV, M4A supported</p>
                </>
              )}
            </div>
          </div>

          {/* Offset Config */}
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-2">
             <label className="text-xs font-semibold uppercase text-zinc-500 tracking-wider block">Intro Offset (s)</label>
             <div className="flex items-center gap-2">
                <Clock size={16} className="text-zinc-400" />
                <input 
                  type="number" 
                  min="0"
                  value={offset}
                  onChange={(e) => setOffset(e.target.value)}
                  className="w-full bg-black/50 border border-zinc-700 rounded-lg px-2 py-1 text-white text-sm focus:border-sky-500 focus:outline-none"
                />
             </div>
             <p className="text-[10px] text-zinc-500 pt-1">Skip intro music/silence to better align text.</p>
          </div>

          {/* Transcript Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-zinc-500 tracking-wider">Transcript</label>
            <div className="relative">
              <textarea 
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the full transcript here. We will split it into sentences for you..."
                className="w-full h-32 bg-zinc-900/50 border border-zinc-700 rounded-xl p-4 text-sm text-zinc-300 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all placeholder:text-zinc-600 resize-none"
              />
              <FileText className="absolute bottom-4 right-4 text-zinc-600 pointer-events-none" size={16} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex items-center justify-end gap-3 bg-[#1c1c1e] sticky bottom-0 z-10 pb-6">
          <button 
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={processImport}
            disabled={!title || !text || !audioFile || isProcessing}
            className={`
              flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all
              ${(!title || !text || !audioFile || isProcessing) 
                ? 'bg-zinc-700 opacity-50 cursor-not-allowed' 
                : 'bg-sky-500 hover:bg-sky-400 hover:scale-105 active:scale-95 shadow-sky-500/20'}
            `}
          >
            {isProcessing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check size={18} strokeWidth={3} />
                Create Session
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
