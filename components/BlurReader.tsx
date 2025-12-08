
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Material, Segment } from '../types';
import { ArrowLeft, Play, Pause, RotateCcw, Eye, EyeOff, Mic, Square, AlignJustify, SkipBack, SkipForward, PauseOctagon, Download, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import { mergeAudioBlobs } from '../utils/audioUtils';

interface BlurReaderProps {
  material: Material;
  onBack: () => void;
}

type ViewMode = 'visible' | 'blur' | 'blind';

// --- Static Waveform Component ---
const StaticWaveform: React.FC<{ 
  audioBuffer: AudioBuffer | null;
  color: string;
  height?: number;
}> = ({ audioBuffer, color, height = 60 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // If no buffer, draw a flat line
    if (!audioBuffer) {
        ctx.beginPath();
        ctx.strokeStyle = '#3f3f46'; // Zinc-700
        ctx.lineWidth = 2;
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        return;
    }

    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / canvas.width);
    const amp = canvas.height / 2;

    ctx.fillStyle = color;
    ctx.beginPath();

    for (let i = 0; i < canvas.width; i++) {
        let min = 1.0;
        let max = -1.0;
        
        for (let j = 0; j < step; j++) {
            const datum = data[(i * step) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        
        // Draw a symmetric bar
        // prevent infinity if array is empty
        if (max === -1.0 && min === 1.0) {
             min = 0; max = 0;
        }
        
        // Rect for this pixel column
        const y = (1 + min) * amp;
        const h = Math.max(1, (max - min) * amp);
        
        // Draw rounded bar effect
        ctx.fillRect(i, (canvas.height - h) / 2, 2, h); 
    }
  }, [audioBuffer, color]);

  return <canvas ref={canvasRef} width={600} height={height} className="w-full h-full" />;
};


export const BlurReader: React.FC<BlurReaderProps> = ({ material, onBack }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [viewMode, setViewMode] = useState<ViewMode>('blur');
  const [duration, setDuration] = useState(0);
  
  // Sentence Mode & Export State
  const [sentenceMode, setSentenceMode] = useState(false);
  const [userRecordings, setUserRecordings] = useState<Record<string, Blob>>({});
  // We keep the buffers for visualization
  const [userBuffers, setUserBuffers] = useState<Record<string, AudioBuffer>>({});
  
  const [isExporting, setIsExporting] = useState(false);

  // Audio Context & Buffers
  const audioContextRef = useRef<AudioContext | null>(null);
  const [fullOriginalBuffer, setFullOriginalBuffer] = useState<AudioBuffer | null>(null);
  const [activeSegmentBuffer, setActiveSegmentBuffer] = useState<AudioBuffer | null>(null);
  const [activeUserBuffer, setActiveUserBuffer] = useState<AudioBuffer | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  // Shadowing State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);

  const simulationRef = useRef<number | null>(null);
  const preciseCheckRef = useRef<number>();

  // --- Initialize Audio Context ---
  useEffect(() => {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      return () => {
          audioContextRef.current?.close();
      };
  }, []);

  // --- Load Full Audio for Visualization ---
  useEffect(() => {
    const loadAudio = async () => {
        if (!material.audioUrl || !audioContextRef.current) return;
        setIsLoadingAudio(true);
        try {
            const response = await fetch(material.audioUrl);
            const arrayBuffer = await response.arrayBuffer();
            const decodedBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
            setFullOriginalBuffer(decodedBuffer);
        } catch (error) {
            console.error("Failed to load full audio for visualization:", error);
            // This is expected for some CORS-restricted remote files in Mock mode
        }
        setIsLoadingAudio(false);
    };

    if (material.audioUrl) {
        loadAudio();
    }
  }, [material.audioUrl]);

  // --- Extract Active Segment Buffer ---
  useEffect(() => {
    if (!fullOriginalBuffer || activeIndex === -1 || !audioContextRef.current) {
        setActiveSegmentBuffer(null);
        return;
    }

    const segment = material.segments[activeIndex];
    const sampleRate = fullOriginalBuffer.sampleRate;
    const startSample = Math.floor(segment.startTime * sampleRate);
    const endSample = Math.floor(segment.endTime * sampleRate);
    const length = endSample - startSample;

    if (length <= 0 || startSample >= fullOriginalBuffer.length) {
        setActiveSegmentBuffer(null);
        return;
    }

    // Create a new buffer for just this segment
    const segmentBuffer = audioContextRef.current.createBuffer(
        fullOriginalBuffer.numberOfChannels,
        length,
        sampleRate
    );

    // Copy channel data
    for (let i = 0; i < fullOriginalBuffer.numberOfChannels; i++) {
        const chanData = fullOriginalBuffer.getChannelData(i);
        const segmentData = segmentBuffer.getChannelData(i);
        // Copy the slice
        // Using subarray is faster but creating a new buffer ensures clean separation
        const slice = chanData.subarray(startSample, endSample);
        segmentData.set(slice);
    }

    setActiveSegmentBuffer(segmentBuffer);
  }, [activeIndex, fullOriginalBuffer, material.segments]);

  // --- Update Active User Buffer ---
  useEffect(() => {
      if (activeIndex !== -1) {
          const segId = material.segments[activeIndex].id;
          setActiveUserBuffer(userBuffers[segId] || null);
      } else {
          setActiveUserBuffer(null);
      }
  }, [activeIndex, userBuffers, material.segments]);

  useEffect(() => {
    setActiveIndex(-1);
    setCurrentTime(0);
    setIsPlaying(false);
    setUserRecordings({});
    setUserBuffers({});
    segmentRefs.current = segmentRefs.current.slice(0, material.segments.length);
    if (!material.audioUrl) {
        const lastSeg = material.segments[material.segments.length - 1];
        setDuration(lastSeg ? lastSeg.endTime : 60);
    }
  }, [material]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (!material.audioUrl || !audioRef.current) return;

          if (e.code === 'ArrowLeft') {
              const newTime = Math.max(0, audioRef.current.currentTime - 3);
              audioRef.current.currentTime = newTime;
              setCurrentTime(newTime);
          }
          
          if (e.code === 'ArrowRight') {
              const newTime = Math.min(audioRef.current.duration || 1000, audioRef.current.currentTime + 3);
              audioRef.current.currentTime = newTime;
              setCurrentTime(newTime);
          }

           if (e.code === 'Space') {
              e.preventDefault(); 
              togglePlay();
           }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [material.audioUrl, isPlaying, sentenceMode, activeIndex]);


  // --- High Precision Loop for Sentence Mode ---
  useEffect(() => {
    if (isPlaying && sentenceMode && material.audioUrl) {
      const check = () => {
        if (audioRef.current) {
           const t = audioRef.current.currentTime;
           if (activeIndex !== -1) {
               const currentSeg = material.segments[activeIndex];
               // Stop slightly before the absolute end (50ms) to prevent bleeding into next segment
               // and ensure immediate "stop" feel.
               if (currentSeg && t >= currentSeg.endTime - 0.05) {
                   audioRef.current.pause();
                   // Clamp to just inside the segment to keep UI focus on current sentence
                   audioRef.current.currentTime = currentSeg.endTime - 0.01;
                   setIsPlaying(false);
                   return;
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
  }, [isPlaying, sentenceMode, activeIndex, material.audioUrl, material.segments]);

  // --- Audio Logic ---

  const startSimulation = (startTimeOffset: number) => {
    if (simulationRef.current) window.clearInterval(simulationRef.current);
    
    const startTimestamp = Date.now() - (startTimeOffset * 1000);
    
    simulationRef.current = window.setInterval(() => {
        const newTime = (Date.now() - startTimestamp) / 1000;
        
        if (sentenceMode) {
             const currentSeg = material.segments.find(s => newTime >= s.startTime && newTime <= s.endTime);
             if (currentSeg && newTime >= currentSeg.endTime) {
                 setIsPlaying(false);
                 setCurrentTime(currentSeg.startTime); 
                 if (simulationRef.current) window.clearInterval(simulationRef.current);
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

  const togglePlay = () => {
    if (material.audioUrl) {
      if (!audioRef.current) return;
      
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        if (sentenceMode && activeIndex !== -1) {
             const currentSeg = material.segments[activeIndex];
             // If we are at the very start, play.
             if (currentSeg && Math.abs(audioRef.current.currentTime - currentSeg.startTime) < 0.1) {
                 // OK
             } 
             // If we are at the end (paused from auto-pause), jump to next segment
             else if (currentSeg && audioRef.current.currentTime >= currentSeg.endTime - 0.1) {
                 const nextIndex = Math.min(activeIndex + 1, material.segments.length - 1);
                 const nextTime = material.segments[nextIndex].startTime;
                 audioRef.current.currentTime = nextTime;
             }
        }

        audioRef.current.crossOrigin = "anonymous";
        audioRef.current.play().catch(e => console.error("Playback failed", e));
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

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      setDuration(audioRef.current.duration);
    }
  };

  const skipToSegment = (direction: 'prev' | 'next') => {
      let targetIndex = activeIndex;
      
      if (direction === 'prev') {
          const currentSeg = material.segments[activeIndex];
          if (currentSeg && (currentTime - currentSeg.startTime > 1.5)) {
             targetIndex = activeIndex;
          } else {
             targetIndex = activeIndex - 1;
          }
      } else {
          targetIndex = activeIndex + 1;
      }

      if (targetIndex < 0) targetIndex = 0;
      if (targetIndex >= material.segments.length) targetIndex = material.segments.length - 1;

      const targetTime = material.segments[targetIndex]?.startTime ?? 0;
      setCurrentTime(targetTime);
      
      if (material.audioUrl) {
          if (audioRef.current) {
              audioRef.current.currentTime = targetTime;
              if (sentenceMode) {
                  audioRef.current.play();
                  setIsPlaying(true);
              }
          }
      } else {
          if (isPlaying) {
              startSimulation(targetTime);
          }
      }
  };

  const seekRelative = (seconds: number) => {
      if (audioRef.current) {
          const newTime = Math.max(0, Math.min(audioRef.current.duration, audioRef.current.currentTime + seconds));
          audioRef.current.currentTime = newTime;
          setCurrentTime(newTime);
      }
  };

  const replayCurrentSentence = () => {
      let targetTime = 0;
      if (activeIndex !== -1) {
          targetTime = material.segments[activeIndex].startTime;
      }
      
      setCurrentTime(targetTime);
      if (audioRef.current) {
          audioRef.current.currentTime = targetTime;
          audioRef.current.play();
          setIsPlaying(true);
      } else if (!material.audioUrl) {
          startSimulation(targetTime);
          setIsPlaying(true);
      }
  };

  const handleSegmentClick = (segment: Segment) => {
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

  // --- Scroll Sync ---
  useEffect(() => {
    const idx = material.segments.findIndex(
      (seg) => currentTime >= seg.startTime && currentTime < seg.endTime
    );
    if (idx !== -1 && idx !== activeIndex) {
      setActiveIndex(idx);
      if (segmentRefs.current[idx]) {
        segmentRefs.current[idx]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    } else if (idx === -1 && activeIndex === -1 && material.segments.length > 0) {
        setActiveIndex(0);
    }
  }, [currentTime, material.segments]);

  useEffect(() => {
    return () => {
      if (simulationRef.current) window.clearInterval(simulationRef.current);
      if (preciseCheckRef.current) cancelAnimationFrame(preciseCheckRef.current);
    };
  }, []);

  // --- Shadowing ---
  const toggleRecording = async () => {
    if (activeIndex === -1) return;

    if (isRecording) {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    } else {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const chunks: BlobPart[] = [];
            const mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const currentSegId = material.segments[activeIndex].id;
                setUserRecordings(prev => ({ ...prev, [currentSegId]: blob }));

                // Decode immediately for visualization
                if (audioContextRef.current) {
                    const arrayBuffer = await blob.arrayBuffer();
                    const audioBuf = await audioContextRef.current.decodeAudioData(arrayBuffer);
                    setUserBuffers(prev => ({ ...prev, [currentSegId]: audioBuf }));
                }

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

      // Stop main playback if active
      if (isPlaying) {
          togglePlay();
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = 1.0;
      audio.play().catch(e => console.error("User playback failed", e));
      audio.onended = () => URL.revokeObjectURL(url);
  };

  // --- Export ---
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
          a.download = `shadowing-${material.title.replace(/\s+/g, '-').toLowerCase()}.wav`;
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

  // --- View Helpers ---
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

  const getViewModeLabel = () => {
      if (viewMode === 'visible') return 'Full Text';
      if (viewMode === 'blur') return 'Blurred';
      return 'Blind Mode';
  };

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

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

      {/* Header */}
      <header className="flex-none px-6 py-6 flex items-center justify-between z-10">
        <button 
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center bg-zinc-800/50 hover:bg-zinc-700 text-white rounded-full transition-colors backdrop-blur-md"
        >
          <ArrowLeft size={20} />
        </button>
        
        <div className="flex gap-3">
             <button
                onClick={() => setSentenceMode(!sentenceMode)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                    sentenceMode 
                    ? 'bg-sky-500/20 border-sky-500/50 text-sky-400' 
                    : 'bg-zinc-800/50 border-zinc-700 text-zinc-400'
                }`}
             >
                <PauseOctagon size={14} className={sentenceMode ? "fill-current" : ""} />
                <span className="text-xs font-bold uppercase tracking-wider">Auto-Pause</span>
             </button>

            <div className="flex items-center space-x-2 bg-zinc-900/80 backdrop-blur-md rounded-full p-1 pr-4 border border-zinc-800">
                <button 
                    onClick={cycleViewMode}
                    className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-sky-400"
                >
                    {getViewModeIcon()}
                </button>
                <span className="text-xs font-medium text-zinc-300 uppercase tracking-wider hidden md:inline">{getViewModeLabel()}</span>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 relative no-scrollbar" ref={scrollContainerRef}>
        <div className="max-w-xl mx-auto space-y-12 pb-64 pt-4">
            <div className="text-center space-y-2">
                <span className="text-sky-500 text-xs font-bold uppercase tracking-widest">{material.category}</span>
                <h1 className="text-3xl font-serif font-bold text-white">{material.title}</h1>
            </div>
            
            <div className="space-y-8">
              {material.segments.map((seg, index) => {
                const isActive = index === activeIndex;
                
                return (
                  <div 
                    key={seg.id}
                    ref={(el) => (segmentRefs.current[index] = el)}
                    onClick={() => handleSegmentClick(seg)}
                    className={`transition-all duration-500 ease-out cursor-pointer hover:bg-white/5 p-4 -m-4 rounded-xl group ${
                      isActive ? 'opacity-100 transform scale-100 bg-white/5' : 'opacity-40 blur-[1px] hover:opacity-80 hover:blur-0'
                    }`}
                  >
                     <p className="text-2xl md:text-3xl font-serif leading-relaxed transition-all duration-500">
                        {seg.text.split(/(\s+)/).map((part, i) => {
                            if (viewMode === 'blind') {
                                return <span key={i} className="bg-zinc-800 text-zinc-800 rounded mx-0.5 select-none">{part}</span>;
                            }
                            if (viewMode === 'blur') {
                                return (
                                    <span 
                                        key={i} 
                                        className={`rounded px-0.5 transition-colors ${
                                            (viewMode === 'visible') ? 'text-zinc-200' : 'structure-blur'
                                        }`}
                                    >
                                        {part}
                                    </span>
                                );
                            }
                            return (
                                <span key={i} className="text-zinc-200 rounded px-0.5 inline-block">
                                    {part}
                                </span>
                            );
                        })}
                    </p>
                  </div>
                );
              })}
            </div>
        </div>
      </main>

      {/* Shadowing & Playback Controls */}
      <div className="flex-none bg-gradient-to-t from-black via-zinc-950 to-transparent pt-4 pb-8 px-6 z-20">
        <div className="max-w-xl mx-auto w-full space-y-4">
            
            {/* WAVEFORM COMPARISON */}
            <div className="bg-[#121214] border border-zinc-800 rounded-2xl p-3 space-y-2 shadow-2xl relative">
                <button 
                    onClick={handleExport}
                    disabled={isExporting}
                    className="absolute right-3 top-3 z-30 p-2 bg-black/50 hover:bg-sky-500/20 text-zinc-400 hover:text-sky-400 rounded-lg transition-colors"
                    title="Export recorded audio"
                >
                    <Download size={16} />
                </button>

                {/* Original Row */}
                <div className="h-12 w-full relative bg-black/20 rounded-lg overflow-hidden flex items-center">
                    <div className="absolute left-2 top-0 bottom-0 flex items-center z-10 pointer-events-none">
                        <span className="text-[10px] font-bold uppercase text-sky-500/80 bg-sky-950/30 px-1.5 py-0.5 rounded">Original</span>
                    </div>
                    {isLoadingAudio ? (
                        <div className="w-full flex justify-center text-xs text-zinc-600 animate-pulse">Analyzing...</div>
                    ) : (
                        <StaticWaveform audioBuffer={activeSegmentBuffer} color="#0ea5e9" height={48} />
                    )}
                </div>

                {/* User Row */}
                <div className="h-12 w-full relative bg-black/20 rounded-lg overflow-hidden flex items-center">
                    <div className="absolute left-2 top-0 bottom-0 flex items-center z-20 gap-2">
                        <span className="text-[10px] font-bold uppercase text-red-500/80 bg-red-950/30 px-1.5 py-0.5 rounded select-none">You</span>
                        {/* Play Button */}
                        {userRecordings[material.segments[activeIndex]?.id] && (
                            <button
                                onClick={playUserRecording}
                                className="p-1.5 bg-red-900/30 hover:bg-red-500 text-red-400 hover:text-white rounded-md transition-colors flex items-center justify-center"
                                title="Listen to your recording"
                            >
                                <Play size={10} fill="currentColor" />
                            </button>
                        )}
                    </div>
                    {isRecording ? (
                        <div className="w-full flex items-center justify-center gap-2 text-red-500 animate-pulse text-xs font-medium">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            Recording...
                        </div>
                    ) : (
                        <StaticWaveform audioBuffer={activeUserBuffer} color="#ef4444" height={48} />
                    )}
                </div>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between gap-4">
                
                {/* Replay Current */}
                <button 
                    onClick={replayCurrentSentence}
                    className="p-3 rounded-full text-zinc-500 hover:bg-white/10 hover:text-white transition-colors"
                    title="Replay Current Sentence"
                >
                    <RotateCcw size={22} />
                </button>

                {/* Center Controls */}
                <div className="flex items-center gap-2 md:gap-4">
                    <button 
                        onClick={() => skipToSegment('prev')}
                        className="p-3 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <SkipBack size={26} />
                    </button>

                    <button 
                        onClick={() => seekRelative(-3)}
                        className="p-2 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <button 
                        onClick={togglePlay}
                        className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl bg-white text-black shadow-white/10"
                    >
                        {isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-1" />}
                    </button>

                    <button 
                        onClick={() => seekRelative(3)}
                        className="p-2 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <ChevronRight size={20} />
                    </button>

                    <button 
                        onClick={() => skipToSegment('next')}
                        className="p-3 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <SkipForward size={26} />
                    </button>
                </div>

                {/* Record Button */}
                <button 
                    onClick={toggleRecording}
                    disabled={activeIndex === -1}
                    className={`p-3 rounded-full transition-all duration-300 ${
                        isRecording 
                        ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30' 
                        : 'text-zinc-500 hover:bg-white/10 hover:text-white'
                    }`}
                >
                    {isRecording ? <Square size={22} fill="currentColor" /> : <Mic size={22} />}
                </button>
            </div>
            
            {/* Progress Bar */}
            <div className="flex items-center space-x-3 text-xs font-mono text-zinc-600 pb-2">
                <span>{formatTime(currentTime)}</span>
                <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-white rounded-full transition-all duration-200" 
                        style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                    />
                </div>
                <span>{formatTime(duration)}</span>
            </div>
        </div>
      </div>

    </div>
  );
};
