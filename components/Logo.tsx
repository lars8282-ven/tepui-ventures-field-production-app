import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/dashboard" className={`flex items-center ${className}`}>
      <div className="flex items-center">
        {/* TV Monogram */}
        <div className="flex items-center mr-3">
          <span className="text-4xl font-bold text-[#2C2C2C] tracking-tight">T</span>
          <span className="text-4xl font-bold text-[#00BFFF] ml-0.5 tracking-tight">V</span>
        </div>
        {/* Text */}
        <div className="flex flex-col justify-center">
          <span className="text-xs font-bold uppercase tracking-tight text-[#2C2C2C] leading-tight">
            TEPUI
          </span>
          <span className="text-xs font-bold uppercase tracking-tight text-[#00BFFF] leading-tight">
            VENTURES
          </span>
        </div>
      </div>
    </Link>
  );
}

export function LogoIcon({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center ${className}`}>
      <span className="text-2xl font-bold text-[#2C2C2C]">T</span>
      <span className="text-2xl font-bold text-[#00BFFF] ml-0.5">V</span>
    </div>
  );
}

