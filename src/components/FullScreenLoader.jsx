import React from 'react';

export default function FullScreenLoader({ text = 'Loading...' }) {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50">
      {/* Spinner */}
      <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>

      {/* Text */}
      <p className="mt-4 text-gray-600 text-sm">{text}</p>
    </div>
  );
}
