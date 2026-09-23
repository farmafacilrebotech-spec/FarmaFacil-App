'use client';

import * as React from 'react';
import { toast } from 'sonner';

import type { PharmacyProduct } from '@/lib/pharmacies/products-types';
import {
  createPharmacyProductAction,
  updatePharmacyProductAction,
} from '@/app/f/[pharmacyId]/catalogo/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type FormState = {
  name: string;
  sku: string;
  ean: string;
  brand: string;
  category: string;
  description: string;
  price: string;
  stock: string;
  minStock: string;
  isActive: boolean;
  isFeatured: boolean;
};

function fromProduct(product: PharmacyProduct | null): FormState {
  if (!product) {
    return {
      name: '',
      sku: '',
      ean: '',
      brand: '',
      category: '',
      description: '',
      price: '0',
      stock: '0',
      minStock: '0',
      isActive: true,
      isFeatured: false,
    };
  }
  return {
    name: product.name,
    sku: product.sku ?? '',
    ean: product.ean ?? '',
    brand: product.brand ?? '',
    category: product.category ?? '',
    description: product.description ?? '',
    price: String(product.price),
    stock: String(product.stock),
    minStock: String(product.minStock),
    isActive: product.isActive,
    isFeatured: product.isFeatured,
  };
}

export function ProductFormDialog({
  open,
  onOpenChange,
  pharmacyId,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pharmacyId: string;
  product: PharmacyProduct | null;
}) {
  const [form, setForm] = React.useState<FormState>(() => fromProduct(product));
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm(fromProduct(product));
  }, [open, product]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      sku: form.sku || null,
      ean: form.ean || null,
      brand: form.brand || null,
      category: form.category || null,
      description: form.description || null,
      price: Number(form.price.replace(',', '.')),
      stock: Number(form.stock),
      minStock: Number(form.minStock),
      isActive: form.isActive,
      isFeatured: form.isFeatured,
    };

    const result = product
      ? await updatePharmacyProductAction(pharmacyId, product.id, payload)
      : await createPharmacyProductAction(pharmacyId, payload);

    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(product ? 'Producto actualizado.' : 'Producto creado.');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {product ? 'Editar producto' : 'Añadir producto'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              required
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={form.sku}
                onChange={(e) => setField('sku', e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ean">EAN</Label>
              <Input
                id="ean"
                value={form.ean}
                onChange={(e) => setField('ean', e.target.value)}
                maxLength={200}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="brand">Marca</Label>
              <Input
                id="brand"
                value={form.brand}
                onChange={(e) => setField('brand', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Categoría</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => setField('category', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="price">PVP (€)</Label>
              <Input
                id="price"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setField('price', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stock">Stock</Label>
              <Input
                id="stock"
                inputMode="numeric"
                value={form.stock}
                onChange={(e) => setField('stock', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minStock">Stock mín.</Label>
              <Input
                id="minStock"
                inputMode="numeric"
                value={form.minStock}
                onChange={(e) => setField('minStock', e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setField('isActive', v)}
                id="isActive"
              />
              <Label htmlFor="isActive">Activo</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isFeatured}
                onCheckedChange={(v) => setField('isFeatured', v)}
                id="isFeatured"
              />
              <Label htmlFor="isFeatured">Destacado</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : product ? 'Guardar cambios' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
