import { useNavigate } from 'react-router-dom';
import { FileText, FileCheck, FileSpreadsheet } from 'lucide-react';

interface IACardProps {
  title: string;
  marks: number;
  description: string;
  route: string;
  icon: 'ia1' | 'ia2' | 'ia3';
}

const iconMap = {
  ia1: FileText,
  ia2: FileCheck,
  ia3: FileSpreadsheet,
};

const IACard = ({ title, marks, description, route, icon }: IACardProps) => {
  const navigate = useNavigate();
  const Icon = iconMap[icon];

  return (
    <div 
      onClick={() => navigate(route)}
      className="ia-card group"
    >
      <div className="ia-card-accent" />
      
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center group-hover:animate-pulse-glow transition-all duration-300">
          <Icon className="w-8 h-8 text-primary-foreground" />
        </div>
        
        <div>
          <h3 className="text-xl font-display font-bold text-foreground mb-1">{title}</h3>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-secondary/20 border border-secondary">
            <span className="text-sm font-semibold text-secondary-foreground">{marks} Marks</span>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        
        <div className="pt-2">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-primary group-hover:gap-3 transition-all duration-200">
            Start Verification
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
};

export default IACard;
