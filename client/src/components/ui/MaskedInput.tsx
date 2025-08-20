import React, { forwardRef, useState } from 'react';
import { Input } from './input';

interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  mask: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, value = '', onChange, placeholder, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState(formatValue(value, mask));

    const applyMask = (inputValue: string, maskPattern: string): string => {
      // Remove all non-numeric characters
      const cleanValue = inputValue.replace(/\D/g, '');
      let formatted = '';
      let cleanIndex = 0;

      for (let i = 0; i < maskPattern.length && cleanIndex < cleanValue.length; i++) {
        if (maskPattern[i] === '9') {
          formatted += cleanValue[cleanIndex];
          cleanIndex++;
        } else {
          formatted += maskPattern[i];
        }
      }

      return formatted;
    };

    function formatValue(val: string, maskPattern: string): string {
      if (!val) return '';
      return applyMask(val, maskPattern);
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const formatted = applyMask(inputValue, mask);
      setDisplayValue(formatted);
      
      if (onChange) {
        // Return clean value (numbers only) to the parent
        const cleanValue = inputValue.replace(/\D/g, '');
        onChange(cleanValue);
      }
    };

    React.useEffect(() => {
      setDisplayValue(formatValue(value, mask));
    }, [value, mask]);

    return (
      <Input
        {...props}
        ref={ref}
        value={displayValue}
        onChange={handleInputChange}
        placeholder={placeholder || mask.replace(/9/g, '_')}
      />
    );
  }
);

MaskedInput.displayName = 'MaskedInput';

export { MaskedInput };