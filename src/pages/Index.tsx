import Header from '@/components/Header';
import IACard from '@/components/IACard';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/20 border border-secondary/30 mb-6">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-medium text-foreground">RBT Level Verification System</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold text-foreground leading-tight mb-6">
            IA MARKS RBT LEVELS
            <span className="block text-gradient">VERIFICATION SYSTEM</span>
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Automated verification of Internal Assessment question papers based on 
            Revised Bloom's Taxonomy levels and Course Outcomes compliance.
          </p>
        </div>

        {/* IA Selection Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <IACard
              title="IA 1"
              marks={50}
              description="First Internal Assessment verification with CO1 focus. Supports HTML format question papers."
              route="/ia1"
              icon="ia1"
            />
          </div>
          
          <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <IACard
              title="IA 2"
              marks={50}
              description="Second Internal Assessment verification for CO2 & CO3. Accepts PDF and Word documents."
              route="/ia2"
              icon="ia2"
            />
          </div>
          
          <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <IACard
              title="IA 3 / MODEL"
              marks={100}
              description="Comprehensive model exam verification covering all COs with Parts A, B, and C analysis."
              route="/ia3"
              icon="ia3"
            />
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-16 bg-card rounded-2xl border border-border p-6 lg:p-8 animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <h2 className="text-xl font-display font-bold text-foreground mb-4">
            About RBT Level Verification
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-foreground mb-2">Bloom's Taxonomy Levels</h3>
              <div className="flex flex-wrap gap-2">
                <span className="level-badge level-l1">L1: Remember</span>
                <span className="level-badge level-l2">L2: Understand</span>
                <span className="level-badge level-l3">L3: Apply</span>
                <span className="level-badge level-l4">L4: Analyze</span>
                <span className="level-badge level-l5">L5: Evaluate</span>
                <span className="level-badge level-l6">L6: Create</span>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Required Distribution</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Overall: L1/L2 (40%), L3 (40%), L4-L6 (20%)</li>
                <li>• Part A: L1 (50%), L2 (40%), L3 (≤10%)</li>
                <li>• Part B/C: Mark-based level constraints apply</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-12">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-sm text-muted-foreground">
            © 2026 Chennai Institute of Technology. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
