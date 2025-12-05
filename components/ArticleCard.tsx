import React from 'react';
import { Play, Clock, BarChart } from 'lucide-react';
import { Material } from '../types';

interface ArticleCardProps {
  material: Material;
  onClick: (material: Material) => void;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ material, onClick }) => {
  return (
    <div 
      onClick={() => onClick(material)}
      className="group relative w-full h-[480px] md:h-[550px] rounded-[32px] overflow-hidden cursor-pointer transform transition-all duration-500 hover:scale-[1.01] active:scale-[0.99] shadow-2xl shadow-black/50"
    >
      {/* Background Image */}
      <img 
        src={material.imageUrl} 
        alt={material.title} 
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />
      
      {/* Content */}
      <div className="absolute inset-0 p-8 flex flex-col justify-between text-white">
        
        {/* Top Meta */}
        <div className="flex items-start justify-between opacity-80 group-hover:opacity-100 transition-opacity">
           <span className="uppercase tracking-widest text-xs font-bold bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
              {material.category}
           </span>
        </div>

        {/* Bottom Info */}
        <div className="space-y-4 w-full transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
          <div className="space-y-2">
            <p className="text-zinc-400 text-sm font-medium uppercase tracking-wider">
              {material.difficulty} • {material.duration}
            </p>
            <h3 className="text-4xl md:text-5xl font-bold font-serif leading-none tracking-tight text-white group-hover:text-sky-200 transition-colors shadow-sm">
              {material.title}
            </h3>
          </div>
          
          <p className="text-base text-zinc-300 line-clamp-3 max-w-md leading-relaxed">
            {material.description}
          </p>

          <div className="pt-4 flex items-center text-sm font-semibold text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
             <span className="flex items-center bg-white/10 backdrop-blur-md px-4 py-2 rounded-full hover:bg-white/20 transition-colors">
               <Play fill="currentColor" className="w-4 h-4 mr-2" />
               Start Session
             </span>
          </div>
        </div>
      </div>
    </div>
  );
};