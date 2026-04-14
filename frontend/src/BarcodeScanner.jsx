import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ScanBarcode, CameraOff, RefreshCw, CheckCircle2, FlipHorizontal } from 'lucide-react';

// ─── LIB LOADER ───────────────────────────────────────────────────────────────
// Never cache a rejected promise — user may retry after network recovers
function loadLib() {
    return new Promise((resolve, reject) => {
        if (window.Html5Qrcode) { resolve(window.Html5Qrcode); return; }
        // Remove any half-loaded script tag before adding a fresh one
        document.querySelectorAll('script[data-bsc]').forEach(s => s.remove());
        const s = document.createElement('script');
        s.setAttribute('data-bsc', '1');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
        s.onload  = () => window.Html5Qrcode
            ? resolve(window.Html5Qrcode)
            : reject(new Error('Scanner library loaded but Html5Qrcode not found.'));
        s.onerror = () => reject(new Error('Could not load scanner library. Check your network.'));
        document.head.appendChild(s);
    });
}

// ─── UNIQUE DIV ID ────────────────────────────────────────────────────────────
// Static 'bsc-region' breaks when component remounts — old div may still be in
// the DOM while a new scanner tries to claim it. Use a per-instance ID instead.
let _instanceCounter = 0;

export default function BarcodeScanner({ onDetected, onClose }) {
    const instanceId  = useRef(`bsc-region-${++_instanceCounter}`);
    const DIV_ID      = instanceId.current;

    const scannerRef  = useRef(null);
    const doneRef     = useRef(false);
    const camsRef     = useRef([]);

    const [status,   setStatus]   = useState('starting');
    const [errorMsg, setErrorMsg] = useState('');
    const [camIndex, setCamIndex] = useState(0);
    const [camCount, setCamCount] = useState(0);
    const [detected, setDetected] = useState('');

    // ── Stop any running scanner cleanly ──────────────────────────────────────
    const stop = useCallback(async () => {
        const sc = scannerRef.current;
        if (!sc) return;
        try {
            // getState: 1=NOT_STARTED 2=SCANNING 3=PAUSED
            const state = sc.getState?.();
            if (state === 2 || state === 3) {
                await sc.stop();
            }
            sc.clear?.();
        } catch { /* ignore stop errors */ }
        scannerRef.current = null;
    }, []);

    // ── Core scanner start ────────────────────────────────────────────────────
    const startCamera = useCallback(async (index) => {
        await stop();
        doneRef.current = false;
        setStatus('starting');
        setErrorMsg('');

        let Html5Qrcode;
        try {
            Html5Qrcode = await loadLib();
        } catch (err) {
            setErrorMsg(err.message);
            setStatus('error');
            return;
        }

        // ── FIX 1: Request camera permission BEFORE enumerating ───────────────
        // getCameras() on Chrome returns devices with empty labels when called
        // before getUserMedia — the deviceId then doesn't match anything.
        // Prime the permission by calling getUserMedia first.
        if (!camsRef.current.length) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                stream.getTracks().forEach(t => t.stop()); // immediately release — we just needed the grant
            } catch {
                // Permission denied — fall through to facingMode fallback
            }
        }

        // ── FIX 2: Enumerate cameras after permission granted ─────────────────
        if (!camsRef.current.length) {
            try {
                const devices = await Html5Qrcode.getCameras();
                if (devices?.length) {
                    camsRef.current = devices;
                    setCamCount(devices.length);
                    const rearIdx = devices.findIndex(d =>
                        /back|rear|environment/i.test(d.label)
                    );
                    const startIdx = rearIdx >= 0 ? rearIdx : devices.length - 1;
                    index = startIdx;
                    setCamIndex(startIdx);
                }
            } catch { /* enumeration failed — will use facingMode fallback */ }
        }

        // ── FIX 3: Explicit 1D barcode formats ───────────────────────────────
        // html5-qrcode defaults to QR_CODE only in some builds. Our barcodes
        // are Code 128 / Code 39 style (BHK-xxx). Must declare formats explicitly.
        const formatsToSupport = window.Html5QrcodeSupportedFormats
            ? [
                window.Html5QrcodeSupportedFormats.QR_CODE,
                window.Html5QrcodeSupportedFormats.CODE_128,
                window.Html5QrcodeSupportedFormats.CODE_39,
                window.Html5QrcodeSupportedFormats.EAN_13,
                window.Html5QrcodeSupportedFormats.EAN_8,
                window.Html5QrcodeSupportedFormats.DATA_MATRIX,
                window.Html5QrcodeSupportedFormats.ITF,
              ].filter(Boolean)
            : undefined;

        const scanConfig = {
            fps:         20,
            qrbox:       { width: 300, height: 120 }, // wide scan box for 1D barcodes
            aspectRatio: 1.6,
            ...(formatsToSupport ? { formatsToSupport } : {}),
        };

        const onSuccess = (text) => {
            if (doneRef.current) return;
            doneRef.current = true;
            setDetected(text);
            setStatus('done');
            setTimeout(() => { stop(); onDetected(text); }, 900);
        };

        const onFrameError = () => {}; // suppress per-frame noise

        // ── Try with explicit deviceId first (more reliable on desktop) ───────
        const cam = camsRef.current[index];
        if (cam) {
            try {
                const scanner = new Html5Qrcode(DIV_ID, { verbose: false });
                scannerRef.current = scanner;
                await scanner.start(
                    { deviceId: { exact: cam.id } },
                    scanConfig,
                    onSuccess,
                    onFrameError
                );
                setStatus('scanning');
                return;
            } catch {
                // deviceId attempt failed — fall through to facingMode
                await stop();
            }
        }

        // ── Fallback: environment facingMode (works on most mobile browsers) ──
        try {
            const scanner2 = new Html5Qrcode(DIV_ID, { verbose: false });
            scannerRef.current = scanner2;
            await scanner2.start(
                { facingMode: 'environment' },
                scanConfig,
                onSuccess,
                onFrameError
            );
            setStatus('scanning');
        } catch (err2) {
            // Last resort: try user-facing camera
            try {
                const scanner3 = new Html5Qrcode(DIV_ID, { verbose: false });
                scannerRef.current = scanner3;
                await scanner3.start(
                    { facingMode: 'user' },
                    scanConfig,
                    onSuccess,
                    onFrameError
                );
                setStatus('scanning');
            } catch (err3) {
                setErrorMsg(
                    err3.message?.includes('Permission')
                        ? 'Camera access denied. Please allow camera in your browser settings and retry.'
                        : err3.message || 'Camera could not be started.'
                );
                setStatus('error');
            }
        }
    }, [stop, onDetected, DIV_ID]);

    // Mount — start immediately; unmount — stop cleanly
    useEffect(() => {
        startCamera(0);
        return () => { stop(); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const flipCamera = async () => {
        if (camsRef.current.length < 2) return;
        const next = (camIndex + 1) % camsRef.current.length;
        setCamIndex(next);
        await startCamera(next);
    };

    const handleClose = () => { stop(); onClose(); };

    return (
        <div className="bsc-backdrop" onClick={handleClose}>
            <div className="bsc-sheet" onClick={e => e.stopPropagation()}>

                {/* ── Top bar ── */}
                <div className="bsc-topbar">
                    <div className="bsc-topbar-left">
                        <ScanBarcode size={16} color="#0d9488" />
                        <span>Scan Patient Barcode</span>
                    </div>
                    <div className="bsc-topbar-right">
                        {camCount > 1 && status === 'scanning' && (
                            <button className="bsc-icon-btn" onClick={flipCamera} title="Switch camera">
                                <FlipHorizontal size={16} />
                            </button>
                        )}
                        <button className="bsc-icon-btn" onClick={handleClose} title="Close">
                            <X size={17} />
                        </button>
                    </div>
                </div>

                {/* ── Camera viewport ── */}
                <div className="bsc-viewport">

                    {/* html5-qrcode mounts the video element here */}
                    <div
                        id={DIV_ID}
                        className="bsc-cam-div"
                        style={{ visibility: status === 'scanning' ? 'visible' : 'hidden' }}
                    />

                    {/* Starting */}
                    {status === 'starting' && (
                        <div className="bsc-overlay-state">
                            <div className="bsc-spin-ring" />
                            <p style={{ margin: 0, fontSize: '.88rem' }}>Opening camera…</p>
                        </div>
                    )}

                    {/* Error */}
                    {status === 'error' && (
                        <div className="bsc-overlay-state bsc-overlay-err">
                            <CameraOff size={42} strokeWidth={1.2} />
                            <p className="bsc-err-title">Camera Error</p>
                            <p className="bsc-err-msg">{errorMsg}</p>
                            <button className="bsc-retry" onClick={() => startCamera(camIndex)}>
                                <RefreshCw size={14} /> Try Again
                            </button>
                        </div>
                    )}

                    {/* Success */}
                    {status === 'done' && (
                        <div className="bsc-overlay-state bsc-overlay-ok">
                            <CheckCircle2 size={52} strokeWidth={1.3} />
                            <p className="bsc-ok-label">Found!</p>
                            <code className="bsc-ok-code">{detected}</code>
                        </div>
                    )}

                    {/* Aim guide — visible while scanning */}
                    {status === 'scanning' && (
                        <div className="bsc-aim" aria-hidden="true">
                            <span className="bsc-aim-c tl" />
                            <span className="bsc-aim-c tr" />
                            <span className="bsc-aim-c bl" />
                            <span className="bsc-aim-c br" />
                            <div className="bsc-aim-line" />
                        </div>
                    )}
                </div>

                {/* ── Hint bar ── */}
                <div className="bsc-hint">
                    {status === 'scanning' && 'Hold the barcode steady inside the frame — detection is automatic'}
                    {status === 'starting' && 'Allow camera access if your browser asks'}
                    {status === 'done'     && 'Opening patient record…'}
                    {status === 'error'    && 'Check that no other app is using your camera, then tap Try Again'}
                </div>
            </div>

            <style>{`
.bsc-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.65);
    z-index: 9999;
    display: flex; align-items: center; justify-content: center;
    padding: 12px; box-sizing: border-box;
}
.bsc-sheet {
    background: #fff; border-radius: 18px;
    width: 100%; max-width: 440px;
    overflow: hidden; display: flex; flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,.4);
}
.bsc-topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 11px 14px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0;
}
.bsc-topbar-left {
    display: flex; align-items: center; gap: 8px;
    font-size: .87rem; font-weight: 600; color: #1e293b;
}
.bsc-topbar-right { display: flex; align-items: center; gap: 4px; }
.bsc-icon-btn {
    background: transparent; border: none; cursor: pointer; color: #64748b;
    width: 32px; height: 32px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    transition: background .12s;
}
.bsc-icon-btn:hover { background: #f1f5f9; }
.bsc-viewport {
    position: relative; width: 100%; background: #0a0f1a;
    height: 300px; overflow: hidden; flex-shrink: 0;
}
.bsc-cam-div { width: 100%; height: 100%; }
#bsc-region-${instanceId.current} {
    width: 100% !important; height: 100% !important;
}
[id^="bsc-region-"] video {
    width: 100% !important; height: 300px !important;
    object-fit: cover !important; display: block !important;
}
[id^="bsc-region-"] img,
[id^="bsc-region-"] button,
[id^="bsc-region-"] select,
[id^="bsc-region-"] span[style] { display: none !important; }
[id^="bsc-region-"] > div[style*="border"] {
    border-color: rgba(255,255,255,.25) !important; border-width: 1px !important;
}
.bsc-overlay-state {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 10px; color: #fff; text-align: center; padding: 20px; z-index: 20;
    background: rgba(10,15,26,.88);
}
.bsc-overlay-err { background: rgba(80,10,10,.9); }
.bsc-overlay-ok  { background: rgba(5,50,35,.92); }
.bsc-err-title { margin: 0; font-weight: 600; font-size: .95rem; }
.bsc-err-msg   { margin: 0; font-size: .8rem; opacity: .82; line-height: 1.4; max-width: 280px; }
.bsc-ok-label  { margin: 0; font-weight: 600; font-size: 1.05rem; }
.bsc-ok-code {
    background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.2);
    border-radius: 8px; padding: 5px 18px; font-size: .88rem;
    letter-spacing: .04em; color: #6ee7b7; word-break: break-all; max-width: 320px;
}
.bsc-spin-ring {
    width: 40px; height: 40px; border: 3px solid rgba(255,255,255,.15);
    border-top-color: #fff; border-radius: 50%;
    animation: bsc-spin .7s linear infinite;
}
@keyframes bsc-spin { to { transform: rotate(360deg); } }
.bsc-retry {
    margin-top: 4px; display: flex; align-items: center; gap: 6px;
    background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.25);
    color: #fff; border-radius: 8px; padding: 7px 18px;
    font-size: .82rem; cursor: pointer;
}
.bsc-retry:hover { background: rgba(255,255,255,.22); }
.bsc-aim {
    position: absolute; inset: 0; pointer-events: none; z-index: 15;
}
.bsc-aim-c {
    position: absolute; width: 22px; height: 22px;
    border-color: #2dd4bf; border-style: solid;
}
.bsc-aim-c.tl { top: 12px;    left: 12px;    border-width: 3px 0 0 3px; border-radius: 3px 0 0 0; }
.bsc-aim-c.tr { top: 12px;    right: 12px;   border-width: 3px 3px 0 0; border-radius: 0 3px 0 0; }
.bsc-aim-c.bl { bottom: 12px; left: 12px;    border-width: 0 0 3px 3px; border-radius: 0 0 0 3px; }
.bsc-aim-c.br { bottom: 12px; right: 12px;   border-width: 0 3px 3px 0; border-radius: 0 0 3px 0; }
.bsc-aim-line {
    position: absolute; left: 12px; right: 12px; height: 2px;
    background: #2dd4bf; opacity: .85;
    animation: bsc-sweep 2s ease-in-out infinite;
}
@keyframes bsc-sweep {
    0%   { top: 12px; }
    50%  { top: calc(100% - 12px); }
    100% { top: 12px; }
}
.bsc-hint {
    padding: 9px 16px 12px; font-size: .75rem; color: #64748b;
    text-align: center; line-height: 1.5; background: #fff;
    min-height: 36px; flex-shrink: 0;
}
`}</style>
        </div>
    );
}