import { ImageResponse } from "next/og";
export const alt = "ByteminusVoiceStudio — local Bengali and English AI speech studio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "70px", color: "#f8f5ff", background: "linear-gradient(135deg,#111018,#30204b)", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", color: "#c4a8ff", fontSize: 24, letterSpacing: 4 }}>LOCAL AI SPEECH · FREE & OPEN SOURCE</div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 86, fontWeight: 700, marginTop: 40, lineHeight: 1.08 }}><span>Byteminus</span><span>Voice Studio</span></div>
      <div style={{ display: "flex", fontSize: 31, marginTop: 28 }}>Bengali + English · Expressive voices · Audio + SRT</div>
      <div style={{ display: "flex", fontSize: 22, marginTop: 30, color: "#c4a8ff" }}>CPU / NVIDIA CUDA · No paid speech API</div>
    </div>, size,
  );
}
