
import React, { useEffect, useRef, useState } from 'react';
import { Material, Segment } from '../types';
import { ArrowLeft, Play, Pause, Square, AlignJustify, SkipBack, SkipForward, Repeat, Download, ChevronLeft, ChevronRight, Settings2, Trash2, Mic, Eye, EyeOff, BookOpen, MessageSquare } from 'lucide-react';
import { mergeAudioBlobs } from '../utils/audioUtils';

interface BlurReaderProps {
  material: Material;
  onBack: () => void;
}

type ViewMode = 'visible' | 'blur' | 'blind';
type PlaybackMode = 'article' | 'sentence';
type LoopSetting = number;

export const BlurReader: React.FC<BlurReaderProps> = ({ material, onBack }) => {
  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  
  // Settings
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('sentence'); // Default to drilling
  const [loopSetting, setLoopSetting] = useState<LoopSetting>(1);
  const [viewMode, setViewMode] = useState<ViewMode>('blur');
  
  // Recording State
  const [userRecordings, setUserRecordings] = useState<Record<string, Blob>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isUserPlaying, setIsUserPlaying] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const userAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const preciseCheckRef = useRef<number>();
  const simulationRef = useRef<number | null>(null);
  
  // CRITICAL: Synchronous Refs
  const activeIndexRef = useRef(-1);
  const playCountRef = useRef(0); // Tracks how many times current sentence has played

  // --- Initialization ---
  useEffect(() => {
    setActiveIndex(-1);
    activeIndexRef.current = -1;
    setCurrentTime(0);
    setIsPlaying(false);
    playCountRef.current = 0;
    setUserRecordings({});
    segmentRefs.current = segmentRefs.current.slice(0, material.segments.length);
    
    // Set duration for mock items
    if (!material.audioUrl) {
        const lastSeg = material.segments[material.segments.length - 1];
        setDuration(lastSeg ? lastSeg.endTime : 60);
    }
  }, [material]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

          if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
          if (e.key === 'Control') { e.preventDefault(); replayCurrent(); }
          if (e.code === 'ArrowUp') { e.preventDefault(); cycleViewMode(); }
          if (e.code === 'ArrowLeft') { e.preventDefault(); skipToSegment('prev'); }
          if (e.code === 'ArrowRight') { e.preventDefault(); skipToSegment('next'); }
          if (e.key === ',' || e.key === '<') { seekRelative(-2); }
          if (e.key === '.' || e.key === '>') { seekRelative(2); }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [material.audioUrl, isPlaying, viewMode]);


  // --- High Precision Loop (Core Logic) ---
  useEffect(() => {
    if (isPlaying && material.audioUrl) {
      const check = () => {
        if (audioRef.current) {
           const t = audioRef.current.currentTime;
           const idx = activeIndexRef.current;
           
           // Logic for SENTENCE MODE
           if (playbackMode === 'sentence' && idx !== -1) {
               const seg = material.segments[idx];
               const endTime = seg.endTime;
               const startTime = seg.startTime;

               // Use a slightly larger buffer (0.15s) to catch the end before it bleeds into next sentence
               if (t >= endTime - 0.15) {
                   // Increment count
                   playCountRef.current += 1;

                   if (playCountRef.current < loopSetting) {
                       // Loop Again: Rewind to start and Keep Playing
                       audioRef.current.currentTime = startTime;
                   } else {
                       // Loop Finished: Rewind to start and PAUSE
                       audioRef.current.pause();
                       audioRef.current.currentTime = startTime;
                       setCurrentTime(startTime);
                       setIsPlaying(false);
                       playCountRef.current = 0; // Reset for next interaction
                   }
               }
           }
        }
        preciseCheckRef.current = requestAnimationFrame(check);
      };
      preciseCheckRef.current = requestAnimationFrame(check);
    }

    return () => {
        if (preciseCheckRef.current) cancelAnimationFrame(preciseCheckRef.current);
    };
  }, [isPlaying, playbackMode, loopSetting, material.audioUrl, material.segments]);


  // --- Simulation Mode (Mock) ---
  const startSimulation = (startTimeOffset: number) => {
    if (simulationRef.current) window.clearInterval(simulationRef.current);
    const startTimestamp = Date.now() - (startTimeOffset * 1000);
    
    simulationRef.current = window.setInterval(() => {
        const newTime = (Date.now() - startTimestamp) / 1000;
        
        // Sim Loop Logic
        if (playbackMode === 'sentence' && activeIndexRef.current !== -1) {
            const idx = activeIndexRef.current;
            const seg = material.segments[idx];

            if (newTime >= seg.endTime) {
                 playCountRef.current += 1;
                 if (playCountRef.current < loopSetting) {
                     startSimulation(seg.startTime);
                 } else {
                     if (simulationRef.current) window.clearInterval(simulationRef.current);
                     setIsPlaying(false);
                     setCurrentTime(seg.startTime);
                     playCountRef.current = 0;
                 }
                 return;
            }
        }

        if (newTime >= duration && duration > 0) {
            setIsPlaying(false);
            setCurrentTime(0);
            if (simulationRef.current) window.clearInterval(simulationRef.current);
        } else {
            setCurrentTime(newTime);
        }
    }, 100);
  };

  // --- Playback Controls ---

  const togglePlay = () => {
    if (isUserPlaying && userAudioRef.current) {
        userAudioRef.current.pause();
        setIsUserPlaying(false);
    }

    if (material.audioUrl) {
      if (!audioRef.current) return;
      
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // Reset play count if we are starting fresh (optional, but good for UX)
        // If we are resumed in middle, maybe don't reset? 
        // Let's reset only if we are at the very start or end? 
        // For simplicity, if manually toggled, we can continue current loop cycle or reset.
        // Let's NOT reset playCountRef here so resuming works as expected (finishing the current loop).
        
        audioRef.current.play().catch(e => console.error("Playback error", e));
        setIsPlaying(true);
      }
    } else {
      if (isPlaying) {
        if (simulationRef.current) window.clearInterval(simulationRef.current);
        setIsPlaying(false);
      } else {
        setIsPlaying(true);
        startSimulation(currentTime);
      }
    }
  };
  
  const replayCurrent = () => {
      if (activeIndexRef.current === -1) return;
      
      const targetTime = material.segments[activeIndexRef.current].startTime;
      playCountRef.current = 0; // Reset loop count on manual replay
      
      if (material.audioUrl && audioRef.current) {
          audioRef.current.currentTime = targetTime;
          setCurrentTime(targetTime);
          if (!isPlaying) {
              audioRef.current.play();
              setIsPlaying(true);
          }
      } else if (!material.audioUrl) {
          startSimulation(targetTime);
          setIsPlaying(true);
      }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration);
    }
  };

  const skipToSegment = (direction: 'prev' | 'next') => {
      let targetIndex = activeIndexRef.current;
      
      if (targetIndex === -1) {
          targetIndex = 0;
      } else {
          if (direction === 'prev') {
              const currentSeg = material.segments[targetIndex];
              // If we are more than 2s into the segment, restart it. Otherwise go to prev.
              if (currentSeg && (currentTime - currentSeg.startTime > 2)) {
                 targetIndex = targetIndex; 
              } else {
                 targetIndex = targetIndex - 1;
              }
          } else {
              targetIndex = targetIndex + 1;
          }
      }

      if (targetIndex < 0) targetIndex = 0;
      if (targetIndex >= material.segments.length) targetIndex = material.segments.length - 1;

      // Update refs immediately to prevent race conditions in loop
      activeIndexRef.current = targetIndex;
      setActiveIndex(targetIndex);
      playCountRef.current = 0; // Reset loop count for new sentence
      
      const targetTime = material.segments[targetIndex]?.startTime ?? 0;
      setCurrentTime(targetTime);
      
      if (material.audioUrl && audioRef.current) {
          audioRef.current.currentTime = targetTime;
          audioRef.current.play();
          setIsPlaying(true);
      } else if (!material.audioUrl) {
          startSimulation(targetTime);
          setIsPlaying(true);
      }
  };

  const seekRelative = (seconds: number) => {
      if (audioRef.current) {
          const newTime = Math.max(0, Math.min(audioRef.current.duration, audioRef.current.currentTime + seconds));
          audioRef.current.currentTime = newTime;
          setCurrentTime(newTime);
      }
  };

  const handleSegmentClick = (segment: Segment) => {
      const idx = material.segments.findIndex(s => s.id === segment.id);
      activeIndexRef.current = idx;
      setActiveIndex(idx);
      playCountRef.current = 0;

      if (audioRef.current) {
          audioRef.current.currentTime = segment.startTime;
          audioRef.current.play();
          setIsPlaying(true);
      } else if (!material.audioUrl) {
          startSimulation(segment.startTime);
          setIsPlaying(true);
      }
  };

  // --- Scroll Sync ---
  useEffect(() => {
    const idx = material.segments.findIndex(
      (seg) => currentTime >= seg.startTime && currentTime < seg.endTime
    );
    
    // Only update active index if we are in Article Mode OR if we haven't set one yet.
    // In Sentence Mode, we want manual control, but checking against time is still good for validation.
    // However, in Sentence Mode, we manually set activeIndexRef when skipping/clicking.
    // The only time this useEffect is critical is for Article Mode where time flows freely.
    if (idx !== -1 && idx !== activeIndex) {
        if (playbackMode === 'article') {
            activeIndexRef.current = idx;
            setActiveIndex(idx);
        }
        // Always scroll
        if (segmentRefs.current[idx]) {
            segmentRefs.current[idx]?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }
  }, [currentTime, material.segments, playbackMode]);

  useEffect(() => {
    return () => {
      if (simulationRef.current) window.clearInterval(simulationRef.current);
      if (preciseCheckRef.current) cancelAnimationFrame(preciseCheckRef.current);
    };
  }, []);

  // --- Shadowing Handlers ---
  const toggleRecording = async () => {
    if (activeIndex === -1) return;

    if (isRecording) {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    } else {
        if (isPlaying) togglePlay();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const chunks: BlobPart[] = [];
            const mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const currentSegId = material.segments[activeIndexRef.current].id;
                setUserRecordings(prev => ({ ...prev, [currentSegId]: blob }));
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Mic access denied", err);
            alert("Microphone access is needed for shadowing.");
        }
    }
  };

  const playUserRecording = () => {
      if (activeIndex === -1) return;
      const segId = material.segments[activeIndex].id;
      const blob = userRecordings[segId];
      if (!blob) return;

      if (isPlaying && audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
      }

      const url = URL.createObjectURL(blob);
      if (userAudioRef.current) {
          userAudioRef.current.src = url;
          userAudioRef.current.play();
          setIsUserPlaying(true);
          userAudioRef.current.onended = () => {
              setIsUserPlaying(false);
              URL.revokeObjectURL(url);
          };
      }
  };

  const deleteUserRecording = () => {
      if (activeIndex === -1) return;
      const segId = material.segments[activeIndex].id;
      const newRecs = { ...userRecordings };
      delete newRecs[segId];
      setUserRecordings(newRecs);
  };

  const handleExport = async () => {
      const orderedBlobs: Blob[] = [];
      let hasRecordings = false;
      for (const seg of material.segments) {
          if (userRecordings[seg.id]) {
              orderedBlobs.push(userRecordings[seg.id]);
              hasRecordings = true;
          }
      }
      if (!hasRecordings) {
          alert("No recordings found to export.");
          return;
      }
      setIsExporting(true);
      try {
          const wavBlob = await mergeAudioBlobs(orderedBlobs);
          const url = URL.createObjectURL(wavBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `practice-${material.title.slice(0, 20)}.wav`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (e) {
          console.error("Export failed", e);
          alert("Failed to create audio file.");
      }
      setIsExporting(false);
  };

  // --- Helper Icons/Labels ---
  const cycleViewMode = () => {
      setViewMode(prev => {
          if (prev === 'visible') return 'blur';
          if (prev === 'blur') return 'blind';
          return 'visible';
      });
  };

  const getViewModeIcon = () => {
      if (viewMode === 'visible') return <Eye size={20} />;
      if (viewMode === 'blur') return <AlignJustify size={20} />;
      return <EyeOff size={20} />;
  };

  const cycleLoopSetting = () => {
      setLoopSetting(prev => {
          if (prev === 1) return 2;
          if (prev === 2) return 3;
          if (prev === 3) return Infinity;
          return 1;
      });
  };

  const getLoopLabel = () => {
      if (loopSetting === Infinity) return "∞";
      return `${loopSetting}x`;
  };

  // --- Render ---
  const hasCurrentRecording = activeIndex !== -1 && !!userRecordings[material.segments[activeIndex]?.id];

  return (
    <div className="fixed inset-0 z-50 bg-[#09090b] flex flex-col animate-in fade-in duration-300">
      
      {material.audioUrl && (
        <audio
          ref={audioRef}
          src={material.audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
        />
      )}
      <audio ref={userAudioRef} />

      {/* --- Top Navbar --- */}
      <header className="flex-none px-4 py-4 md:px-6 flex items-center justify-between z-10 bg-zinc-950/80 backdrop-blur-md border-b border-white/5">
        <button 
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        
        <div className="flex items-center gap-3">
            <button 
                onClick={cycleViewMode}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
                {getViewModeIcon()}
                <span className="text-xs font-medium uppercase hidden md:inline">
                    {viewMode === 'visible' ? 'Full Text' : viewMode === 'blur' ? 'Blur Mode' : 'Blind Mode'}
                </span>
            </button>
        </div>
      </header>

      {/* --- Main Text Area --- */}
      <main className="flex-1 overflow-y-auto px-6 relative no-scrollbar" ref={scrollContainerRef}>
        <div className="max-w-2xl mx-auto pb-48 pt-8">
            <div className="mb-8">
                <span className="text-sky-500 text-xs font-bold uppercase tracking-widest block mb-2">{material.category}</span>
                <h1 className="text-2xl md:text-3xl font-serif font-bold text-white">{material.title}</h1>
            </div>
            
            <div className="space-y-4">
              {material.segments.map((seg, index) => {
                const isActive = index === activeIndex;
                const hasRec = !!userRecordings[seg.id];
                
                return (
                  <div 
                    key={seg.id}
                    ref={(el) => (segmentRefs.current[index] = el)}
                    onClick={() => handleSegmentClick(seg)}
                    className={`
                        relative transition-all duration-300 ease-out cursor-pointer rounded-xl p-3 -mx-3 border border-transparent
                        ${isActive ? 'bg-zinc-800/40 border-zinc-700/50 shadow-lg' : 'opacity-60 hover:opacity-100 hover:bg-zinc-900'}
                    `}
                  >
                     <p className={`text-xl md:text-2xl font-serif leading-relaxed transition-all duration-500 ${isActive ? 'text-zinc-100' : 'text-zinc-400'}`}>
                        {seg.text.split(/(\s+)/).map((part, i) => {
                             let className = "";
                             if (viewMode === 'blind') className = "bg-zinc-700 text-zinc-700 rounded-sm select-none";
                             // Apply blur to everything in Blur Mode
                             else if (viewMode === 'blur') className = "structure-blur";
                             
                             return <span key={i} className={className}>{part}</span>;
                        })}
                     </p>
                     {hasRec && (
                         <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.8)]" />
                     )}
                  </div>
                );
              })}
            </div>
        </div>
      </main>

      {/* --- Bottom Controls --- */}
      <div className="flex-none bg-[#1c1c1e] border-t border-white/5 pb-6 pt-2">
         
         {/* User Audio Bar */}
         {hasCurrentRecording && (
             <div className="mx-auto max-w-2xl px-4 mb-2">
                 <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-2 px-3 border border-zinc-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Your Recording</span>
                    </div>
                    <div className="flex items-center gap-2">
                         <button 
                           onClick={playUserRecording}
                           className="p-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-md text-white transition-colors"
                         >
                            {isUserPlaying ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                         </button>
                         <button 
                           onClick={deleteUserRecording}
                           className="p-1.5 hover:bg-red-500/20 text-zinc-500 hover:text-red-500 rounded-md transition-colors"
                         >
                            <Trash2 size={14} />
                         </button>
                    </div>
                 </div>
             </div>
         )}

         {/* Main Control Deck */}
         <div className="max-w-xl mx-auto px-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            
            {/* Left: Mode & Loop */}
            <div className="flex items-center gap-2">
                {/* Playback Mode Toggle */}
                <button 
                    onClick={() => setPlaybackMode(m => m === 'article' ? 'sentence' : 'article')}
                    className={`
                        p-2 rounded-xl transition-all
                        ${playbackMode === 'article' ? 'bg-zinc-800 text-zinc-400' : 'bg-sky-500/20 text-sky-400'}
                    `}
                    title={playbackMode === 'article' ? "Switch to Sentence Mode" : "Switch to Article Mode"}
                >
                    {playbackMode === 'article' ? <BookOpen size={18} /> : <MessageSquare size={18} />}
                </button>

                {/* Loop Counter (Only in Sentence Mode) */}
                {playbackMode === 'sentence' && (
                    <button 
                        onClick={cycleLoopSetting}
                        className="flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                        <Repeat size={14} />
                        <span className="text-[9px] font-bold uppercase mt-0.5">{getLoopLabel()}</span>
                    </button>
                )}
            </div>

            {/* Center: Transport Controls */}
            <div className="flex items-center gap-3 bg-zinc-900/80 p-2 rounded-full border border-white/5 shadow-xl">
                 <button onClick={() => skipToSegment('prev')} className="p-3 text-zinc-400 hover:text-white transition-colors" title="Prev Sentence">
                     <SkipBack size={20} fill="currentColor" />
                 </button>
                 
                 <button onClick={() => seekRelative(-2)} className="hidden sm:block p-2 text-zinc-500 hover:text-zinc-300" title="-2s">
                     <ChevronLeft size={18} />
                 </button>

                 <button 
                    onClick={togglePlay}
                    className="w-14 h-14 bg-sky-500 hover:bg-sky-400 text-white rounded-full flex items-center justify-center shadow-lg shadow-sky-500/20 transition-all transform hover:scale-105 active:scale-95"
                 >
                    {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                 </button>

                 <button onClick={() => seekRelative(2)} className="hidden sm:block p-2 text-zinc-500 hover:text-zinc-300" title="+2s">
                     <ChevronRight size={18} />
                 </button>

                 <button onClick={() => skipToSegment('next')} className="p-3 text-zinc-400 hover:text-white transition-colors" title="Next Sentence">
                     <SkipForward size={20} fill="currentColor" />
                 </button>
            </div>

            {/* Right: Mic & Export */}
            <div className="flex items-center justify-end gap-2">
                <button 
                  onClick={handleExport}
                  disabled={isExporting}
                  className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  title="Export Recording"
                >
                   <Download size={18} />
                </button>

                <button 
                    onClick={toggleRecording}
                    className={`
                        w-12 h-12 flex items-center justify-center rounded-full transition-all shadow-lg
                        ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}
                    `}
                >
                    {isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={20} />}
                </button>
            </div>
         </div>
      </div>
    </div>
  );
};
