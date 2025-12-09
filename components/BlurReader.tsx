
import React, { useEffect, useRef, useState } from 'react';
import { Material, Segment } from '../types';
import { ArrowLeft, Play, Pause, RotateCcw, Eye, EyeOff, Mic, Square, AlignJustify, SkipBack, SkipForward, Repeat, Download, ChevronLeft, ChevronRight, Settings2, Trash2, Infinity, Repeat1 } from 'lucide-react';
import { mergeAudioBlobs } from '../utils/audioUtils';

interface BlurReaderProps {
  material: Material;
  onBack: () => void;
}

type ViewMode = 'visible' | 'blur' | 'blind';
type PlayMode = 'article' | 'sentence';
type LoopMode = 1 | 2 | 3 | typeof Number.POSITIVE_INFINITY;

export const BlurReader: React.FC<BlurReaderProps> = ({ material, onBack }) => {
  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  
  // Drill Settings
  const [playMode, setPlayMode] = useState<PlayMode>('article'); // 'article' = continuous, 'sentence' = pause/loop at end
  const [loopCount, setLoopCount] = useState<LoopMode>(1);

  // Visual State
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
  
  // Track how many times the current segment has played
  const currentPlayCountRef = useRef(0);
  const lastActiveIndexRef = useRef(-1);

  // --- Initialization ---
  useEffect(() => {
    setActiveIndex(-1);
    setCurrentTime(0);
    setIsPlaying(false);
    setUserRecordings({});
    segmentRefs.current = segmentRefs.current.slice(0, material.segments.length);
    currentPlayCountRef.current = 0;
    
    // Set duration for mock items immediately
    if (!material.audioUrl) {
        const lastSeg = material.segments[material.segments.length - 1];
        setDuration(lastSeg ? lastSeg.endTime : 60);
    }
  }, [material]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (!material.audioUrl || !audioRef.current) return;

          // Seek -3s
          if (e.code === 'ArrowLeft') {
              seekRelative(-3);
          }
          // Seek +3s
          if (e.code === 'ArrowRight') {
              seekRelative(3);
          }
          // Toggle Play
          if (e.code === 'Space') {
              e.preventDefault(); 
              togglePlay();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [material.audioUrl, isPlaying]);


  // --- High Precision Loop (The Core Logic) ---
  useEffect(() => {
    if (isPlaying && material.audioUrl) {
      const check = () => {
        if (audioRef.current) {
           const t = audioRef.current.currentTime;
           
           // Logic for Sentence Mode (Drilling)
           if (playMode === 'sentence' && activeIndex !== -1) {
               const currentSeg = material.segments[activeIndex];
               
               // If we reached the end of the sentence
               if (currentSeg && t >= currentSeg.endTime - 0.05) {
                   
                   // Check Loop Count
                   // We increment play count when we hit the end
                   if (currentPlayCountRef.current < loopCount - 1) {
                        // Replay
                        currentPlayCountRef.current += 1;
                        audioRef.current.currentTime = currentSeg.startTime;
                   } else {
                        // Finished all loops
                        audioRef.current.pause();
                        audioRef.current.currentTime = currentSeg.endTime - 0.01; // Clamp to end
                        setIsPlaying(false);
                        // Do not reset play count here; wait for manual action to reset
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
  }, [isPlaying, playMode, loopCount, activeIndex, material.audioUrl, material.segments]);


  // --- Simulation Mode (For Mock Content) ---
  const startSimulation = (startTimeOffset: number) => {
    if (simulationRef.current) window.clearInterval(simulationRef.current);
    const startTimestamp = Date.now() - (startTimeOffset * 1000);
    
    simulationRef.current = window.setInterval(() => {
        const newTime = (Date.now() - startTimestamp) / 1000;
        
        // Simulation Sentence Mode Logic
        if (playMode === 'sentence') {
             const currentSeg = material.segments.find(s => newTime >= s.startTime && newTime <= s.endTime);
             if (currentSeg && newTime >= currentSeg.endTime) {
                 
                 if (currentPlayCountRef.current < loopCount - 1) {
                     currentPlayCountRef.current += 1;
                     startSimulation(currentSeg.startTime);
                     return;
                 } else {
                     setIsPlaying(false);
                     setCurrentTime(currentSeg.startTime); 
                     if (simulationRef.current) window.clearInterval(simulationRef.current);
                     return;
                 }
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
    // If user is listening to their own recording, stop that first
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
        // If restarting in sentence mode from a finished state (end of segment)
        if (playMode === 'sentence' && activeIndex !== -1) {
             const currentSeg = material.segments[activeIndex];
             // If we are at the end, this counts as a "Replay", so reset the loop counter and jump to start
             if (currentSeg && audioRef.current.currentTime >= currentSeg.endTime - 0.1) {
                currentPlayCountRef.current = 0;
                audioRef.current.currentTime = currentSeg.startTime;
             }
        }
        audioRef.current.play().catch(e => console.error("Playback error", e));
        setIsPlaying(true);
      }
    } else {
      // Simulation
      if (isPlaying) {
        if (simulationRef.current) window.clearInterval(simulationRef.current);
        setIsPlaying(false);
      } else {
        setIsPlaying(true);
        startSimulation(currentTime);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration);
    }
  };

  const skipToSegment = (direction: 'prev' | 'next') => {
      let targetIndex = activeIndex;
      
      if (direction === 'prev') {
          const currentSeg = material.segments[activeIndex];
          // If we are > 2 seconds into a segment, restart it. Otherwise go to previous.
          if (currentSeg && (currentTime - currentSeg.startTime > 2)) {
             targetIndex = activeIndex;
          } else {
             targetIndex = activeIndex - 1;
          }
      } else {
          targetIndex = activeIndex + 1;
      }

      // Clamp
      if (targetIndex < 0) targetIndex = 0;
      if (targetIndex >= material.segments.length) targetIndex = material.segments.length - 1;

      // Reset play count when manually changing segment
      currentPlayCountRef.current = 0;

      const targetTime = material.segments[targetIndex]?.startTime ?? 0;
      setCurrentTime(targetTime);
      
      if (material.audioUrl && audioRef.current) {
          audioRef.current.currentTime = targetTime;
          // In drill mode, we usually auto-play when skipping
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
      // Reset play count when clicking a specific segment
      currentPlayCountRef.current = 0;

      if (audioRef.current) {
          audioRef.current.currentTime = segment.startTime;
          audioRef.current.play();
          setIsPlaying(true);
          const idx = material.segments.findIndex(s => s.id === segment.id);
          if (idx !== -1) setActiveIndex(idx);
      } else if (!material.audioUrl) {
          startSimulation(segment.startTime);
          setIsPlaying(true);
      }
  };

  // --- Scroll Sync & Active Index Logic ---
  useEffect(() => {
    const idx = material.segments.findIndex(
      (seg) => currentTime >= seg.startTime && currentTime < seg.endTime
    );
    
    // If index changed, we might need to reset play count if we drifted naturally
    if (idx !== -1 && idx !== lastActiveIndexRef.current) {
        lastActiveIndexRef.current = idx;
        setActiveIndex(idx);
        currentPlayCountRef.current = 0; // Reset loop count on new segment entry

        if (segmentRefs.current[idx]) {
            segmentRefs.current[idx]?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            });
        }
    } else if (idx === -1 && activeIndex === -1 && material.segments.length > 0) {
        setActiveIndex(0);
        lastActiveIndexRef.current = 0;
    }
  }, [currentTime, material.segments]);

  useEffect(() => {
    return () => {
      if (simulationRef.current) window.clearInterval(simulationRef.current);
      if (preciseCheckRef.current) cancelAnimationFrame(preciseCheckRef.current);
    };
  }, []);

  // --- Shadowing / Recording Logic ---
  
  const toggleRecording = async () => {
    if (activeIndex === -1) return;

    if (isRecording) {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    } else {
        // Stop playback when recording starts
        if (isPlaying) togglePlay();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const chunks: BlobPart[] = [];
            const mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const currentSegId = material.segments[activeIndex].id;
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

      // Stop main audio
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

  // --- Helper: View Modes ---
  const cycleViewMode = () => {
      if (viewMode === 'visible') setViewMode('blur');
      else if (viewMode === 'blur') setViewMode('blind');
      else setViewMode('visible');
  };

  const getViewModeIcon = () => {
      if (viewMode === 'visible') return <Eye size={20} />;
      if (viewMode === 'blur') return <AlignJustify size={20} />;
      return <EyeOff size={20} />;
  };

  const cycleLoopMode = () => {
      if (loopCount === 1) setLoopCount(2);
      else if (loopCount === 2) setLoopCount(3);
      else if (loopCount === 3) setLoopCount(Number.POSITIVE_INFINITY);
      else setLoopCount(1);
  };

  const getLoopIcon = () => {
      if (loopCount === Number.POSITIVE_INFINITY) return <Infinity size={18} />;
      if (loopCount === 1) return <Repeat1 size={18} />;
      return (
        <div className="relative">
            <Repeat size={18} />
            <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-sky-500 text-black rounded-full w-3 h-3 flex items-center justify-center">
                {loopCount}
            </span>
        </div>
      );
  };

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // --- Render ---

  // Does the current active sentence have a recording?
  const hasCurrentRecording = activeIndex !== -1 && !!userRecordings[material.segments[activeIndex]?.id];

  return (
    <div className="fixed inset-0 z-50 bg-[#09090b] flex flex-col animate-in fade-in duration-300">
      
      {/* Hidden Audio Elements */}
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
             {/* View Mode Toggle */}
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
            
            <div className="space-y-6">
              {material.segments.map((seg, index) => {
                const isActive = index === activeIndex;
                const hasRec = !!userRecordings[seg.id];
                
                return (
                  <div 
                    key={seg.id}
                    ref={(el) => (segmentRefs.current[index] = el)}
                    onClick={() => handleSegmentClick(seg)}
                    className={`
                        relative transition-all duration-300 ease-out cursor-pointer rounded-xl p-4 -mx-4 border border-transparent
                        ${isActive ? 'bg-zinc-800/40 border-zinc-700/50 shadow-lg' : 'opacity-60 hover:opacity-100 hover:bg-zinc-900'}
                    `}
                  >
                     {/* Text Content */}
                     <p className={`text-xl md:text-2xl font-serif leading-relaxed transition-all duration-500 ${isActive ? 'text-zinc-100' : 'text-zinc-400'}`}>
                        {seg.text.split(/(\s+)/).map((part, i) => {
                            if (viewMode === 'blind') {
                                // In blind mode, replace non-space text with blocks
                                return /\S/.test(part) 
                                    ? <span key={i} className="bg-zinc-700 text-zinc-700 rounded-sm select-none mx-[1px]">_</span> 
                                    : <span key={i}>{part}</span>;
                            }
                            // In Blur Mode, we apply the blur effect to ALL segments, including the active one
                            if (viewMode === 'blur') {
                                return (
                                    <span 
                                        key={i} 
                                        // Active text is blurred just like inactive text in this mode, per user request
                                        className="structure-blur"
                                    >
                                        {part}
                                    </span>
                                );
                            }
                            // Visible mode
                            return <span key={i}>{part}</span>;
                        })}
                    </p>

                    {/* Indicator if recorded */}
                    {hasRec && !isActive && (
                        <div className="absolute right-2 top-2 w-2 h-2 rounded-full bg-red-500/70" title="Recorded"></div>
                    )}
                  </div>
                );
              })}
            </div>
        </div>
      </main>

      {/* --- Footer Controls (Fixed) --- */}
      <div className="flex-none z-20 bg-[#121214] border-t border-zinc-800 pb-safe">
         
         {/* -- User Recording Bar (Conditionally Rendered) -- */}
         {hasCurrentRecording && (
             <div className="bg-zinc-900/50 border-b border-zinc-800 px-4 py-2 flex items-center justify-between animate-in slide-in-from-bottom-2">
                 <div className="flex items-center gap-3">
                     <div className="text-xs font-bold text-red-400 uppercase tracking-wider">My Recording</div>
                     <button 
                        onClick={playUserRecording}
                        className="flex items-center gap-2 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-full text-xs text-zinc-200 transition-colors"
                     >
                         {isUserPlaying ? <Pause size={12} fill="currentColor"/> : <Play size={12} fill="currentColor"/>}
                         Play
                     </button>
                 </div>
                 <button 
                    onClick={deleteUserRecording}
                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                    title="Delete recording"
                 >
                     <Trash2 size={14} />
                 </button>
             </div>
         )}

         {/* -- Main Control Bar -- */}
         <div className="max-w-3xl mx-auto w-full px-4 py-4 space-y-4">
            
            {/* Progress */}
            <div className="flex items-center gap-3 text-[10px] md:text-xs font-mono text-zinc-500">
                <span className="w-10 text-right">{formatTime(currentTime)}</span>
                <div 
                    className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden cursor-pointer group"
                    onClick={(e) => {
                        if(!audioRef.current) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const percent = (e.clientX - rect.left) / rect.width;
                        audioRef.current.currentTime = percent * (duration || 1);
                        setCurrentTime(audioRef.current.currentTime);
                    }}
                >
                    <div 
                        className="h-full bg-sky-500 rounded-full group-hover:bg-sky-400 transition-all" 
                        style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                    />
                </div>
                <span className="w-10">{formatTime(duration)}</span>
            </div>

            <div className="flex items-center justify-between">
                
                {/* Left: Toggles */}
                <div className="flex items-center gap-1 md:gap-2 w-1/4">
                    <button
                        onClick={() => setPlayMode(playMode === 'article' ? 'sentence' : 'article')}
                        className={`flex flex-col md:flex-row items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                            playMode === 'sentence' ? 'text-sky-400 bg-sky-950/30' : 'text-zinc-500'
                        }`}
                        title="Toggle Drill Mode (Pause/Loop per sentence)"
                    >
                        <Settings2 size={18} />
                        <span className="text-[10px] font-bold uppercase">{playMode === 'article' ? 'Full' : 'Drill'}</span>
                    </button>

                    {playMode === 'sentence' && (
                        <button
                            onClick={cycleLoopMode}
                            className={`flex flex-col md:flex-row items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                                loopCount !== 1 ? 'text-green-400 bg-green-950/30' : 'text-zinc-600'
                            }`}
                            title="Loop Count"
                        >
                            {getLoopIcon()}
                            <span className="text-[10px] font-bold uppercase">
                                {loopCount === Number.POSITIVE_INFINITY ? 'Inf' : `${loopCount}x`}
                            </span>
                        </button>
                    )}
                </div>

                {/* Center: Playback */}
                <div className="flex items-center gap-2 md:gap-4 justify-center flex-1">
                    <button 
                        onClick={() => skipToSegment('prev')}
                        className="p-2 text-zinc-400 hover:text-white transition-colors"
                        title="Previous Sentence"
                    >
                        <SkipBack size={20} />
                    </button>
                    
                    <button 
                        onClick={() => seekRelative(-3)}
                        className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors hidden sm:block"
                        title="Back 3s"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <button 
                        onClick={togglePlay}
                        className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/5"
                    >
                        {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                    </button>

                    <button 
                        onClick={() => seekRelative(3)}
                        className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors hidden sm:block"
                        title="Forward 3s"
                    >
                        <ChevronRight size={20} />
                    </button>

                    <button 
                        onClick={() => skipToSegment('next')}
                        className="p-2 text-zinc-400 hover:text-white transition-colors"
                        title="Next Sentence"
                    >
                        <SkipForward size={20} />
                    </button>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-3 justify-end w-1/4">
                    <button 
                        onClick={handleExport}
                        disabled={isExporting}
                        className="p-2 text-zinc-500 hover:text-sky-400 transition-colors"
                        title="Export all recordings"
                    >
                        <Download size={20} />
                    </button>

                    <button 
                        onClick={toggleRecording}
                        disabled={activeIndex === -1}
                        className={`
                            w-10 h-10 rounded-full flex items-center justify-center transition-all 
                            ${activeIndex === -1 ? 'opacity-30 cursor-not-allowed text-zinc-600 border border-zinc-800' : ''}
                            ${isRecording 
                                ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40' 
                                : 'bg-zinc-800 text-red-500 border border-zinc-700 hover:bg-zinc-700'
                            }
                        `}
                        title="Record Sentence"
                    >
                        {isRecording ? <Square size={16} fill="currentColor" /> : <Mic size={20} />}
                    </button>
                </div>

            </div>
         </div>
      </div>

    </div>
  );
};
