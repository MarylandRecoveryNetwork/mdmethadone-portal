"use client";
import { useEffect, useRef, useState } from "react";

export default function ClinicFinderPage({ initialData }: { initialData: unknown[] }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const handleLoad = () => {
      setLoaded(true);
      if (initialData.length) {
        try {
          iframe.contentWindow?.postMessage({ type: "SUPABASE_STATUS_DATA", data: initialData }, "*");
        } catch { /* tracker also connects to Supabase on its own */ }
      }
    };
    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [initialData]);

  return (
    <>
      <nav style={{ position:"fixed",top:0,left:0,right:0,zIndex:100,background:"#0a0a0a",
        borderBottom:"3px solid #b8952a",display:"flex",alignItems:"center",
        justifyContent:"space-between",padding:"0 1.5rem",height:52 }}>
        <div style={{ fontFamily:"Georgia,serif",fontSize:16,color:"#d4af4f",fontWeight:700 }}>
          Maryland Methadone Finder
        </div>
        <div style={{ display:"flex",gap:"1rem",alignItems:"center" }}>
          <a href="/login" style={{ fontFamily:"monospace",fontSize:10,letterSpacing:2,
            background:"transparent",border:"1px solid #b8952a",color:"#b8952a",padding:"6px 16px",textDecoration:"none" }}>
            STAFF LOGIN
          </a>
        </div>
      </nav>
      {!loaded && (
        <div style={{ position:"fixed",top:52,left:0,right:0,bottom:0,background:"#080808",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:50 }}>
          <div style={{ fontFamily:"monospace",fontSize:12,color:"#b8952a",letterSpacing:3 }}>
            LOADING CLINIC STATUS…
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src="/tracker/index.html"
        style={{ position:"fixed",top:52,left:0,right:0,bottom:0,width:"100%",
          height:"calc(100vh - 52px)",border:"none",
          opacity:loaded?1:0,transition:"opacity 0.3s" }}
        title="Maryland Methadone Clinic Finder"
      />
    </>
  );
}
