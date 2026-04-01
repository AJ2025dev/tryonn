import Link from "next/link";

export default function StoreNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FDFCFA", fontFamily: "'Outfit', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Outfit:wght@300;400;500&display=swap" rel="stylesheet" />
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 rounded-full border-2 border-stone-200 flex items-center justify-center mx-auto mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
        </div>
        <h1 className="text-3xl font-light text-stone-900 mb-3" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Store Not Found</h1>
        <p className="text-sm text-stone-400 mb-8 leading-relaxed">
          The store you're looking for doesn't exist or hasn't been set up yet. Check the URL and try again.
        </p>
        <a href="https://appi-fy.ai" className="inline-block px-8 py-3 text-xs tracking-[0.2em] uppercase border border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-white transition-all">
          Visit Appify
        </a>
      </div>
    </div>
  );
}
