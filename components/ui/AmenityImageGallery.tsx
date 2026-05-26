'use client';

import type { ExteriorAmenity } from '@/data/exteriorAmenities';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type AmenityImageGalleryProps = {
  amenities: ExteriorAmenity[];
};

export default function AmenityImageGallery({ amenities }: AmenityImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const repeatedAmenities = [...amenities, ...amenities, ...amenities];
  const [loadedMainImages, setLoadedMainImages] = useState<Record<string, boolean>>({});
  const [loadedThumbnailImages, setLoadedThumbnailImages] = useState<Record<string, boolean>>({});

  const activeAmenity = amenities[activeIndex] ?? null;
  const isMainImageLoaded = activeAmenity ? Boolean(loadedMainImages[activeAmenity.image]) : false;

  useEffect(() => {
    if (!amenities.length) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        setActiveIndex((current) => (current + 1) % amenities.length);
      }

      if (event.key === 'ArrowLeft') {
        setActiveIndex((current) => (current - 1 + amenities.length) % amenities.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [amenities.length]);

  useEffect(() => {
    if (!amenities.length) {
      return;
    }

    const activeThumbnail = thumbnailRefs.current[activeIndex + amenities.length];

    activeThumbnail?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center'
    });
  }, [activeIndex, amenities.length]);

  if (!activeAmenity) {
    return <div className="min-h-screen bg-black" />;
  }

  const showPrevious = () => {
    setActiveIndex((current) => (current - 1 + amenities.length) % amenities.length);
  };

  const showNext = () => {
    setActiveIndex((current) => (current + 1) % amenities.length);
  };

  return (
    <div className="h-[100svh] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(124,100,62,0.14),transparent_20%),linear-gradient(180deg,#020202_0%,#060606_46%,#030303_100%)] text-white">
      <div className="flex h-full flex-col">
        <div className="relative min-h-0 flex-1">
          <button
            type="button"
            aria-label="Previous image"
            onClick={showPrevious}
            className="absolute left-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#d6c29b]/14 bg-black/44 text-white/88 shadow-[0_20px_40px_rgba(0,0,0,0.28)] transition hover:border-[#d6c29b]/28 hover:bg-black/58 xl:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="relative h-full w-full overflow-hidden">
            <div className="relative h-full w-full">
              {!isMainImageLoaded ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/18">
                  <div className="h-12 w-12 rounded-full border-2 border-white/18 border-t-[#e7d4ab] animate-spin sm:h-14 sm:w-14" />
                </div>
              ) : null}

              <Image
                key={activeAmenity.id}
                src={activeAmenity.image}
                alt=""
                fill
                priority
                unoptimized
                sizes="100vw"
                onLoad={() =>
                  setLoadedMainImages((current) => ({
                    ...current,
                    [activeAmenity.image]: true
                  }))
                }
                className={`object-cover transition-opacity duration-500 ${
                  isMainImageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,248,235,0.04)_0%,rgba(0,0,0,0)_18%,rgba(0,0,0,0.18)_100%)]" />
            </div>
          </div>

          <button
            type="button"
            aria-label="Next image"
            onClick={showNext}
            className="absolute right-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#d6c29b]/14 bg-black/44 text-white/88 shadow-[0_20px_40px_rgba(0,0,0,0.28)] transition hover:border-[#d6c29b]/28 hover:bg-black/58 xl:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="relative w-screen flex-none self-center bg-black/86 backdrop-blur-md">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.88),rgba(0,0,0,0))]" />

          <div className="custom-scrollbar flex gap-2 overflow-x-auto px-2 py-3 sm:gap-3 sm:px-3 sm:py-4">
            {repeatedAmenities.map((amenity, index) => {
              const amenityIndex = index % amenities.length;
              const isActive = amenityIndex === activeIndex;

              return (
                <button
                  key={`${amenity.id}-${index}`}
                  ref={(element) => {
                    thumbnailRefs.current[index] = element;
                  }}
                  type="button"
                  aria-label={`View image ${amenityIndex + 1}`}
                  onClick={() => setActiveIndex(amenityIndex)}
                  className={`relative h-[82px] w-[146px] shrink-0 overflow-hidden rounded-[0.95rem] border bg-[#0b0b0b] shadow-[0_18px_36px_rgba(0,0,0,0.32)] transition duration-300 sm:h-[96px] sm:w-[172px] lg:h-[104px] lg:w-[184px] ${
                    isActive
                      ? 'border-[#ead8b4]/55 ring-1 ring-[#ead8b4]/30'
                      : 'border-white/8 opacity-70 hover:border-white/18 hover:opacity-100'
                  }`}
                >
                  {!loadedThumbnailImages[amenity.image] ? (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/26">
                      <div className="h-6 w-6 rounded-full border-2 border-white/16 border-t-[#e7d4ab] animate-spin" />
                    </div>
                  ) : null}

                  <Image
                    src={amenity.image}
                    alt=""
                    fill
                    unoptimized
                    sizes="184px"
                    onLoad={() =>
                      setLoadedThumbnailImages((current) => ({
                        ...current,
                        [amenity.image]: true
                      }))
                    }
                    className={`object-cover transition-opacity duration-500 ${
                      loadedThumbnailImages[amenity.image] ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <div
                    className={`absolute inset-0 ${
                      isActive
                        ? 'bg-[linear-gradient(180deg,rgba(255,248,235,0.06),rgba(0,0,0,0.02))]'
                        : 'bg-black/16'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
