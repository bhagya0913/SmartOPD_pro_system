import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ScanBarcode, CameraOff, RefreshCw, CheckCircle2, FlipHorizontal } from 'lucide-react';

// Load html5-qrcode once from CDN, cache it
let _libPromise = null;
function getLib() {
    if (_libPromise) return _libPromise;
    _libPromise = new Promise((resolve, reject) => {
        if (window.Html5Qrcode) { resolve(window.Html5Qrcode); return; }
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
        s.onload  = () => window.Html5Qrcode ? resolve(window.Html5Qrcode) : reject(new Error('Library not found after load.'));
        s.onerror = () => reject(new Error('Could not load scanner library. Check your network.'));
        document.head.appendChild(s);
    });
    return _libPromise;
}

const DIV_ID = 'bsc-region';

export default function BarcodeScanner({ onDetected, onClose }) {
    const scannerRef  = useRef(null);
    const doneRef     = useRef(false);   // prevent double fire
    const camsRef     = useRef([]);      // all available cameras

    const [status,   setStatus]   = useState('starting');  // starting | scanning | error | done
    const [errorMsg, setErrorMsg] = useState('');
    const [camIndex, setCamIndex] = useState(0);           // which camera is active
    const [camCount, setCamCount] = useState(0);           // total cameras found
    const [detected, setDetected] = useState('');

    // ── stop running instance ─────────────────────────────────────
    const stop = useCallback(async () => {
        if (!scannerRef.current) return;
        try {
            const state = scannerRef.current.getState?.();
            if (state === 2 || state === 3) await scannerRef.current.stop();
            scannerRef.current.clear?.();
        } catch {}
        scannerRef.current = null;
    }, []);

    // ── start a specific camera by index ──────────────────────────
    const startCamera = useCallback(async (index) => {
        await stop();
        doneRef.current = false;
        setStatus('starting');
        setErrorMsg('');

        try {
            const Html5Qrcode = await getLib();

            // Enumerate cameras only once
            if (!camsRef.current.length) {
                const devices = await Html5Qrcode.getCameras();
                if (!devices?.length) throw new Error('No camera detected. Please allow camera access.');
                camsRef.current = devices;
                setCamCount(devices.length);
                // Default: pick rear camera, fall back to last device
                const rearIdx = devices.findIndex(d => /back|rear|environment/i.test(d.label));
                const startIdx = rearIdx >= 0 ? rearIdx : devices.length - 1;
                index = startIdx;
                setCamIndex(startIdx);
            }

            const cam = camsRef.current[index];
            if (!cam) throw new Error('Camera not found.');

            const scanner = new Html5Qrcode(DIV_ID, { verbose: false });
            scannerRef.current = scanner;

            await scanner.start(
                { deviceId: { exact: cam.id } },
                {
                    fps: 15,
                    qrbox: { width: 280, height: 100 }, // wide box for 1D barcodes
                    aspectRatio: 1.5,
                },
                (text) => {
                    if (doneRef.current) return;
                    doneRef.current = true;
                    setDetected(text);
                    setStatus('done');
                    // Brief success flash, then fire result
                    setTimeout(() => { stop(); onDetected(text); }, 900);
                },
                () => {} // per-frame errors — ignored
            );
            setStatus('scanning');
        } catch (err) {
            // Fallback: try environment facingMode directly
            try {
                const Html5Qrcode = window.Html5Qrcode;
                if (!Html5Qrcode) throw err;
                const scanner2 = new Html5Qrcode(DIV_ID, { verbose: false });
                scannerRef.current = scanner2;
                await scanner2.start(
                    { facingMode: 'environment' },
                    { fps: 15, qrbox: { width: 280, height: 100 }, aspectRatio: 1.5 },
                    (text) => {
                        if (doneRef.current) return;
                        doneRef.current = true;
                        setDetected(text);
                        setStatus('done');
                        setTimeout(() => { stop(); onDetected(text); }, 900);
                    },
                    () => {}
                );
                setStatus('scanning');
            } catch (err2) {
                setErrorMsg(err2.message || 'Camera could not be started.');
                setStatus('error');
            }
        }
    }, [stop, onDetected]);

    // ── mount: start immediately ──────────────────────────────────
    useEffect(() => {
        startCamera(0);
        return () => { stop(); };
    }, []);  // eslint-disable-line

    // ── flip to next camera ───────────────────────────────────────
    const flipCamera = async () => {
        const next = (camIndex + 1) % camsRef.current.length;
        setCamIndex(next);
        await startCamera(next);
    };

    const handleClose = () => { stop(); onClose(); };

    return (
        <div className="bsc-backdrop" onClick={handleClose}>
            <div className="bsc-sheet" onClick={e => e.stopPropagation()}>

                {/* ── top bar ── */}
                <div className="bsc-topbar">
                    <div className="bsc-topbar-left">
                        <ScanBarcode size={16} color="#0d9488"/>
                        <span>Scan Patient Barcode</span>
                    </div>
                    <div className="bsc-topbar-right">
                        {/* Flip camera — only shown if >1 camera */}
                        {camCount > 1 && status === 'scanning' && (
                            <button className="bsc-icon-btn" onClick={flipCamera} title="Switch camera">
                                <FlipHorizontal size={16}/>
                            </button>
                        )}
                        <button className="bsc-icon-btn" onClick={handleClose} title="Close">
                            <X size={17}/>
                        </button>
                    </div>
                </div>

                {/* ── camera viewport ── */}
                <div className="bsc-viewport">

                    {/* html5-qrcode injects video here */}
                    <div
                        id={DIV_ID}
                        className="bsc-cam-div"
                        style={{ visibility: status === 'scanning' ? 'visible' : 'hidden' }}
                    />

                    {/* Starting overlay */}
                    {status === 'starting' && (
                        <div className="bsc-overlay-state">
                            <div className="bsc-spin-ring"/>
                            <p>Opening camera…</p>
                        </div>
                    )}

                    {/* Error overlay */}
                    {status === 'error' && (
                        <div className="bsc-overlay-state bsc-overlay-err">
                            <CameraOff size={42} strokeWidth={1.2}/>
                            <p className="bsc-err-title">Camera Error</p>
                            <p className="bsc-err-msg">{errorMsg}</p>
                            <button className="bsc-retry" onClick={() => startCamera(camIndex)}>
                                <RefreshCw size={14}/> Try Again
                            </button>
                        </div>
                    )}

                    {/* Success overlay */}
                    {status === 'done' && (
                        <div className="bsc-overlay-state bsc-overlay-ok">
                            <CheckCircle2 size={52} strokeWidth={1.3}/>
                            <p className="bsc-ok-label">Found!</p>
                            <code className="bsc-ok-code">{detected}</code>
                        </div>
                    )}

                    {/* Aim guide — shown while scanning */}
                    {status === 'scanning' && (
                        <div className="bsc-aim" aria-hidden="true">
                            <span className="bsc-aim-c tl"/><span className="bsc-aim-c tr"/>
                            <span className="bsc-aim-c bl"/><span className="bsc-aim-c br"/>
                            <div className="bsc-aim-line"/>
                        </div>
                    )}
                </div>

                {/* ── hint bar ── */}
                <div className="bsc-hint">
                    {status === 'scanning' && 'Point the barcode at the highlighted area — scans automatically'}
                    {status === 'starting' && 'Allow camera access if your browser asks'}
                    {status === 'done'     && 'Opening patient record…'}
                    {status === 'error'    && 'Check that no other app is using your camera, then retry'}
                </div>

            </div>

            {/* ── all CSS scoped inside the component ── */}
            <style>{`
.bsc-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.6);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    box-sizing: border-box;
}
.bsc-sheet {
    background: #fff;
    border-radius: 18px;
    width: 100%;
    max-width: 440px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

/* top bar */
.bsc-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 14px;
    border-bottom: 1px solid #f1f5f9;
    flex-shrink: 0;
}
.bsc-topbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.87rem;
    font-weight: 600;
    color: #1e293b;
}
.bsc-topbar-right {
    display: flex;
    align-items: center;
    gap: 4px;
}
.bsc-icon-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    color: #64748b;
    width: 32px; height: 32px;
    border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    transition: background .12s;
}
.bsc-icon-btn:hover { background: #f1f5f9; }

/* viewport */
.bsc-viewport {
    position: relative;
    width: 100%;
    background: #0a0f1a;
    /* Fixed height so layout doesn't jump */
    height: 290px;
    overflow: hidden;
    flex-shrink: 0;
}

/* html5-qrcode div + injected video */
.bsc-cam-div {
    width: 100%;
    height: 100%;
}
#bsc-region {
    width: 100% !important;
    height: 100% !important;
}
#bsc-region video {
    width: 100% !important;
    height: 290px !important;
    object-fit: cover !important;
    display: block !important;
}
/* Hide the default html5-qrcode UI chrome */
#bsc-region img,
#bsc-region button,
#bsc-region select,
#bsc-region span[style] { display: none !important; }
#bsc-region > div[style*="border"] {
    border-color: rgba(255,255,255,.25) !important;
    border-width: 1px !important;
}

/* overlays */
.bsc-overlay-state {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: #fff;
    text-align: center;
    padding: 20px;
    z-index: 20;
    background: rgba(10,15,26,.88);
}
.bsc-overlay-err { background: rgba(80,10,10,.9); }
.bsc-overlay-ok  { background: rgba(5,50,35,.92); }

.bsc-err-title { margin: 0; font-weight: 600; font-size: .95rem; }
.bsc-err-msg   { margin: 0; font-size: .8rem; opacity: .82; line-height: 1.4; max-width: 280px; }
.bsc-ok-label  { margin: 0; font-weight: 600; font-size: 1.05rem; }
.bsc-ok-code   {
    background: rgba(255,255,255,.1);
    border: 1px solid rgba(255,255,255,.2);
    border-radius: 8px;
    padding: 5px 18px;
    font-size: .9rem;
    letter-spacing: .05em;
    color: #6ee7b7;
    word-break: break-all;
    max-width: 320px;
}

.bsc-spin-ring {
    width: 40px; height: 40px;
    border: 3px solid rgba(255,255,255,.15);
    border-top-color: #fff;
    border-radius: 50%;
    animation: bsc-spin .7s linear infinite;
}
@keyframes bsc-spin { to { transform: rotate(360deg); } }

.bsc-retry {
    margin-top: 4px;
    display: flex; align-items: center; gap: 6px;
    background: rgba(255,255,255,.12);
    border: 1px solid rgba(255,255,255,.25);
    color: #fff;
    border-radius: 8px;
    padding: 7px 18px;
    font-size: .82rem;
    cursor: pointer;
}
.bsc-retry:hover { background: rgba(255,255,255,.22); }

/* aim guide */
.bsc-aim {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 15;
}
.bsc-aim-c {
    position: absolute;
    width: 20px; height: 20px;
    border-color: #2dd4bf;
    border-style: solid;
}
.bsc-aim-c.tl { top: 10px;    left: 10px;    border-width: 3px 0 0 3px; border-radius: 3px 0 0 0; }
.bsc-aim-c.tr { top: 10px;    right: 10px;   border-width: 3px 3px 0 0; border-radius: 0 3px 0 0; }
.bsc-aim-c.bl { bottom: 10px; left: 10px;    border-width: 0 0 3px 3px; border-radius: 0 0 0 3px; }
.bsc-aim-c.br { bottom: 10px; right: 10px;   border-width: 0 3px 3px 0; border-radius: 0 0 3px 0; }

/* animated scan line */
.bsc-aim-line {
    position: absolute;
    left: 10px; right: 10px;
    height: 2px;
    background: #2dd4bf;
    opacity: .8;
    animation: bsc-sweep 2s ease-in-out infinite;
}
@keyframes bsc-sweep {
    0%   { top: 10px; }
    50%  { top: calc(100% - 10px); }
    100% { top: 10px; }
}

/* hint */
.bsc-hint {
    padding: 9px 16px 11px;
    font-size: .74rem;
    color: #64748b;
    text-align: center;
    line-height: 1.5;
    background: #fff;
    min-height: 32px;
    flex-shrink: 0;
}
`}</style>
        </div>
    );
}