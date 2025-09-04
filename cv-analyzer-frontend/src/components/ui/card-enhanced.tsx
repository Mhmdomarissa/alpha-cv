import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

// StatsCard component for displaying statistics
interface StatsCardProps {
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral' | { value: number; label: string; positive: boolean };
  trendValue?: string;
  title: string;
  value: string;
  subtitle?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  icon, 
  trend, 
  trendValue, 
  title, 
  value, 
  subtitle 
}) => {
  const getTrendIcon = () => {
    if (typeof trend === 'string') {
      switch (trend) {
        case 'up':
          return <div className="text-green-500">↗</div>;
        case 'down':
          return <div className="text-red-500">↘</div>;
        case 'neutral':
          return <div className="text-gray-500">→</div>;
        default:
          return null;
      }
    } else if (trend && typeof trend === 'object') {
      return trend.positive ? 
        <div className="text-green-500">↗</div> : 
        <div className="text-red-500">↘</div>;
    }
    return null;
  };

  const getTrendText = () => {
    if (typeof trend === 'string') {
      return trendValue;
    } else if (trend && typeof trend === 'object') {
      return `${trend.value} ${trend.label}`;
    }
    return null;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {icon && <div className="text-2xl text-muted-foreground">{icon}</div>}
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <div className="text-right">
          {getTrendIcon()}
          {getTrendText() && (
            <p className={`text-sm font-medium ${
              typeof trend === 'string' ? 
                (trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600') :
                (trend && typeof trend === 'object' && trend.positive ? 'text-green-600' : 'text-red-600')
            }`}>
              {getTrendText()}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, StatsCard };