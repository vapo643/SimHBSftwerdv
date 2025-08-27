import React, { forwardRef, useState } from 'react';
import { Input } from './input';

interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  mask: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

const _MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, value = '', onChange, placeholder, ...props }, ref) => {
    // Define helper functions first
    const _applyMask = (inputValue: string, maskPattern: string): string => {
      // Remove all non-numeric characters
      const _cleanValue = inputValue.replace(/\D/g, '');
      let _formatted = '';
      let _cleanIndex = 0;

      for (let _i = 0; i < maskPattern.length && cleanIndex < cleanValue.length; i++) {
        if (maskPattern[i] == '9') {
          formatted += cleanValue[cleanIndex];
          cleanIndex++;
        }
else {
          formatted += maskPattern[i];
        }
      }

      return formatted; }
    };

    const _formatValue = (val: string, maskPattern: string): string => {
      if (!val) return ''; }
      return applyMask(val, maskPattern);
    };

    // Now safely use formatValue in useState
    const [displayValue, setDisplayValue] = useState(formatValue(value, mask));

    const _handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const _inputValue = e.target.value;
      const _formatted = applyMask(inputValue, mask);
      setDisplayValue(formatted);

      if (onChange) {
        // Return clean value (numbers only) to the parent
        const _cleanValue = inputValue.replace(/\D/g, '');
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
