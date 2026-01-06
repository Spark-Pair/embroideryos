// src/pages/Landing.jsx

import { Link } from 'react-router-dom';
import { useState } from 'react';

// Lucide Icons for clarity
import { 
  Spool, 
  Handshake, 
  Settings,
  ArrowRight,
  Target,
  Code,
  CheckCircle,
  X, // For modal close button
  ListChecks, // For machine queue mockup
} from 'lucide-react'; 

// Define the minimalist color palette
const ACCENT_COLOR = '#2c7a7b'; // Dark, sophisticated Teal
const TEXT_COLOR = '#1a202c';  // Almost Black
const LIGHT_BG = '#fcfcfc';    // Very light background for contrast

// =================================================================
// 1. MODAL COMPONENT (INTEGRATED)
// =================================================================

const TargetCalculatorModal = ({ onClose }) => {
    // This is a simplified placeholder modal inspired by the original functionality
    const [workers, setWorkers] = useState(10);
    const [target, setTarget] = useState(0);

    const calculateTarget = () => {
        // Placeholder calculation: e.g., 50 units per worker per day
        setTarget(workers * 50);
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-100">
                <div className="flex justify-between items-center mb-6 border-b pb-3">
                    <h2 className="text-2xl font-semibold" style={{ color: TEXT_COLOR }}>Request Guided Tour</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-900">
                        <X size={24} />
                    </button>
                </div>
                
                <p className="text-gray-600 mb-4">Please fill out the form to schedule a demonstration tailored to your business needs.</p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                        <input type="text" placeholder="Your Company Name" className="w-full p-2 border border-gray-300 rounded-lg focus:ring focus:ring-teal-100" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Number of Embroidery Heads/Machines</label>
                        <input 
                            type="number" 
                            min="1" 
                            value={workers} 
                            onChange={(e) => setWorkers(parseInt(e.target.value))}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring focus:ring-teal-100" 
                        />
                    </div>

                    <button
                        onClick={calculateTarget}
                        className="w-full py-2 text-white font-semibold rounded-lg transition duration-300 hover:opacity-90 mt-4"
                        style={{ backgroundColor: ACCENT_COLOR }}
                    >
                        Submit Request
                    </button>

                    {target > 0 && (
                        <p className="text-sm text-gray-500 pt-2 text-center">
                            We'll follow up soon! (Example metric: Estimated daily output for {workers} heads is {target} units.)
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

// =================================================================
// 2. FEATURE MOCKUP COMPONENTS (INTEGRATED)
// =================================================================

// Mockup 1: Stitch Precision & Costing (Table/Data focus)
const StitchPrecisionMockup = () => (
    <div className="space-y-3 p-4">
        <div className="text-sm font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
            <span>Design Costing: Logo V4</span>
            <span className="text-green-600">Approved</span>
        </div>
        <div className="bg-gray-100 p-4 rounded-xl space-y-2">
            <div className="flex justify-between border-b border-gray-300 pb-1 text-sm font-medium">
                <span>Total Stitch Count:</span>
                <span style={{ color: ACCENT_COLOR }}>15,840</span>
            </div>
            <div className="flex justify-between border-b border-gray-300 pb-1 text-sm">
                <span>Machine Run Time (Est.):</span>
                <span>42 mins</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2">
                <span>Unit Cost (Thread + Labor):</span>
                <span>$3.15</span>
            </div>
        </div>
    </div>
);

// Mockup 2: Machine Queue Optimization (List/Priority focus)
const MachineQueueMockup = () => (
    <div className="space-y-2 p-4">
        <div className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">Machine A Queue (Tajima TFMX)</div>
        <ul className="space-y-2">
            {['#8021 - Priority HIGH (Due Today)', '#8023 - Standard', '#8020 - Standard'].map((item, index) => (
                <li key={index} className={`p-3 rounded-xl flex justify-between items-center text-sm shadow-sm ${index === 0 ? 'bg-red-100 border border-red-300 font-semibold' : 'bg-white border border-gray-300'}`}>
                    <span className={index === 0 ? 'text-red-700' : 'text-gray-700'}>{item}</span>
                    <ListChecks className="w-4 h-4 text-gray-400" />
                </li>
            ))}
        </ul>
    </div>
);

// =================================================================
// 3. FEATURE CARD & BLOCK COMPONENTS (INTEGRATED)
// =================================================================

// --- Component for Alternating Feature Block ---
const FeatureBlock = ({ title, description, details, imageMockup, reverse }) => (
    <div className={`flex flex-col md:flex-row items-center gap-16 py-16 ${reverse ? 'md:flex-row-reverse' : ''}`}>
        
        {/* Text Content */}
        <div className="md:w-1/2 text-left">
            <h3 className="text-4xl font-light mb-4" style={{ color: TEXT_COLOR }}>{title}</h3>
            <p className="text-xl text-gray-700 mb-6 leading-relaxed">{description}</p>
            <ul className="space-y-3 text-gray-600">
                {details.map((detail, index) => (
                    <li key={index} className="flex items-start">
                        <CheckCircle className="w-5 h-5 mt-1 mr-3 flex-shrink-0" style={{ color: ACCENT_COLOR }} />
                        {detail}
                    </li>
                ))}
            </ul>
        </div>
        
        {/* Visual Mockup (Simulated App Screenshot) */}
        <div className="md:w-1/2 w-full p-2 bg-white rounded-3xl shadow-2xl border border-gray-100 transition duration-500 hover:shadow-3xl">
            {imageMockup}
        </div>
    </div>
);


// =================================================================
// 4. MAIN LANDING COMPONENT (INTEGRATED)
// =================================================================

export default function Landing() {
  const [openTarget, setOpenTarget] = useState(false);

  // Feature data focused on core value proposition
  const featureBlocks = [
    {
      title: 'Stitch Precision & Costing',
      description: 'Never underestimate a job again. EmbroideryOS accurately converts complex design files (DST/EMB) into precise production schedules and exact cost-per-unit figures.',
      details: ['Automated Run Time Calculation', 'Material/Thread Consumption Tracking', 'Accurate Unit Profitability Reports'],
      imageMockup: <StitchPrecisionMockup />,
    },
    {
      title: 'Machine Queue Optimization',
      description: 'Maximize your production floor\'s efficiency. Our smart scheduling automatically prioritizes high-value and urgent orders, minimizing downtime between runs.',
      details: ['Drag-and-Drop Job Reordering', 'Operator Load Balancing', 'Real-time Machine Status Monitoring'],
      imageMockup: <MachineQueueMockup />,
      reverse: true,
    },
    // Note: Other features (Client Order Management, Operational Analytics) would follow the same Block structure
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: LIGHT_BG }}>
      
      {/* 1. ELEGANT FLOATING NAVIGATION BAR */}
      <header className="py-5 px-8 border-b border-gray-300 sticky top-0 bg-white z-20 shadow-xl">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          
          {/* Logo/Brand */}
          <div className="flex items-center">
              <h1 className="text-3xl font-light tracking-wider" style={{ color: TEXT_COLOR }}>
                  Embroidery<span className="font-bold" style={{ color: ACCENT_COLOR }}>OS</span>
              </h1>
          </div>
          
          {/* Navigation Links and CTA */}
          <nav className="flex space-x-8 items-center">
            <a href="#features" className="text-gray-600 hover:text-gray-900 transition duration-200 text-base font-normal">Features</a>
            <a href="#trust" className="text-gray-600 hover:text-gray-900 transition duration-200 text-base font-normal">About SparkPair</a>
            
            {/* Primary CTA (Login) */}
            <Link 
              to="/login" 
              className={`px-5 py-2 text-base font-medium text-white rounded-xl transition duration-300 hover:opacity-90 shadow-md`}
              style={{ backgroundColor: ACCENT_COLOR }}
            >
              Client Login
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8">
        
        {/* 2. MINIMALIST HERO SECTION */}
        <section className="pt-24 pb-20 text-center">
            
            {/* Main Headline: Massive, thin typography for luxury */}
            <h1 className="text-7xl font-thin mb-6 leading-snug tracking-tight" style={{ color: TEXT_COLOR }}>
                The <span className="font-normal" style={{ color: ACCENT_COLOR }}>Operating System</span> <br /> 
                for Production Embroidery.
            </h1>
            
            {/* Descriptive Pitch: High contrast */}
            <p className="text-xl text-gray-700 max-w-4xl mx-auto font-light leading-relaxed">
                EmbroideryOS gives you total, elegant control over design complexity, production timelines, and profitability.
            </p>
            
        </section>
        
        {/* 3. APPLICATION MOCKUP VISUAL (Central Visual Element) */}
        <section className="mb-24">
            <div className="bg-white p-6 rounded-3xl shadow-2xl border border-gray-100 transition duration-500 transform hover:shadow-3xl">
                
                {/* Simulated App Header */}
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
                    <h3 className="text-2xl font-light" style={{ color: TEXT_COLOR }}>Main Dashboard Overview</h3>
                    <div className="text-sm font-medium text-white px-3 py-1 rounded-full shadow-md" style={{ backgroundColor: ACCENT_COLOR }}>Active Users: 5</div>
                </div>

                {/* Simulated Widgets Grid */}
                <div className="grid grid-cols-3 gap-6">
                    
                    {/* Widget 1: Order Status */}
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-inner col-span-1">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm uppercase tracking-wider text-gray-500">Total Revenue YTD</h4>
                        </div>
                        <p className="text-4xl font-light" style={{ color: TEXT_COLOR }}>
                            <span className="font-normal">$187,550</span>
                        </p>
                        <p className="text-sm text-green-600 mt-1">+12.5% vs Last Year</p>
                    </div>

                    {/* Widget 2: Production Analytics (Graph) */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-md col-span-2">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm uppercase tracking-wider text-gray-500">Monthly Job Completion Rate</h4>
                        </div>
                        {/* Placeholder for Graph */}
                        <div className="h-32 bg-gradient-to-r from-teal-50 to-white border border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                              
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* 4. HERO CTAS (Placed after the visual to drive action) */}
        <section className="text-center mb-24">
            <div className="flex gap-6 justify-center">
                {/* Primary Action: High-Impact Button */}
                <button
                    onClick={() => setOpenTarget(true)}
                    className="flex items-center justify-center gap-2 px-10 py-3 text-white font-semibold text-lg rounded-xl shadow-xl transition duration-300 hover:shadow-2xl"
                    style={{ backgroundColor: ACCENT_COLOR }}
                >
                    Book a Guided Tour
                    <ArrowRight className="w-5 h-5 ml-1" />
                </button>

                {/* Secondary Action: Bordered Button */}
                <Link
                    to="/register"
                    className="flex items-center justify-center gap-2 px-10 py-3 font-medium text-lg rounded-xl transition duration-300 hover:bg-gray-50"
                    style={{ color: ACCENT_COLOR, border: `2px solid ${ACCENT_COLOR}` }}
                >
                    Start 14-Day Free Trial
                </Link>
            </div>
        </section>

        {/* 5. FEATURE MODULES (Alternating Image/Text Layout) */}
        <section id="features" className="py-24 border-t border-gray-300">
          <h2 className="text-4xl font-light text-center mb-4" style={{ color: TEXT_COLOR }}>
            Engineered for Process. Built for Scale.
          </h2>
          <p className="text-lg text-gray-600 text-center max-w-3xl mx-auto mb-20 font-light">
            Each module is designed to give you elegant control over the most complex parts of your embroidery business.
          </p>
          
          <div className="space-y-20">
            {featureBlocks.map((block, index) => (
                <FeatureBlock 
                    key={index}
                    title={block.title}
                    description={block.description}
                    details={block.details}
                    imageMockup={block.imageMockup}
                    reverse={block.reverse}
                />
            ))}
          </div>
        </section>
        
        {/* 6. TRUST/DEVELOPER SECTION */}
        <section id="trust" className="py-24">
            <div className="p-10 rounded-2xl flex items-center justify-center gap-12 border border-gray-300 bg-white shadow-xl">
                <Code size={48} style={{ color: ACCENT_COLOR }} />
                <div className="max-w-2xl text-left">
                    <h3 className="text-3xl font-light mb-2" style={{ color: TEXT_COLOR }}>
                        Built with Precision. By <span className="font-medium">SparkPair</span>.
                    </h3>
                    <p className="text-lg text-gray-600">
                        EmbroideryOS is developed and maintained by **SparkPair (sparkpair.dev)**—specialists in niche, high-performance business software. Trust in reliable, expert code.
                    </p>
                </div>
            </div>
        </section>

        {/* 7. FINAL CTA */}
        <section className="py-24">
          <div 
            className="p-16 rounded-2xl text-center shadow-2xl"
            style={{ backgroundColor: ACCENT_COLOR }}
          >
            <h2 className="text-5xl font-light text-white mb-4">
              Stop Managing. Start Mastering.
            </h2>
            <p className="text-xl text-white opacity-90 mb-10 font-light">
              See the difference bespoke software makes.
            </p>
            <Link
              to="/contact" 
              className="inline-block px-12 py-3 bg-white text-lg font-bold rounded-xl shadow-xl transition duration-500 hover:scale-[1.03]"
              style={{ color: ACCENT_COLOR }}
            >
              Request a Consultation
            </Link>
          </div>
        </section>
        
        {/* 8. Footer */}
        <footer className="py-12 border-t border-gray-300 text-center text-gray-500 text-sm font-light">
            <p>&copy; {new Date().getFullYear()} EmbroideryOS by SparkPair. All rights reserved. | <Link to="/contact" className="hover:text-gray-900 font-normal">Contact</Link></p>
        </footer>
      </main>

      {/* 9. Modal (Demo) */}
      {openTarget && <TargetCalculatorModal onClose={() => setOpenTarget(false)} />}
    </div>
  );
}