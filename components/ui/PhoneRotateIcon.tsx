import React from 'react';

interface RotateIconType { 
    size : number,
    color? : string,
    strokeWidth? : number,
    background? : string,
    opacity?: number,
    rotation? : number,
    shadow? : number,
    flipHorizontal? : boolean,
    flipVertical? : boolean,
    padding? : number
}

const PhoneRotatePortraitIcon = ({
  size = 10,
  color = '#fff',
  strokeWidth = 1,
  background = 'transparent',
  opacity = 1,
  rotation = 0,
  shadow = 0,
  flipHorizontal = false,
  flipVertical = false,
  padding = 0
} : RotateIconType ) => {
  const transforms = [];
  if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
  if (flipHorizontal) transforms.push('scaleX(-1)');
  if (flipVertical) transforms.push('scaleY(-1)');

  const viewBoxSize = 24 + (padding * 2);
  const viewBoxOffset = -padding;
  const viewBox = `${viewBoxOffset} ${viewBoxOffset} ${viewBoxSize} ${viewBoxSize}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        opacity,
        transform: transforms.join(' ') || undefined,
        filter: shadow > 0 ? `drop-shadow(0 ${shadow}px ${shadow * 2}px rgba(0,0,0,0.3))` : undefined,
        backgroundColor: background !== 'transparent' ? background : undefined
      }}
    >
      <path fill="currentColor" d="M9 1H3a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h1v-3H3V3h6v8h2V3a2 2 0 0 0-2-2m14 20v-6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2M9 21v-6h12v6zm14-11h-1.5c0-3-1.81-5.73-4.58-6.91L16 5l-2-4a9 9 0 0 1 9 9"/>
    </svg>
  );
};

export default PhoneRotatePortraitIcon;