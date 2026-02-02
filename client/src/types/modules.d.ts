// Type declarations for modules without types

declare module 'lucide-react' {
  import { ComponentType, SVGProps } from 'react';
  
  interface IconProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
  }
  
  type Icon = ComponentType<IconProps>;
  
  // A
  export const Activity: Icon;
  export const AlertCircle: Icon;
  export const AlertTriangle: Icon;
  export const ArrowLeft: Icon;
  export const ArrowRight: Icon;
  export const ArrowRightCircle: Icon;
  
  // B
  export const BarChart2: Icon;
  export const Bitcoin: Icon;
  export const BookOpen: Icon;
  export const Briefcase: Icon;
  
  // C
  export const Calculator: Icon;
  export const Calendar: Icon;
  export const ChevronDown: Icon;
  export const ChevronLeft: Icon;
  export const ChevronRight: Icon;
  export const ChevronUp: Icon;
  export const Clock: Icon;
  export const Coins: Icon;
  export const Copy: Icon;
  
  // D
  export const Database: Icon;
  export const DollarSign: Icon;
  
  // E
  export const Edit2: Icon;
  export const Eye: Icon;
  export const EyeOff: Icon;
  
  // F
  export const FileJson: Icon;
  export const FileText: Icon;
  export const Filter: Icon;
  
  // H
  export const HelpCircle: Icon;
  export const History: Icon;
  export const Home: Icon;
  
  // L
  export const Landmark: Icon;
  export const Layout: Icon;
  export const LayoutDashboard: Icon;
  export const LayoutGrid: Icon;
  export const Layers: Icon;
  export const Loader2: Icon;
  
  // M
  export const Maximize2: Icon;
  export const MessageSquare: Icon;
  
  // P
  export const PieChart: Icon;
  export const Plus: Icon;
  
  // R
  export const RefreshCw: Icon;
  
  // S
  export const Save: Icon;
  export const Search: Icon;
  export const Sparkles: Icon;
  
  // T
  export const Trash2: Icon;
  export const TrendingUp: Icon;
  
  // W
  export const Wallet: Icon;
  export const Wifi: Icon;
  export const Workflow: Icon;
  
  // X
  export const X: Icon;
}
