
import React, { useRef } from 'react';
import { ReferenceImage } from '../types';

interface ReferenceImageUploadProps {
  references: ReferenceImage[];
  setReferences: React.Dispatch<React.SetStateAction<ReferenceImage[]>>;
}

export const ReferenceImageUpload: React.FC<ReferenceImageUploadProps> = ({ references, setReferences }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readFileAsDataURL = (file: File): Promise<ReferenceImage> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          id: Math.random().toString(36).substr(2, 9),
          dataUrl: reader.result as string,
          fileName: file.name,
          description: ''
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files) as File[];
    const newReferences = await Promise.all(fileList.map(file => readFileAsDataURL(file)));
    setReferences(prev => [...prev, ...newReferences]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeReference = (id: string) => {
    setReferences(prev => prev.filter(r => r.id !== id));
  };

  const updateDescription = (id: string, desc: string) => {
    setReferences(prev => prev.map(r => r.id === id ? { ...r, description: desc } : r));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between border-b border-neutral-100 pb-6">
        <div className="space-y-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-black">Aesthetic Cues</h4>
          <p className="text-[9px] font-bold text-neutral-300 uppercase tracking-widest italic">Reference imagery for visual alignment</p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-[9px] font-black uppercase tracking-[0.3em] bg-neutral-100 text-black px-6 py-2 rounded-full hover:bg-black hover:text-white transition-all"
        >
          Add References
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple
        accept="image/*"
      />

      {references.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {references.map((ref) => (
            <div 
              key={ref.id} 
              className="group space-y-3 animate-in fade-in zoom-in duration-300"
            >
              <div className="relative aspect-square rounded-xl overflow-hidden bg-neutral-50 border border-neutral-100">
                <img src={ref.dataUrl} className="w-full h-full object-cover transition-all" alt="Reference" />
                <button
                  onClick={() => removeReference(ref.id)}
                  className="absolute top-2 right-2 bg-white text-black p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-xl"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <input
                value={ref.description}
                onChange={(e) => updateDescription(ref.id, e.target.value)}
                placeholder="Style key..."
                className="w-full bg-transparent text-[8px] font-black uppercase tracking-widest text-center text-neutral-400 placeholder:text-neutral-200 focus:text-black outline-none transition-colors"
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
