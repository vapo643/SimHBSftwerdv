import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RefreshButtonProps {
  onRefresh: () => void;
  isLoading?: boolean;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showLabel?: boolean;
  label?: string;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({
  onRefresh,
  isLoading = false,
  variant = "ghost",
  size = "sm",
  className = "",
  showLabel = false,
  label = "Atualizar",
}) => {
  const { toast } = useToast();

  const handleRefresh = () => {
    onRefresh();
    toast({
      title: "Dados atualizados",
      description: "As informações foram recarregadas com sucesso.",
      duration: 2000,
    });
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleRefresh}
      disabled={isLoading}
      className={`transition-all duration-200 hover:scale-105 ${className}`}
      title={label}
    >
      <RefreshCw
        className={`h-4 w-4 ${isLoading ? "animate-spin" : ""} ${showLabel ? "mr-2" : ""}`}
      />
      {showLabel && label}
    </Button>
  );
};

export default RefreshButton;
