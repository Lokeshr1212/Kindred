import React from 'react';
import type { VaultClientData } from '../types/memory';
import { BelongingsCollectionView } from './BelongingsCollectionView';
import { PlacesCollectionView } from './PlacesCollectionView';

export function PlacesView({
  vault,
  onVaultUpdate,
  onOpenAddPlace,
  onToast,
}: {
  vault: VaultClientData;
  onVaultUpdate: (v: VaultClientData) => void;
  onOpenAddPlace: () => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  return (
    <PlacesCollectionView
      vault={vault}
      onVaultUpdate={onVaultUpdate}
      onOpenAddPlace={onOpenAddPlace}
      onToast={onToast}
    />
  );
}

export function BelongingsView({
  vault,
  onVaultUpdate,
  onOpenAddBelonging,
  onAskAiAboutItem,
  onToast,
}: {
  vault: VaultClientData;
  onVaultUpdate: (v: VaultClientData) => void;
  onOpenAddBelonging: () => void;
  onAskAiAboutItem: () => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  return (
    <BelongingsCollectionView
      vault={vault}
      onVaultUpdate={onVaultUpdate}
      onOpenAddBelonging={onOpenAddBelonging}
      onAskAiAboutItem={onAskAiAboutItem}
      onToast={onToast}
    />
  );
}
