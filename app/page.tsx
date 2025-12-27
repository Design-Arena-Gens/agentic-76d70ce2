import ImagePromptGenerator from '@/components/ImagePromptGenerator';

export default function HomePage() {
  return (
    <main className="relative">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/20 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-20 -right-24 w-80 h-80 bg-cyan-400/10 blur-[100px]" />
      </div>
      <ImagePromptGenerator />
    </main>
  );
}
