import React, { useState } from 'react';
import { Sparkles, Headphones, Loader2, Upload } from 'lucide-react';
import { MOCK_MATERIALS } from './constants';
import { Material } from './types';
import { ArticleCard } from './components/ArticleCard';
import { BlurReader } from './components/BlurReader';
import { generateMaterial } from './services/geminiService';
import { ImportWizard } from './components/ImportWizard';

export default function App() {
  const [activeMaterial, setActiveMaterial] = useState<Material | null>(null);
  const [materials, setMaterials] = useState<Material[]>(MOCK_MATERIALS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [showImport, setShowImport] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    const newMaterial = await generateMaterial(prompt);
    if (newMaterial) {
      setMaterials([newMaterial, ...materials]);
      setPrompt('');
    }
    setIsGenerating(false);
  };

  const handleImport = (material: Material) => {
    setMaterials([material, ...materials]);
    setShowImport(false);
    // Optional: Immediately open the new material
    // setActiveMaterial(material); 
  };

  if (activeMaterial) {
    return <BlurReader material={activeMaterial} onBack={() => setActiveMaterial(null)} />;
  }

  return (
    <div className="min-h-screen bg-[#000000] text-zinc-100 selection:bg-sky-500/30 pb-20">
      
      {/* Immersive Header (App Store style) */}
      <header className="pt-16 pb-8 px-6 max-w-lg mx-auto md:max-w-2xl lg:max-w-3xl">
        <div className="flex items-center justify-between mb-2">
            <span className="text-zinc-500 text-sm font-semibold uppercase tracking-widest">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
            <div className="flex gap-4">
               {/* Import Button */}
               <button 
                 onClick={() => setShowImport(true)}
                 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-500 hover:text-sky-400 transition-colors"
               >
                 <Upload size={14} />
                 Import
               </button>
               <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                    <Headphones size={16} className="text-sky-500" />
               </div>
            </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-8">
            Today
        </h1>

        {/* Generator Mini-Form */}
        <form onSubmit={handleGenerate} className="relative group mb-12">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-600 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
            <div className="relative flex items-center bg-[#1c1c1e] rounded-2xl p-2 pr-2 border border-white/5 shadow-2xl">
            <Sparkles className="ml-3 text-sky-500 animate-pulse flex-shrink-0" size={20} />
            <input 
                type="text" 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Generate new topic..." 
                className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-zinc-500 px-4 py-2 text-lg"
            />
            <button 
                type="submit"
                disabled={isGenerating || !prompt}
                className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isGenerating ? <Loader2 size={20} className="animate-spin" /> : "Go"}
            </button>
            </div>
        </form>
      </header>

      <main className="px-6 max-w-lg mx-auto md:max-w-2xl lg:max-w-3xl space-y-12">
        {/* Big Card Flow - Vertical Stack */}
        <section className="space-y-12">
          {materials.map((material) => (
            <div key={material.id} className="transform transition-transform hover:scale-[1.02]">
                <ArticleCard 
                    material={material} 
                    onClick={setActiveMaterial} 
                />
            </div>
          ))}
        </section>
      </main>

      {/* Import Modal */}
      {showImport && (
        <ImportWizard 
          onClose={() => setShowImport(false)} 
          onImport={handleImport}
        />
      )}
    </div>
  );
}
