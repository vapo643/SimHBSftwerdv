import React from "react";
import { Input } from "./input";

interface CurrencyInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({ value, onChange, ...props }) => {
  const formatCurrency = (inputValue: string) => {
    // Remove all non-digit characters
    const digits = inputValue.replace(/\D/g, "");

    // Convert to number and divide by 100 to get decimal value
    const amount = parseInt(digits, 10) / 100;

    // Format as Brazilian currency
    if (isNaN(amount)) return "";

    return amount.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatCurrency(e.target.value);

    // Create a synthetic event with the formatted value
    const syntheticEvent = {
      ...e,
      target: {
        ...e.target,
        value: formattedValue,
      },
    };

    onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
      <Input
        {...props}
        value={value}
        onChange={handleChange}
        className={`pl-10 ${props.className || ""}`}
        placeholder="0,00"
      />
    </div>
  );
};

export default CurrencyInput;
