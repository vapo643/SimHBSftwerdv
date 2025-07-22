import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const CurrencyInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
          R$
        </span>
        <Input
          ref={ref}
          className={cn("pl-9", className)}
          {...props}
        />
      </div>
    )
  }
)
CurrencyInput.displayName = "CurrencyInput"

export { CurrencyInput }