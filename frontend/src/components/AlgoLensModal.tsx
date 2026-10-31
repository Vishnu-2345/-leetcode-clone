import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { api } from '../lib/axios';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  Terminal,
  Activity,
  AlertCircle,
  RotateCcw,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface VisualizerStep {
  step: number;
  line: number;
  event: 'line' | 'call' | 'return';
  function: string;
  variables: Record<string, any>;
  callStack: Array<{ function: string; line: number }>;
  stdout?: string;
  returnVal?: any;
}

interface VisualizerData {
  traceId: string;
  status: 'Success' | 'Error' | 'Compile Error';
  error?: string | null;
  result?: any;
  totalSteps: number;
  steps: VisualizerStep[];
  detectedArrays: string[];
  detectedPointers: string[];
  truncated: boolean;
}

interface AlgoLensModalProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  language: string;
  defaultInput: string;
}

export function AlgoLensModal({
  isOpen,
  onClose,
  code,
  language,
  defaultInput,
}: AlgoLensModalProps) {
  const [inputVal, setInputVal] = useState(defaultInput);
  const [isLoading, setIsLoading] = useState(false);
  const [traceData, setTraceData] = useState<VisualizerData | null>(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1000); // ms per step
  const [activeTab, setActiveTab] = useState<'visual' | 'variables' | 'stack' | 'stdout'>('visual');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const activeLineRef = useRef<HTMLDivElement | null>(null);

  // Fetch or re-generate trace
  const runVisualizer = useCallback(async (customInputStr?: string) => {
    setIsLoading(true);
    setIsPlaying(false);
    setCurrentStepIdx(0);
    try {
      const response = await api.post('/submissions/visualize', {
        code,
        language,
        input: customInputStr !== undefined ? customInputStr : inputVal,
      });

      if (response.data.status === 'success') {
        setTraceData(response.data.data);
      } else if (response.data.status === 'pending') {
        // Poll once after 1s
        const traceId = response.data.data?.traceId;
        setTimeout(async () => {
          const pollRes = await api.get(`/submissions/visualize/${traceId}`);
          if (pollRes.data.status === 'success') {
            setTraceData(pollRes.data.data);
          }
        }, 1200);
      }
    } catch (err: any) {
      setTraceData({
        traceId: 'err',
        status: 'Error',
        error: err.response?.data?.message || err.message || 'Failed to generate execution trace',
        totalSteps: 0,
        steps: [],
        detectedArrays: [],
        detectedPointers: [],
        truncated: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, [code, language, inputVal]);

  // Trigger trace on open
  useEffect(() => {
    if (isOpen) {
      setInputVal(defaultInput);
      runVisualizer(defaultInput);
    } else {
      setIsPlaying(false);
      setTraceData(null);
    }
  }, [isOpen, defaultInput, runVisualizer]);

  const steps = traceData?.steps || [];
  const totalSteps = steps.length;
  const currentStep: VisualizerStep | undefined = steps[currentStepIdx];

  // Auto-scroll active line into view smoothly
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentStepIdx]);

  // Auto-play timer
  useEffect(() => {
    let timer: any = null;
    if (isPlaying && totalSteps > 0) {
      timer = setInterval(() => {
        setCurrentStepIdx((prev) => {
          if (prev >= totalSteps - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, playbackSpeed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, totalSteps, playbackSpeed]);

  // Keyboard navigation (Left = Prev, Right = Next, Space = Play/Pause)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentStepIdx((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentStepIdx((prev) => Math.min(totalSteps - 1, prev + 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, totalSteps]);

  // Code split into lines for rendered viewer
  const codeLines = useMemo(() => {
    return code.split('\n');
  }, [code]);

  // Pointers active in current step
  const activePointersByArray = useMemo(() => {
    if (!currentStep) return new Map<string, Array<{ pointerName: string; index: number }>>();

    const map = new Map<string, Array<{ pointerName: string; index: number }>>();
    const arrays: Record<string, any[]> = {};
    const numbers: Record<string, number> = {};

    Object.entries(currentStep.variables).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        arrays[k] = v;
        map.set(k, []);
      } else if (typeof v === 'number' && Number.isInteger(v)) {
        numbers[k] = v;
      }
    });

    // Match pointers to arrays where index is within bounds [0, array.length - 1]
    Object.entries(arrays).forEach(([arrName, arrVal]) => {
      const matchedPointers: Array<{ pointerName: string; index: number }> = [];
      Object.entries(numbers).forEach(([ptrName, ptrVal]) => {
        if (ptrVal >= 0 && ptrVal < arrVal.length) {
          // Heuristic: pointer name matches common conventions or matches array length
          const lower = ptrName.toLowerCase();
          if (
            ['i', 'j', 'k', 'l', 'r', 'left', 'right', 'low', 'high', 'mid', 'start', 'end', 'p1', 'p2', 'idx', 'ptr', 'curr'].some(
              (candidate) => lower.includes(candidate)
            ) ||
            Object.keys(arrays).length === 1
          ) {
            matchedPointers.push({ pointerName: ptrName, index: ptrVal });
          }
        }
      });
      map.set(arrName, matchedPointers);
    });

    return map;
  }, [currentStep]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      <div
        className={`flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
          isFullscreen
            ? 'w-full h-full rounded-none'
            : 'w-full max-w-6xl max-h-[92vh] h-[850px]'
        }`}
      >
        {/* 1. TOP HEADER & TOOLBAR */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-850 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">AlgoLens</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Interactive Execution Trace
                </span>
                {traceData?.truncated && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    Max 150 Steps
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Step-by-step visual debugger & memory inspector
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. TEST CASE INPUT STRIP */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-slate-900 border-b border-slate-800/80 text-xs flex-shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
              Input:
            </span>
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder='e.g. nums = [2, 7, 11, 15], target = 9'
              className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500 transition"
            />
            <button
              onClick={() => runVisualizer()}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs shadow transition"
            >
              <RotateCcw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Tracing...' : 'Trace Input'}</span>
            </button>
          </div>

          {/* Stepper Controls */}
          {totalSteps > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                <button
                  onClick={() => setCurrentStepIdx(0)}
                  disabled={currentStepIdx === 0}
                  className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded transition"
                  title="First Step (Home)"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCurrentStepIdx((p) => Math.max(0, p - 1))}
                  disabled={currentStepIdx === 0}
                  className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded transition"
                  title="Previous Step (Left Arrow)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold text-xs flex items-center gap-1 transition shadow"
                  title="Play / Pause (Spacebar)"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3 h-3" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" /> Play
                    </>
                  )}
                </button>
                <button
                  onClick={() => setCurrentStepIdx((p) => Math.min(totalSteps - 1, p + 1))}
                  disabled={currentStepIdx === totalSteps - 1}
                  className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded transition"
                  title="Next Step (Right Arrow)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentStepIdx(totalSteps - 1)}
                  disabled={currentStepIdx === totalSteps - 1}
                  className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded transition"
                  title="Last Step (End)"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Step Pill */}
              <div className="font-mono text-xs px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-semibold">
                Step {currentStepIdx + 1} / {totalSteps}
              </div>

              {/* Speed Toggle */}
              <div className="flex bg-slate-950 border border-slate-800 rounded p-0.5 text-[10px]">
                <button
                  onClick={() => setPlaybackSpeed(1500)}
                  className={`px-1.5 py-0.5 rounded ${
                    playbackSpeed === 1500 ? 'bg-cyan-600 text-white' : 'text-slate-400'
                  }`}
                >
                  0.5x
                </button>
                <button
                  onClick={() => setPlaybackSpeed(800)}
                  className={`px-1.5 py-0.5 rounded ${
                    playbackSpeed === 800 ? 'bg-cyan-600 text-white' : 'text-slate-400'
                  }`}
                >
                  1x
                </button>
                <button
                  onClick={() => setPlaybackSpeed(400)}
                  className={`px-1.5 py-0.5 rounded ${
                    playbackSpeed === 400 ? 'bg-cyan-600 text-white' : 'text-slate-400'
                  }`}
                >
                  2x
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. STEP PROGRESS SCRUBBER BAR */}
        {totalSteps > 1 && (
          <div className="px-5 py-2 bg-slate-850 border-b border-slate-800 flex items-center gap-3 flex-shrink-0">
            <span className="text-[10px] font-mono text-slate-500">1</span>
            <input
              type="range"
              min={0}
              max={totalSteps - 1}
              value={currentStepIdx}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentStepIdx(Number(e.target.value));
              }}
              className="flex-1 accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] font-mono text-slate-500">{totalSteps}</span>
          </div>
        )}

        {/* 4. MAIN BODY (SPLIT CODE vs INSPECTOR) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
          {/* LEFT: CODE VIEWER (5 cols) */}
          <div className="lg:col-span-5 flex flex-col border-r border-slate-800 bg-slate-950 min-h-0">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                Source Code
              </span>
              {currentStep && (
                <span className="text-[11px] font-mono text-cyan-400">
                  Executing: {currentStep.function}() : line {currentStep.line}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto font-mono text-xs p-2 leading-relaxed">
              {codeLines.map((lineText, idx) => {
                const lineNum = idx + 1;
                const isCurrent = currentStep?.line === lineNum;
                return (
                  <div
                    key={idx}
                    ref={isCurrent ? activeLineRef : null}
                    className={`flex items-start px-2 py-0.5 rounded transition-all duration-150 ${
                      isCurrent
                        ? 'bg-cyan-950/70 border-l-4 border-cyan-400 text-white font-semibold shadow-inner'
                        : 'text-slate-400 hover:bg-slate-900/50'
                    }`}
                  >
                    <span
                      className={`w-7 text-right select-none pr-3 text-[11px] font-mono ${
                        isCurrent ? 'text-cyan-400 font-bold' : 'text-slate-600'
                      }`}
                    >
                      {lineNum}
                    </span>
                    <span className="flex-1 whitespace-pre overflow-x-auto">
                      {isCurrent && <span className="text-cyan-400 font-black mr-1.5">➜</span>}
                      {lineText}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Return value banner */}
            {currentStep?.event === 'return' && (
              <div className="p-3 bg-emerald-950/80 border-t border-emerald-800/80 text-emerald-300 text-xs flex items-center justify-between font-mono">
                <span className="font-bold flex items-center gap-1.5">
                  <span className="text-emerald-400">✓</span> Function Return Value:
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-900 text-emerald-100 font-bold">
                  {JSON.stringify(currentStep.returnVal)}
                </span>
              </div>
            )}
          </div>

          {/* RIGHT: DYNAMIC STATE & MEMORY INSPECTOR (7 cols) */}
          <div className="lg:col-span-7 flex flex-col bg-slate-900 min-h-0">
            {/* Inspector Navigation Tabs */}
            <div className="flex items-center justify-between px-4 bg-slate-850 border-b border-slate-800">
              <div className="flex space-x-1">
                <button
                  onClick={() => setActiveTab('visual')}
                  className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
                    activeTab === 'visual'
                      ? 'border-cyan-400 text-white'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Visual Array & Pointers</span>
                </button>
                <button
                  onClick={() => setActiveTab('variables')}
                  className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
                    activeTab === 'variables'
                      ? 'border-cyan-400 text-white'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Scope Variables</span>
                </button>
                <button
                  onClick={() => setActiveTab('stack')}
                  className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
                    activeTab === 'stack'
                      ? 'border-cyan-400 text-white'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-yellow-400" />
                  <span>Call Stack ({currentStep?.callStack?.length || 1})</span>
                </button>
                <button
                  onClick={() => setActiveTab('stdout')}
                  className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
                    activeTab === 'stdout'
                      ? 'border-cyan-400 text-white'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Stdout Console</span>
                </button>
              </div>

              {currentStep && (
                <span className="text-[11px] text-slate-400 font-mono">
                  Event: <strong className="text-cyan-400">{currentStep.event}</strong>
                </span>
              )}
            </div>

            {/* TAB CONTENTS */}
            <div className="flex-1 p-5 overflow-y-auto space-y-6">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <div className="text-slate-400 text-xs">Simulating line-by-line execution...</div>
                </div>
              ) : traceData?.status === 'Error' || traceData?.status === 'Compile Error' ? (
                <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                  <div className="flex items-center gap-2 font-bold mb-1 text-sm text-rose-400">
                    <AlertCircle className="w-4 h-4" />
                    {traceData.status}: Execution Failed
                  </div>
                  <pre className="mt-2 p-3 bg-slate-950 rounded font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {traceData.error}
                  </pre>
                </div>
              ) : !currentStep ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                  No trace steps available. Check your code syntax or click Trace Input.
                </div>
              ) : (
                <>
                  {/* TAB 1: VISUAL ARRAY & POINTER RADAR */}
                  {activeTab === 'visual' && (
                    <div className="space-y-6">
                      {/* Check if any arrays exist */}
                      {Array.from(activePointersByArray.entries()).length === 0 ? (
                        <div className="p-6 text-center bg-slate-950/60 rounded-xl border border-dashed border-slate-800 text-slate-400 text-xs">
                          No array structures detected in current scope. Variables are displayed in the Scope Variables tab.
                        </div>
                      ) : (
                        Array.from(activePointersByArray.entries()).map(([arrName, pointers]) => {
                          const arrVal: any[] = currentStep.variables[arrName] || [];
                          return (
                            <div
                              key={arrName}
                              className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 shadow-lg"
                            >
                              <div className="flex items-center justify-between mb-4">
                                <span className="font-mono font-bold text-white text-sm flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                                  {arrName}
                                  <span className="text-xs font-normal text-slate-400">
                                    (Array[{arrVal.length}])
                                  </span>
                                </span>
                                {pointers.length > 0 && (
                                  <div className="flex gap-2">
                                    {pointers.map((p, idx) => (
                                      <span
                                        key={idx}
                                        className="text-[11px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono font-semibold"
                                      >
                                        {p.pointerName} = {p.index}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Array Blocks */}
                              <div className="overflow-x-auto pb-4 pt-8">
                                <div className="inline-flex gap-2 min-w-full">
                                  {arrVal.map((item, idx) => {
                                    const matchingPointers = pointers.filter((p) => p.index === idx);
                                    const hasPointer = matchingPointers.length > 0;

                                    return (
                                      <div key={idx} className="relative flex flex-col items-center">
                                        {/* Pointer Arrow and Badge */}
                                        {hasPointer && (
                                          <div className="absolute -top-7 flex flex-col items-center animate-bounce">
                                            <span className="px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950 font-black text-[10px] shadow">
                                              {matchingPointers.map((p) => p.pointerName).join(', ')}
                                            </span>
                                            <span className="text-cyan-400 text-xs leading-none">▼</span>
                                          </div>
                                        )}

                                        {/* Array Cell */}
                                        <div
                                          className={`w-14 h-14 rounded-lg flex items-center justify-center font-mono font-bold text-sm transition-all duration-200 border shadow-inner ${
                                            hasPointer
                                              ? 'bg-gradient-to-br from-cyan-600 to-blue-700 text-white border-cyan-300 scale-105 shadow-cyan-500/30'
                                              : 'bg-slate-900 text-slate-200 border-slate-700'
                                          }`}
                                        >
                                          {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                                        </div>

                                        {/* Array Index */}
                                        <span className="mt-1 text-[10px] font-mono text-slate-500">
                                          [{idx}]
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}

                      {/* Quick Scalars & Hash Maps Summary below */}
                      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                          Active Primitives & Hash Tables
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {Object.entries(currentStep.variables)
                            .filter(([_, v]) => !Array.isArray(v))
                            .map(([k, v]) => (
                              <div
                                key={k}
                                className="bg-slate-900 rounded-lg p-2.5 border border-slate-800 text-xs"
                              >
                                <div className="text-slate-400 font-mono text-[11px] truncate">{k}</div>
                                <div className="text-white font-mono font-bold mt-0.5 truncate">
                                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: VARIABLES TABLE */}
                  {activeTab === 'variables' && (
                    <div className="space-y-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="pb-2 font-semibold">Variable</th>
                              <th className="pb-2 font-semibold">Type</th>
                              <th className="pb-2 font-semibold">Current Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {Object.entries(currentStep.variables).map(([k, v]) => {
                              const typeName = Array.isArray(v)
                                ? `Array[${v.length}]`
                                : typeof v === 'object' && v !== null
                                ? 'Dict / Object'
                                : typeof v;
                              return (
                                <tr key={k} className="hover:bg-slate-800/30">
                                  <td className="py-2.5 pr-4 text-cyan-300 font-bold">{k}</td>
                                  <td className="py-2.5 pr-4 text-slate-400 text-[11px]">{typeName}</td>
                                  <td className="py-2.5 text-white font-mono">
                                    {typeof v === 'object' ? (
                                      <pre className="bg-slate-950 p-2 rounded text-[11px] text-emerald-300 whitespace-pre-wrap">
                                        {JSON.stringify(v, null, 2)}
                                      </pre>
                                    ) : (
                                      String(v)
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: CALL STACK */}
                  {activeTab === 'stack' && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                        Call Stack Frames (Recursion Depth: {currentStep.callStack.length})
                      </h4>
                      {currentStep.callStack.map((frame, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border font-mono text-xs flex items-center justify-between ${
                            idx === 0
                              ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-slate-800 text-slate-400 flex items-center justify-center text-[10px]">
                              {currentStep.callStack.length - idx}
                            </span>
                            <span className="font-bold text-white">{frame.function}()</span>
                          </div>
                          <span className="text-[11px] text-cyan-400 font-semibold">
                            Line {frame.line}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TAB 4: STDOUT CONSOLE */}
                  {activeTab === 'stdout' && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                        Streamed Standard Output
                      </h4>
                      <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 min-h-[140px] whitespace-pre-wrap">
                        {currentStep.stdout || '(No print output generated up to this step)'}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

