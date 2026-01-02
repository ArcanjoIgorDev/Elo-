import React, { useEffect, useState } from 'react';
import { fetchEcoData } from '../services/dataService';
import { EcoData, AppScreen } from '../types';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, Fingerprint, Eye } from 'lucide-react';

const EcoScreen: React.FC = () => {
  const [data, setData] = useState<EcoData | null>(null);

  useEffect(() => {
    fetchEcoData().then(setData);
  }, []);

  if (!data) return <div className="flex items-center justify-center h-full text-zinc-500">Carregando Eco...</div>;

  return (
    <div className="pb-24 pt-8 px-6">
       <header className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Eco</h1>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1 font-medium">Sua ressonância digital</p>
      </header>

      {/* Big Number Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
                <Fingerprint size={60} />
            </div>
            <p className="text-zinc-500 text-xs font-medium mb-1 flex items-center gap-1">
                <Fingerprint size={12} />
                Marcas
            </p>
            <p className="text-3xl font-bold text-zinc-100">{data.totalMarks}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-3 opacity-10">
                <TrendingUp size={60} />
            </div>
            <p className="text-zinc-500 text-xs font-medium mb-1 flex items-center gap-1">
                <TrendingUp size={12} />
                Engajamento
            </p>
            <p className="text-3xl font-bold text-emerald-400">{data.engagementScore}%</p>
        </div>
      </div>

      {/* Chart Section */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <Eye size={16} className="text-indigo-400"/>
                Visualizações no Rastro
            </h3>
            <span className="text-[10px] bg-zinc-800 px-2 py-1 rounded-full text-zinc-400">7 Dias</span>
        </div>
        
        <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.pulseViews}>
                    <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#52525b', fontSize: 10}} 
                        dy={10}
                    />
                    <Tooltip 
                        cursor={{fill: '#27272a'}}
                        contentStyle={{backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px'}}
                        itemStyle={{color: '#e4e4e7'}}
                    />
                    <Bar dataKey="views" radius={[4, 4, 4, 4]}>
                        {data.pulseViews.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === data.pulseViews.length -1 ? '#e4e4e7' : '#3f3f46'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
      </section>

      <div className="text-center mt-12">
          <p className="text-[10px] text-zinc-600 max-w-[200px] mx-auto leading-relaxed">
              O ELO não usa algoritmos de vício. 
              Seus dados mostram conexões reais, não vaidade.
          </p>
      </div>
    </div>
  );
};

export default EcoScreen;