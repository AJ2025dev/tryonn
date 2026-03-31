"use client";
import { useState } from "react";

export default function ImageGallery({ images, productName, accent }: { images: any[]; productName: string; accent: string }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-[3/4] flex items-center justify-center" style={{ backgroundColor: "#F0EBE3" }}>
        <span className="text-stone-400 text-sm" style={{ fontFamily: "'Outfit', sans-serif" }}>No image available</span>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      {/* Thumbnails (vertical strip) */}
      {images.length > 1 && (
        <div className="hidden md:flex flex-col gap-2 w-20 flex-shrink-0">
          {images.map((img: any, i: number) => (
            <button
              key={img.id}
              onClick={() => setActiveIndex(i)}
              className={`w-20 h-24 overflow-hidden transition-all duration-200 ${
                activeIndex === i ? "ring-1 ring-stone-900" : "ring-1 ring-transparent hover:ring-stone-300"
              }`}
            >
              <img src={img.image_url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Main image */}
      <div className="flex-1">
        <div className="relative overflow-hidden" style={{ aspectRatio: "3/4", backgroundColor: "#F0EBE3" }}>
          <img
            src={images[activeIndex].image_url}
            alt={productName}
            className="w-full h-full object-cover transition-opacity duration-300"
          />
        </div>

        {/* Mobile thumbnails (horizontal) */}
        {images.length > 1 && (
          <div className="flex md:hidden gap-2 mt-3">
            {images.map((img: any, i: number) => (
              <button
                key={img.id}
                onClick={() => setActiveIndex(i)}
                className={`w-16 h-16 overflow-hidden flex-shrink-0 transition-all ${
                  activeIndex === i ? "ring-1 ring-stone-900" : "ring-1 ring-transparent"
                }`}
              >
                <img src={img.image_url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
