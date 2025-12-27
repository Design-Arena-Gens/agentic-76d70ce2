'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeImageData, type ImageInsights } from '@/lib/imageAnalysis';
import { buildPromptSet, type PromptSet } from '@/lib/promptGenerator';
import clsx from 'clsx';

interface GenerationResult {
  insights: ImageInsights;
  prompts: PromptSet;
  previewUrl: string;
  fileName: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to read file.'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
};

const createImageElement = (dataUrl: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image.'));
    image.src = dataUrl;
  });
};

const extractImageData = async (image: HTMLImageElement): Promise<ImageData> => {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create canvas context.');
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
};

const PromptCard = ({
  label,
  prompt,
  onCopy,
  copied
}: {
  label: string;
  prompt: string;
  onCopy: () => void;
  copied: boolean;
}) => (
  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3 transition hover:border-slate-700">
    <div className="flex items-center justify-between">
      <span className="text-sm uppercase tracking-widest text-slate-400">{label}</span>
      <button
        onClick={onCopy}
        className={clsx(
          'text-xs font-medium px-3 py-1 rounded-full transition',
          copied ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50' : 'bg-slate-800/70 text-slate-200 border border-slate-700'
        )}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
    <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
      {prompt}
    </p>
  </div>
);

const PaletteRow = ({ palette }: { palette: ImageInsights['palette'] }) => (
  <div className="flex gap-3 overflow-x-auto pb-1">
    {palette.map((color) => (
      <div
        key={color.hex}
        className="flex flex-col items-center min-w-[72px]"
      >
        <div
          className="w-12 h-12 rounded-lg border border-slate-700 shadow-inner"
          style={{ backgroundColor: color.hex }}
        />
        <span className="text-xs mt-2 text-slate-300 text-center leading-tight">
          {color.name}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-slate-500">
          {color.hex}
        </span>
      </div>
    ))}
  </div>
);

