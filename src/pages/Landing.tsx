import { Link } from 'react-router-dom';
import { Sparkles, Share2, Play } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-indigo-500 flex-shrink-0" />
            <span className="font-mono text-sm font-bold text-gray-900 tracking-widest uppercase">
              Flowchart AI
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="font-mono text-xs text-gray-600 hover:text-gray-900 px-3 py-1.5 transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className="font-mono text-xs font-bold text-white bg-indigo-500 hover:bg-indigo-600 px-4 py-2 rounded transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-24 text-center">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-4" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
          Create animated flowcharts<br />with AI
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto mb-10" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
          Describe your flow in plain text. Get a beautiful, animated, shareable flowchart in seconds.
        </p>
        <Link
          to="/login"
          className="inline-block font-mono text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-600 px-8 py-3 rounded transition-colors"
        >
          Start Creating
        </Link>
      </section>

      {/* Features */}
      <section className="border-t border-gray-100 bg-gray-50/50">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <FeatureCard
              icon={<Sparkles size={20} className="text-indigo-500" />}
              title="AI-Powered"
              description="Describe your flowchart in plain text and let AI generate screens, elements, and connections."
            />
            <FeatureCard
              icon={<Play size={20} className="text-indigo-500" />}
              title="Animated Previews"
              description="Every flowchart comes alive with step-by-step animations you can preview and customize."
            />
            <FeatureCard
              icon={<Share2 size={20} className="text-indigo-500" />}
              title="Shareable Links"
              description="Share your flowcharts with anyone via a public link — no login required to view."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <span className="font-mono text-xs text-gray-400">
            Flowchart AI
          </span>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <h3 className="font-mono text-sm font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
        {description}
      </p>
    </div>
  );
}
