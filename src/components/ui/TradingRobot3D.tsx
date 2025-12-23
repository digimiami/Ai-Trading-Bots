import { useEffect, useRef } from 'react';

export default function TradingRobot3D() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Add mouse move parallax effect
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      const xPercent = (clientX / innerWidth) * 100;
      const yPercent = (clientY / innerHeight) * 100;

      container.style.setProperty('--mouse-x', `${xPercent}%`);
      container.style.setProperty('--mouse-y', `${yPercent}%`);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden z-0"
      style={{
        perspective: '1000px',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Main 3D Robot Silhouette */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          transform: 'translate3d(-50%, -50%, 0) rotateY(var(--mouse-x, 50deg)) rotateX(calc(var(--mouse-y, 50deg) * -0.1))',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Robot Head */}
        <div
          className="absolute"
          style={{
            width: '120px',
            height: '100px',
            transform: 'translate3d(-60px, -200px, 50px)',
            opacity: 0.15,
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(147, 51, 234, 0.3))',
            borderRadius: '20px 20px 10px 10px',
            boxShadow: '0 20px 60px rgba(59, 130, 246, 0.3), inset 0 0 40px rgba(147, 51, 234, 0.2)',
            animation: 'pulse-glow 3s ease-in-out infinite',
          }}
        >
          {/* Eyes */}
          <div
            className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-400"
            style={{
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)',
              animation: 'blink 2s ease-in-out infinite',
            }}
          />
          <div
            className="absolute top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-400"
            style={{
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)',
              animation: 'blink 2s ease-in-out infinite 0.1s',
            }}
          />
        </div>

        {/* Robot Body */}
        <div
          className="absolute"
          style={{
            width: '150px',
            height: '180px',
            transform: 'translate3d(-75px, -80px, 30px)',
            opacity: 0.12,
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.25), rgba(79, 70, 229, 0.25))',
            borderRadius: '15px',
            boxShadow: '0 25px 70px rgba(14, 165, 233, 0.25), inset 0 0 50px rgba(79, 70, 229, 0.15)',
          }}
        >
          {/* Chest Panel */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-blue-400/30 rounded-lg"
            style={{
              boxShadow: 'inset 0 0 30px rgba(59, 130, 246, 0.2)',
            }}
          />
        </div>

        {/* Robot Arms */}
        <div
          className="absolute"
          style={{
            width: '40px',
            height: '120px',
            transform: 'translate3d(-140px, -60px, 20px) rotateZ(-20deg)',
            opacity: 0.1,
            background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.2), rgba(147, 51, 234, 0.2))',
            borderRadius: '20px',
            boxShadow: '0 10px 30px rgba(59, 130, 246, 0.2)',
            animation: 'swing-left 4s ease-in-out infinite',
          }}
        />
        <div
          className="absolute"
          style={{
            width: '40px',
            height: '120px',
            transform: 'translate3d(100px, -60px, 20px) rotateZ(20deg)',
            opacity: 0.1,
            background: 'linear-gradient(90deg, rgba(147, 51, 234, 0.2), rgba(59, 130, 246, 0.2))',
            borderRadius: '20px',
            boxShadow: '0 10px 30px rgba(147, 51, 234, 0.2)',
            animation: 'swing-right 4s ease-in-out infinite',
          }}
        />
      </div>

      {/* Floating Data Particles - Representing Trading Flow */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            width: `${Math.random() * 8 + 4}px`,
            height: `${Math.random() * 8 + 4}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: `linear-gradient(135deg, 
              rgba(59, 130, 246, ${0.3 + Math.random() * 0.4}), 
              rgba(147, 51, 234, ${0.2 + Math.random() * 0.3}))`,
            borderRadius: '50%',
            boxShadow: `0 0 ${10 + Math.random() * 20}px rgba(59, 130, 246, 0.6)`,
            animation: `float-${i % 4} ${8 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
            transform: `translateZ(${Math.random() * 200 - 100}px)`,
          }}
        />
      ))}

      {/* Data Flow Lines */}
      {Array.from({ length: 15 }).map((_, i) => (
        <div
          key={`line-${i}`}
          className="absolute"
          style={{
            width: '2px',
            height: `${100 + Math.random() * 200}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: `linear-gradient(to bottom, 
              transparent, 
              rgba(59, 130, 246, ${0.2 + Math.random() * 0.3}), 
              transparent)`,
            transform: `rotate(${Math.random() * 360}deg) translateZ(${Math.random() * 150 - 75}px)`,
            animation: `flow-line ${6 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 3}s`,
            opacity: 0.3,
          }}
        />
      ))}

      {/* Geometric Shapes - Trading Signals */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={`shape-${i}`}
          className="absolute"
          style={{
            width: `${20 + Math.random() * 30}px`,
            height: `${20 + Math.random() * 30}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            border: `2px solid rgba(59, 130, 246, ${0.2 + Math.random() * 0.3})`,
            borderRadius: Math.random() > 0.5 ? '50%' : '8px',
            transform: `translateZ(${Math.random() * 100 - 50}px) rotateZ(${Math.random() * 360}deg)`,
            animation: `rotate-float ${10 + Math.random() * 5}s linear infinite`,
            animationDelay: `${Math.random() * 2}s`,
            opacity: 0.15,
            boxShadow: `0 0 ${15 + Math.random() * 20}px rgba(59, 130, 246, 0.3)`,
          }}
        />
      ))}

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            opacity: 0.15;
            transform: translate3d(-60px, -200px, 50px) scale(1);
          }
          50% {
            opacity: 0.25;
            transform: translate3d(-60px, -200px, 50px) scale(1.05);
          }
        }

        @keyframes blink {
          0%, 90%, 100% {
            opacity: 1;
            transform: translate(-50%, -50%) scaleY(1);
          }
          95% {
            opacity: 0.3;
            transform: translate(-50%, -50%) scaleY(0.1);
          }
        }

        @keyframes swing-left {
          0%, 100% {
            transform: translate3d(-140px, -60px, 20px) rotateZ(-20deg);
          }
          50% {
            transform: translate3d(-140px, -60px, 20px) rotateZ(-30deg);
          }
        }

        @keyframes swing-right {
          0%, 100% {
            transform: translate3d(100px, -60px, 20px) rotateZ(20deg);
          }
          50% {
            transform: translate3d(100px, -60px, 20px) rotateZ(30deg);
          }
        }

        @keyframes float-0 {
          0%, 100% {
            transform: translateY(0) translateX(0) translateZ(var(--z, 0));
          }
          25% {
            transform: translateY(-30px) translateX(20px) translateZ(var(--z, 0));
          }
          50% {
            transform: translateY(-60px) translateX(-10px) translateZ(var(--z, 0));
          }
          75% {
            transform: translateY(-30px) translateX(-20px) translateZ(var(--z, 0));
          }
        }

        @keyframes float-1 {
          0%, 100% {
            transform: translateY(0) translateX(0) translateZ(var(--z, 0));
          }
          33% {
            transform: translateY(-40px) translateX(30px) translateZ(var(--z, 0));
          }
          66% {
            transform: translateY(-80px) translateX(-30px) translateZ(var(--z, 0));
          }
        }

        @keyframes float-2 {
          0%, 100% {
            transform: translateY(0) translateX(0) translateZ(var(--z, 0));
          }
          50% {
            transform: translateY(-50px) translateX(40px) translateZ(var(--z, 0));
          }
        }

        @keyframes float-3 {
          0%, 100% {
            transform: translateY(0) translateX(0) translateZ(var(--z, 0));
          }
          25% {
            transform: translateY(-25px) translateX(-25px) translateZ(var(--z, 0));
          }
          50% {
            transform: translateY(-50px) translateX(25px) translateZ(var(--z, 0));
          }
          75% {
            transform: translateY(-25px) translateX(-15px) translateZ(var(--z, 0));
          }
        }

        @keyframes flow-line {
          0% {
            opacity: 0;
            transform: rotate(var(--rotate, 0deg)) translateY(-100px) translateZ(var(--z, 0));
          }
          50% {
            opacity: 0.3;
          }
          100% {
            opacity: 0;
            transform: rotate(var(--rotate, 0deg)) translateY(100px) translateZ(var(--z, 0));
          }
        }

        @keyframes rotate-float {
          0% {
            transform: translateZ(var(--z, 0)) rotateZ(0deg) scale(1);
            opacity: 0.15;
          }
          50% {
            transform: translateZ(calc(var(--z, 0) + 20px)) rotateZ(180deg) scale(1.2);
            opacity: 0.25;
          }
          100% {
            transform: translateZ(var(--z, 0)) rotateZ(360deg) scale(1);
            opacity: 0.15;
          }
        }
      `}</style>
    </div>
  );
}