export default function ImagePromptGenerator() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<string>('');

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCopiedPrompt('');
    }, 2500);
    return () => clearTimeout(timeout);
  }, [copiedPrompt]);

  const handleFile = useCallback(
    async (file?: File) => {
      if (!file) return;

      setError(null);
      setIsProcessing(true);
      setCopiedPrompt('');

      try {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          throw new Error('Please upload a JPG, PNG, or WebP image.');
        }
        if (file.size > MAX_FILE_SIZE) {
          throw new Error('Image should be under 10 MB for fast analysis.');
        }

        const dataUrl = await readFileAsDataUrl(file);
        const image = await createImageElement(dataUrl);
        const imageData = await extractImageData(image);

        const insights = analyzeImageData(imageData);
        const prompts = buildPromptSet(insights);

        setResult({
          insights,
          prompts,
          previewUrl: dataUrl,
          fileName: file.name
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        setError(message);
        setResult(null);
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (event.dataTransfer.files?.length) {
        void handleFile(event.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  const onBrowse = () => {
    fileInputRef.current?.click();
  };

  const onCopyPrompt = async (prompt: string) => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(prompt);
    } catch (err) {
      console.error('Clipboard error', err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-16 px-4 sm:px-6 lg:px-0 space-y-12">
      <header className="space-y-4 text-center">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-400 bg-slate-900/70 px-4 py-2 rounded-full border border-slate-800">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          Generative prompt engineer
        </span>
        <h1 className="text-4xl sm:text-5xl font-semibold text-white">
          Convert any image into production-ready prompts
        </h1>
        <p className="max-w-2xl mx-auto text-slate-300">
          Drop a reference image to extract color palettes, lighting cues, and cinematic language. Instantly generate AI-friendly prompts tailored for base renders, cinematic shots, and concept art variants.
        </p>
      </header>

      <section className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-blue-500/5">
        <label
          className={clsx(
            'flex flex-col items-center justify-center border-2 border-dashed rounded-2xl py-16 px-6 text-center transition',
            isDragging ? 'border-blue-400 bg-blue-400/10' : 'border-slate-700 hover:border-slate-500'
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="w-10 h-10 text-blue-300"
              >
                <path d="M12 5v14m0-14 5 5m-5-5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20 12.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-slate-100">Drop image or browse</p>
              <p className="text-sm text-slate-400">Supports JPG, PNG, WebP up to 10 MB</p>
            </div>
            <button
              type="button"
              onClick={onBrowse}
              className="px-4 py-2 rounded-full bg-blue-500/80 hover:bg-blue-500 text-white text-sm font-medium transition"
            >
              Browse files
            </button>
          </div>
        </label>
        {error && (
          <p className="mt-4 text-sm text-rose-400 text-center bg-rose-400/10 border border-rose-400/40 rounded-xl py-3">
            {error}
          </p>
        )}
        {isProcessing && (
          <div className="mt-6 flex items-center justify-center gap-3 text-sm text-slate-300">
            <span className="w-3 h-3 rounded-full bg-blue-400 animate-ping" />
            Analysing visual patterns...
          </div>
        )}
      </section>

      {result && (
        <section className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-10">
          <div className="space-y-6">
            <PromptCard
              label="Base prompt"
              prompt={result.prompts.basePrompt}
              copied={copiedPrompt === result.prompts.basePrompt}
              onCopy={() => onCopyPrompt(result.prompts.basePrompt)}
            />
            <PromptCard
              label="Cinematic"
              prompt={result.prompts.cinematicPrompt}
              copied={copiedPrompt === result.prompts.cinematicPrompt}
              onCopy={() => onCopyPrompt(result.prompts.cinematicPrompt)}
            />
            <PromptCard
              label="Concept art"
              prompt={result.prompts.artisticPrompt}
              copied={copiedPrompt === result.prompts.artisticPrompt}
              onCopy={() => onCopyPrompt(result.prompts.artisticPrompt)}
            />
          </div>

          <aside className="space-y-6">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="relative aspect-[4/3] bg-slate-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.previewUrl}
                  alt={result.fileName}
                  className="object-contain w-full h-full"
                  loading="lazy"
                />
              </div>
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-100">Visual intelligence</h3>
                  <span className="text-xs text-slate-400 uppercase tracking-widest">{result.insights.aspectRatio}</span>
                </div>
                <PaletteRow palette={result.insights.palette} />
                <dl className="grid grid-cols-1 gap-2 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <dt className="uppercase tracking-wide text-slate-500">Lighting</dt>
                    <dd className="text-right max-w-[55%]">{result.insights.lighting}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="uppercase tracking-wide text-slate-500">Mood</dt>
                    <dd className="text-right max-w-[55%]">{result.insights.moods.join(', ') || 'balanced'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="uppercase tracking-wide text-slate-500">Texture</dt>
                    <dd className="text-right max-w-[55%]">{result.insights.texture}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="uppercase tracking-wide text-slate-500">Focus</dt>
                    <dd className="text-right max-w-[55%]">{result.insights.focalPoint}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="uppercase tracking-wide text-slate-500">Keywords</dt>
                    <dd className="text-right max-w-[55%]">{result.prompts.keywordList.join(', ')}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </aside>
        </section>
      )}

      <footer className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 space-y-6">
        <h2 className="text-lg font-semibold text-slate-100">Prompt crafting tips</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm text-slate-300">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2">
            <h3 className="text-slate-100 font-medium">Blend palettes</h3>
            <p>Combine the detected palette with your target art style for cohesive renders that respect the original reference.</p>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2">
            <h3 className="text-slate-100 font-medium">Dial the mood</h3>
            <p>Use the mood adjectives as anchor words, then adjust intensity with modifiers like cinematic, ethereal, or gritty.</p>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2">
            <h3 className="text-slate-100 font-medium">Iterate fast</h3>
            <p>Generate variants by swapping the concept art prompt modifiers while keeping the base structure intact.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
