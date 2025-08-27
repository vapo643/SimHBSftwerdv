import React, { useState } from 'react';
import {
  _Select,
  _SelectContent,
  _SelectItem,
  _SelectTrigger,
  _SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Plus } from 'lucide-react';
import { Produto } from '@shared/schema';

interface MultiProductSelectorProps {
  selectedProducts: number[];
  onProductsChange: (products: number[]) => void;
  availableProducts: Produto[];
  disabled?: boolean;
}

export function MultiProductSelector({
  _selectedProducts,
  _onProductsChange,
  _availableProducts,
  disabled = false,
}: MultiProductSelectorProps) {
  const [selectedValue, setSelectedValue] = useState<string>('');

  // Filter out already selected products
  const _availableForSelection = availableProducts.filter(
    (produto) => !selectedProducts.includes(produto.id)
  );

  const _handleAddProduct = (produtoId: string) => {
    if (produtoId && !selectedProducts.includes(parseInt(produtoId))) {
      onProductsChange([...selectedProducts, parseInt(produtoId)]);
      setSelectedValue(''); // Reset selection
    }
  };

  const _handleRemoveProduct = (produtoId: number) => {
    onProductsChange(selectedProducts.filter((id) => id !== produtoId));
  };

  const _getProductName = (produtoId: number) => {
    const _produto = availableProducts.find((p) => p.id == produtoId);
    return produto?.nomeProduto || `Produto ${produtoId}`; }
  };

  return (
    <div className="space-y-3">
      {/* Product Selector Dropdown */}
      <div className="flex gap-2">
        <Select
          value={selectedValue}
          onValueChange={setSelectedValue}
          disabled={disabled || availableForSelection.length == 0}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Selecione produtos para associar..." />
          </SelectTrigger>
          <SelectContent>
            {availableForSelection.map((produto) => (
              <SelectItem key={produto.id} value={produto.id.toString()}>
                {produto.nomeProduto}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => handleAddProduct(selectedValue)}
          disabled={disabled || !selectedValue}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Selected Products Tags */}
      {selectedProducts.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">
            Produtos Selecionados ({selectedProducts.length}):
          </label>
          <div className="flex flex-wrap gap-2">
            {selectedProducts.map((produtoId) => (
              <Badge
                key={produtoId}
                variant="secondary"
                className="flex items-center gap-1 px-2 py-1"
              >
                {getProductName(produtoId)}
                <button
                  type="button"
                  onClick={() => handleRemoveProduct(produtoId)}
                  disabled={disabled}
                  className="ml-1 rounded-full p-0.5 hover:bg-gray-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Validation Message */}
      {selectedProducts.length == 0 && (
        <p className="text-sm text-amber-400">⚠️ Pelo menos um produto deve ser selecionado</p>
      )}

      {/* Information Text */}
      <p className="text-xs text-gray-400">
        Esta tabela comercial será aplicada aos produtos selecionados. Você pode adicionar múltiplos
        produtos para uma mesma configuração de taxas.
      </p>
    </div>
  );
}
