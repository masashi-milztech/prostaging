
import React, { useRef, useState } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
        onFileSelect(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearFile = () => {
    setPreview(null);
    setFileName(null);
    onFileSelect(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-full">
      <div 
        className={`relative aspect-video max-h-[360px] transition-all duration-300 flex flex-col items-center justify-center rounded-[1.5rem] overflow-hidden group border-2 border-dashed ${
          preview ? 'border-black bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400 bg-white'
        }`}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          className="absolute inset-0 opacity-0 cursor-pointer z-20" 
          onChange={handleFileChange}
          accept="image/*"
        />

        {preview ? (
          <div className="absolute inset-0 w-full h-full">
            <img src={preview} alt="Preview" className="w-full h-full object-cover transition-all duration-700" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-30">
               <button 
                onClick={(e) => { e.preventDefault(); clearFile(); }}
                className="bg-white text-black px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transform transition-all duration-300 hover:scale-105"
              >
                Change Photo
              </button>
            </div>
            <div className="absolute bottom-6 left-6 right-6">
              <div className="bg-white px-4 py-3 rounded-xl flex items-center gap-3 border border-neutral-100 shadow-xl">
                 <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                 </div>
                 <p className="text-[10px] text-black font-black uppercase tracking-widest truncate">{fileName}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center p-12">
            <div className="mb-6 w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto transition-all group-hover:bg-neutral-100">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="text-sm font-black text-black uppercase tracking-[0.2em] mb-2">Select Canvas</h3>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest italic">RAW / JPG / PNG</p>
          </div>
        )}
      </div>
    </div>
  );
};
