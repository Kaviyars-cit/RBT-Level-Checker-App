import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import citLogo from '@/assets/cit-logo.png';

const Header = () => {
  const [dateTime, setDateTime] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return date.toLocaleDateString('en-IN', options);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  return (
    <header className="w-full bg-card border-b border-border px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <img 
            src={citLogo} 
            alt="Chennai Institute of Technology" 
            className="h-12 w-auto object-contain"
          />
          <div className="hidden md:block">
            <p className="text-sm font-semibold text-primary">Chennai Institute of Technology</p>
            <p className="text-xs text-muted-foreground">Transforming Lives</p>
          </div>
        </button>

        <div className="text-right">
          <p className="text-sm font-medium text-foreground">{formatTime(dateTime)}</p>
          <p className="text-xs text-muted-foreground">{formatDate(dateTime)}</p>
        </div>
      </div>
    </header>
  );
};

export default Header;
