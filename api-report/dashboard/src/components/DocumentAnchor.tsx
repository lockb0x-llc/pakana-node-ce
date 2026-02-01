import React, { useState } from 'react';
import { Shield, Link as LinkIcon, FileText, Send } from 'lucide-react';
import { Card } from './Card';

interface DocumentAnchorProps {
    className?: string;
}

export const DocumentAnchor: React.FC<DocumentAnchorProps> = ({ className }) => {
    const [url, setUrl] = useState('');
    const [providerId, setProviderId] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<'idle' | 'hashing' | 'saving' | 'ready' | 'error'>('idle');
    const [pointerHash, setPointerHash] = useState('');
    const [xdr, setXdr] = useState('');

    const TOKE_ISSUER = 'GCWGJWZVNLBSDXCRMWZMWZI2K6GQJABYPTNBLLYOZP4GNTQCKIHYYIEE';

    const generateAnchor = async () => {
        if (!url || !providerId || !description) return;
        
        setStatus('hashing');
        
        try {
            // 1. Calculate Pointer Hash (SHA-256 of ProviderID + URL)
            const data = new TextEncoder().encode(providerId + url);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            setPointerHash(hashHex);

            // 2. Save Draft to API
            setStatus('saving');
            const response = await fetch('/api/v1/lockb0x', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': 'pakana-local-dev' // TODO: Get from env or context
                },
                body: JSON.stringify({
                    pointer_hash: hashHex,
                    url,
                    provider: 'manual', 
                    description
                })
            });

            if (!response.ok) throw new Error('Failed to save draft');

            // 3. Generate XDR (Mock for now, normally use stellar-sdk)
            // We use a placeholder here because importing stellar-sdk might be heavy 
            // without a proper build step config. In a real app we'd use the SDK.
            // For now, we simulate the XDR generation message.
            setXdr(`(Mock XDR) Payment 0.0000001 XLM from ${TOKE_ISSUER} to Self with Memo Hash: ${hashHex}`);
            
            setStatus('ready');
        } catch (err) {
            console.error(err);
            setStatus('error');
        }
    };

    return (
        <Card 
            dataId="DocumentAnchor" 
            className={`border-emerald-500/30 bg-emerald-900/[0.05] ${className}`}
            description="Bridge Real World Assets to the Stellar Network via the Lockb0x Protocol."
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-400" />
                    <p className="text-sm font-medium text-emerald-400 font-mono uppercase">RWA Anchor</p>
                </div>
                {status === 'ready' && <span className="text-xs font-mono text-emerald-500">READY TO SIGN</span>}
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase text-slate-500 font-mono">Document URL</label>
                        <div className="flex bg-slate-900/50 p-2 rounded border border-slate-700">
                            <LinkIcon className="w-4 h-4 text-slate-500 mr-2" />
                            <input 
                                type="text" 
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://drive.google.com/..."
                                className="bg-transparent border-none outline-none text-xs text-white w-full placeholder-slate-600"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase text-slate-500 font-mono">Provider File ID / Hash</label>
                        <div className="flex bg-slate-900/50 p-2 rounded border border-slate-700">
                            <FileText className="w-4 h-4 text-slate-500 mr-2" />
                            <input 
                                type="text" 
                                value={providerId}
                                onChange={(e) => setProviderId(e.target.value)}
                                placeholder="Unique File ID from Provider"
                                className="bg-transparent border-none outline-none text-xs text-white w-full placeholder-slate-600"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] uppercase text-slate-500 font-mono">Description (Max 300 chars)</label>
                    <textarea 
                        value={description}
                        onChange={(e) => setDescription(e.target.value.slice(0, 300))}
                        placeholder="Legal description of the asset..."
                        className="w-full bg-slate-900/50 p-2 rounded border border-slate-700 text-xs text-white min-h-[60px] outline-none placeholder-slate-600 resize-none"
                    />
                    <div className="text-[10px] text-right text-slate-600 font-mono">
                        {description.length}/300
                    </div>
                </div>

                {status === 'ready' && (
                    <div className="bg-emerald-900/20 p-3 rounded border border-emerald-500/20 space-y-2">
                        <div className="text-[10px] uppercase text-emerald-500 font-mono">Draft Saved & Anchor Generated</div>
                        
                        <div className="space-y-1">
                            <div className="text-[10px] text-slate-500 font-mono">Pointer Hash</div>
                            <div className="text-xs font-mono text-emerald-400 break-all p-2 bg-black/30 rounded">
                                {pointerHash}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="text-[10px] text-slate-500 font-mono">XDR Envelope</div>
                            <div className="text-xs font-mono text-slate-300 break-all p-2 bg-black/30 rounded">
                                {xdr}
                            </div>
                        </div>

                        <button className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded transition-colors uppercase font-mono">
                            Sign & Broadcast Transaction
                        </button>
                    </div>
                )}
                {status !== 'ready' && (
                    <button 
                        onClick={generateAnchor}
                        disabled={!url || !providerId || !description || status === 'saving'}
                        className={`w-full py-2 flex items-center justify-center gap-2 rounded text-xs font-bold uppercase font-mono transition-all
                            ${(!url || !providerId || !description) 
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'}`}
                    >
                        {status === 'saving' ? (
                            <span>Saving Draft...</span>
                        ) : (
                            <>
                                <Send className="w-3 h-3" />
                                <span>Generate Anchor</span>
                            </>
                        )}
                    </button>
                )}
            </div>
        </Card>
    );
};
